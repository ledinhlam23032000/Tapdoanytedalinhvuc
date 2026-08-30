import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { sortByUrgency } from "@/lib/domain/work-priority";
import { assertSameCompanyOrganizationUnit, assertSameCompanyProject, assertActiveCompanyMember } from "@/lib/domain/scope-guards";
import type { CompanyPermission } from "@/lib/permissions/registry";
import type { WorkItem } from "@/generated/prisma";

// Domain service — Work Core (WorkItem). Master Prompt Phần 4 mục XXVI-LII.
// MỘT engine việc duy nhất cho toàn bộ Company/Project (ADR-014) — không tạo
// engine thứ hai cho Project. Xem docs/domain/WORK_CORE.md.

async function assertSameCompanyWorkItem(companyId: string, workItemId: string): Promise<WorkItem> {
  const item = await db.workItem.findUnique({ where: { id: workItemId } });
  if (!item || item.companyId !== companyId) {
    throw new AuthorizationError("Công việc không hợp lệ trong công ty này.");
  }
  return item;
}

/** ADR-015 mở rộng cho hành động 1-1: work.manage (quản trị) hoặc chính người
 * được giao/người tạo mới được sửa/bắt đầu/hoàn thành 1 WorkItem cụ thể. */
function canActOnWorkItem(actorId: string, item: WorkItem, permissions: Set<CompanyPermission>): boolean {
  if (permissions.has("work.manage")) return true;
  if (item.assigneeUserId === actorId) return true;
  if (item.createdByUserId === actorId) return true;
  return false;
}

// ===== Create =====

const createWorkItemSchema = z.object({
  companyId: z.string().min(1),
  organizationUnitId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  assigneeUserId: z.string().min(1).optional(),
  dueAt: z.coerce.date().optional(),
});

export async function createWorkItem(actorId: string, input: z.input<typeof createWorkItemSchema>) {
  const parsed = createWorkItemSchema.parse(input);
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, parsed.companyId, "work.create");

  if (parsed.assigneeUserId && parsed.assigneeUserId !== actor.id) {
    if (!permissions.has("work.assign")) {
      throw new AuthorizationError("Bạn không có quyền giao việc cho người khác — chỉ có thể tự nhận việc cho mình.");
    }
    await assertActiveCompanyMember(company.id, parsed.assigneeUserId);
  }
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  if (parsed.projectId) await assertSameCompanyProject(company.id, parsed.projectId);

  return db.$transaction(async (tx) => {
    const item = await tx.workItem.create({
      data: {
        companyId: company.id,
        organizationUnitId: parsed.organizationUnitId,
        projectId: parsed.projectId,
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        assigneeUserId: parsed.assigneeUserId,
        createdByUserId: actor.id,
        dueAt: parsed.dueAt,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.WORK_CREATED,
      targetType: "WorkItem",
      targetId: item.id,
      companyId: company.id,
      metadata: { title: item.title, assigneeUserId: item.assigneeUserId ?? undefined },
    });
    return item;
  });
}

// ===== Assign =====

const assignWorkItemSchema = z.object({
  companyId: z.string().min(1),
  workItemId: z.string().min(1),
  assigneeUserId: z.string().min(1),
});

export async function assignWorkItem(actorId: string, input: z.input<typeof assignWorkItemSchema>) {
  const parsed = assignWorkItemSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "work.assign");
  const item = await assertSameCompanyWorkItem(company.id, parsed.workItemId);
  await assertActiveCompanyMember(company.id, parsed.assigneeUserId);

  return db.$transaction(async (tx) => {
    const updated = await tx.workItem.update({
      where: { id: item.id },
      data: { assigneeUserId: parsed.assigneeUserId },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.WORK_ASSIGNED,
      targetType: "WorkItem",
      targetId: item.id,
      companyId: company.id,
      metadata: { assigneeUserId: parsed.assigneeUserId },
    });
    return updated;
  });
}

// ===== Start / Complete / Cancel =====

export async function startWorkItem(actorId: string, companyId: string, workItemId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "work.update");
  const item = await assertSameCompanyWorkItem(company.id, workItemId);
  if (!canActOnWorkItem(actor.id, item, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật công việc này.");
  }
  if (item.status !== "TODO") throw new Error("Chỉ có thể bắt đầu công việc đang ở trạng thái Cần làm.");

  return db.$transaction(async (tx) => {
    const updated = await tx.workItem.update({
      where: { id: item.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.WORK_STARTED,
      targetType: "WorkItem",
      targetId: item.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function completeWorkItem(actorId: string, companyId: string, workItemId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "work.complete");
  const item = await assertSameCompanyWorkItem(company.id, workItemId);
  if (!canActOnWorkItem(actor.id, item, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật công việc này.");
  }
  if (item.status !== "TODO" && item.status !== "IN_PROGRESS") {
    throw new Error("Công việc này đã hoàn thành hoặc đã huỷ.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.workItem.update({
      where: { id: item.id },
      data: { status: "DONE", completedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.WORK_COMPLETED,
      targetType: "WorkItem",
      targetId: item.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function cancelWorkItem(actorId: string, companyId: string, workItemId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "work.update");
  const item = await assertSameCompanyWorkItem(company.id, workItemId);
  if (!canActOnWorkItem(actor.id, item, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật công việc này.");
  }
  if (item.status === "DONE" || item.status === "CANCELLED") {
    throw new Error("Công việc này đã hoàn thành hoặc đã huỷ.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.workItem.update({ where: { id: item.id }, data: { status: "CANCELLED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.WORK_CANCELLED,
      targetType: "WorkItem",
      targetId: item.id,
      companyId: company.id,
    });
    return updated;
  });
}

// ===== Read =====

export async function getWorkItemDetail(actorId: string, companyId: string, workItemId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "work.view");
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { assignee: true, creator: true, organizationUnit: true, project: true },
  });
  if (!item || item.companyId !== company.id) throw new AuthorizationError();
  // ADR-015: MEMBER/VIEWER (không có work.assign) chỉ xem việc của chính mình.
  if (!permissions.has("work.assign") && item.assigneeUserId !== actor.id && item.createdByUserId !== actor.id) {
    throw new AuthorizationError("Bạn không có quyền xem công việc này.");
  }
  return item;
}

/** "Hôm nay" của chính actor — luôn self-scope, xếp hạng theo work-priority.ts. */
export async function getMyTodayWork(actorId: string, companyId: string, now: Date) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "work.view");
  const items = await db.workItem.findMany({
    where: { companyId: company.id, assigneeUserId: actor.id, status: { in: ["TODO", "IN_PROGRESS"] } },
    include: { project: true, organizationUnit: true },
  });
  return sortByUrgency(items, now, company.timezone);
}

/** ADR-015: MANAGER trở lên (có work.assign) xem toàn Company; MEMBER/VIEWER chỉ xem việc liên quan chính mình. */
export async function getCompanyWork(
  actorId: string,
  companyId: string,
  filters: { status?: WorkItem["status"] } = {},
) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "work.view");
  const scopeFilter = permissions.has("work.assign")
    ? {}
    : { OR: [{ assigneeUserId: actor.id }, { createdByUserId: actor.id }] };

  return db.workItem.findMany({
    where: { companyId: company.id, status: filters.status, ...scopeFilter },
    include: { assignee: true, project: true, organizationUnit: true },
    orderBy: { createdAt: "desc" },
  });
}
