import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import type { CompanyPermission } from "@/lib/permissions/registry";
import type { ApprovalRequest, ApprovalActionType, Prisma } from "@/generated/prisma";

// Domain service — ApprovalRequest, primitive two-person-approval DÙNG CHUNG
// cho mọi hành động rủi ro cao ở Phần 6 (ADR-028/ADR-029). Mô phỏng theo
// AssistantApproval (legacy, đã production-tested — status-driven, MỘT
// field firstApprovedByUserId, không phải 2 field approver riêng như
// ZWorkspacePayrollRun chưa từng chạy thật). KHÔNG tạo bảng approval riêng
// theo domain — chỉ PayrollRun.finalize và StockMovement Adjustment đi qua
// đây ở Phần 6 (ADR-029); các domain khác (payroll-service.ts,
// inventory-service.ts) gọi các hàm dưới đây, không tự viết lại state
// machine.

async function assertSameCompanyApprovalRequest(companyId: string, requestId: string): Promise<ApprovalRequest> {
  const request = await db.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request || request.companyId !== companyId) {
    throw new AuthorizationError("Yêu cầu phê duyệt không hợp lệ trong công ty này.");
  }
  return request;
}

const createApprovalRequestSchema = z.object({
  companyId: z.string().min(1),
  actionType: z.enum(["PAYROLL_FINALIZE", "INVENTORY_ADJUSTMENT"]),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** Tạo yêu cầu duyệt mới, trạng thái PENDING. Domain service gọi cùng
 * `permission` mà hành động gốc yêu cầu (vd payroll.manage cho
 * PAYROLL_FINALIZE) — actor tạo request PHẢI có quyền thực hiện hành động
 * đó, không phải quyền "approval" riêng. */
export async function createApprovalRequest(
  actorId: string,
  permission: CompanyPermission,
  input: z.input<typeof createApprovalRequestSchema>,
) {
  const parsed = createApprovalRequestSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, permission);

  return db.$transaction(async (tx) => {
    const request = await tx.approvalRequest.create({
      data: {
        companyId: company.id,
        actionType: parsed.actionType as ApprovalActionType,
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        payload: parsed.payload as Prisma.InputJsonValue | undefined,
        requestedByUserId: actor.id,
        reason: parsed.reason,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPROVAL_REQUESTED,
      targetType: "ApprovalRequest",
      targetId: request.id,
      companyId: company.id,
      metadata: { actionType: request.actionType, targetType: request.targetType, targetId: request.targetId },
    });
    return request;
  });
}

/** Bước duyệt lần 1: PENDING -> PENDING_SECOND, ghi firstApprovedByUserId.
 * Đúng pattern AssistantApproval thật — actor tạo request CÓ THỂ là người
 * duyệt lần 1 (họ đã tự chịu trách nhiệm khi bấm hành động), nhưng lần 2
 * bắt buộc PHẢI là người khác (guard ở resolveApprovalRequest). */
export async function firstApproveRequest(
  actorId: string,
  permission: CompanyPermission,
  companyId: string,
  requestId: string,
) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, permission);
  const request = await assertSameCompanyApprovalRequest(company.id, requestId);
  if (request.status !== "PENDING") {
    throw new Error("Yêu cầu này không ở trạng thái chờ duyệt lần 1.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: "PENDING_SECOND", firstApprovedByUserId: actor.id, firstApprovedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPROVAL_FIRST_APPROVED,
      targetType: "ApprovalRequest",
      targetId: request.id,
      companyId: company.id,
    });
    return updated;
  });
}

/** Bước duyệt lần 2: PENDING_SECOND -> APPROVED. Bất biến bắt buộc: actor
 * PHẢI khác firstApprovedByUserId (ADR-028) — chặn 1 người tự duyệt cả 2
 * lần. KHÔNG tự thực thi hành động gốc (finalize payroll / ghi stock
 * adjustment) — domain service gọi hàm này TRƯỚC rồi mới thực thi, kiểm tra
 * status APPROVED trước khi tiến hành (xem payroll-service.ts/
 * inventory-service.ts). */
export async function secondApproveRequest(
  actorId: string,
  permission: CompanyPermission,
  companyId: string,
  requestId: string,
) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, permission);
  const request = await assertSameCompanyApprovalRequest(company.id, requestId);
  if (request.status !== "PENDING_SECOND") {
    throw new Error("Yêu cầu này chưa được duyệt lần 1 hoặc đã được xử lý.");
  }
  if (request.firstApprovedByUserId === actor.id) {
    throw new AuthorizationError("Bạn đã duyệt lần 1 — cần một người khác duyệt lần 2.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPROVAL_RESOLVED,
      targetType: "ApprovalRequest",
      targetId: request.id,
      companyId: company.id,
      metadata: { firstApprovedByUserId: request.firstApprovedByUserId ?? undefined },
    });
    return updated;
  });
}

export async function rejectApprovalRequest(
  actorId: string,
  permission: CompanyPermission,
  companyId: string,
  requestId: string,
) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, permission);
  const request = await assertSameCompanyApprovalRequest(company.id, requestId);
  if (request.status !== "PENDING" && request.status !== "PENDING_SECOND") {
    throw new Error("Yêu cầu này đã được xử lý.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPROVAL_REJECTED,
      targetType: "ApprovalRequest",
      targetId: request.id,
      companyId: company.id,
    });
    return updated;
  });
}

/** Đọc trạng thái 1 request cụ thể theo target — dùng để domain service
 * kiểm tra "đã APPROVED chưa" trước khi thực thi hành động gốc, và UI hiển
 * thị trạng thái chờ duyệt. */
export async function getApprovalRequestForTarget(
  companyId: string,
  actionType: ApprovalActionType,
  targetId: string,
) {
  return db.approvalRequest.findFirst({
    where: { companyId, actionType, targetId },
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { omit: { passwordHash: true } },
      firstApprovedByUser: { omit: { passwordHash: true } },
    },
  });
}

export async function getPendingApprovalRequests(
  actorId: string,
  permission: CompanyPermission,
  companyId: string,
) {
  await requireCompanyContextForActor(actorId, companyId, permission);
  return db.approvalRequest.findMany({
    where: { companyId, status: { in: ["PENDING", "PENDING_SECOND"] } },
    include: {
      requestedBy: { omit: { passwordHash: true } },
      firstApprovedByUser: { omit: { passwordHash: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
