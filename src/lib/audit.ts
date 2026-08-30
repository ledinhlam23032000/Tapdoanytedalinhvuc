import type { Prisma, PrismaClient } from "@/generated/prisma";

// Platform audit primitive (Master Prompt Phần 3 mục XCIV-XCVIII). Action
// names business-readable, actor luôn bắt buộc (không có "system" cho thao
// tác của user). Gọi bên trong CÙNG transaction với state change khi khả
// thi — mục XCVI: không để "Company suspended thành công" nhưng audit ghi
// thất bại âm thầm.
export const AUDIT_ACTIONS = {
  ECOSYSTEM_CREATED: "ECOSYSTEM_CREATED",
  COMPANY_CREATED: "COMPANY_CREATED",
  COMPANY_SUSPENDED: "COMPANY_SUSPENDED",
  COMPANY_RESUMED: "COMPANY_RESUMED",
  COMPANY_ARCHIVED: "COMPANY_ARCHIVED",
  COMPANY_MEMBER_ADDED: "COMPANY_MEMBER_ADDED",
  COMPANY_MEMBER_ROLE_CHANGED: "COMPANY_MEMBER_ROLE_CHANGED",
  COMPANY_MEMBER_REMOVED: "COMPANY_MEMBER_REMOVED",
  LOGIN_SUCCEEDED: "LOGIN_SUCCEEDED",
  LOGIN_FAILED: "LOGIN_FAILED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

type AuditParams = {
  actorUserId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  ecosystemId?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
};

// Nhận tx client (Prisma.TransactionClient) hoặc client thường — cho phép
// gọi trong $transaction() của action gọi nó.
export async function recordAudit(
  client: PrismaClient | Prisma.TransactionClient,
  params: AuditParams,
): Promise<void> {
  await client.auditEvent.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      ecosystemId: params.ecosystemId,
      companyId: params.companyId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
