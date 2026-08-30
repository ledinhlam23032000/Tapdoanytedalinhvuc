import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { assertSameCompanyOrganizationUnit, assertSameCompanyProject, assertActiveCompanyMember } from "@/lib/domain/scope-guards";
import type { CompanyPermission } from "@/lib/permissions/registry";
import type { Project } from "@/generated/prisma";

// Domain service — Project (mục CVII trở đi). Project là cấu trúc công việc
// CÓ THỜI HẠN bên trong 1 Company — KHÔNG phải tenant, KHÔNG sở hữu
// Customer/Ledger/Payroll riêng, KHÔNG thay Company sidebar (ADR-008,
// docs/domain/PROJECT.md: "Project không phải Company").

// updateProject/addProjectMember/completeProject gọi requireCompanyContextForActor
// với "project.view" (permission thấp nhất mọi actor liên quan đều có) rồi tự
// check quyền thật qua requireProjectManageAccess bên dưới — vì vậy KHÔNG thể
// dựa vào cờ isWriteAction() trong company-context.ts (nó coi "project.view"
// là read-only nên bỏ qua check Company SUSPENDED/ARCHIVED). Phải tự chặn
// tường minh ở đây (tìm thấy qua red-team review Phần 4 — thiếu chặn này from
// trước khi fix).
function assertCompanyWritable(company: { status: string }): void {
  if (company.status !== "ACTIVE") {
    throw new AuthorizationError("Công ty đang tạm dừng hoặc lưu trữ — không thể ghi dữ liệu mới.");
  }
}

/** project.manage (OWNER/COMPANY_ADMIN) hoặc chính Project OWNER-membership mới được sửa/thêm-thành-viên. */
async function requireProjectManageAccess(
  actorId: string,
  project: Project,
  permissions: Set<CompanyPermission>,
): Promise<void> {
  if (permissions.has("project.manage")) return;
  const membership = await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: actorId } },
  });
  if (membership && membership.status === "ACTIVE" && membership.rolePreset === "OWNER") return;
  throw new AuthorizationError("Bạn không có quyền quản lý dự án này.");
}

// ===== Create =====

const createProjectSchema = z.object({
  companyId: z.string().min(1),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  ownerUserId: z.string().min(1).optional(),
  owningUnitId: z.string().min(1).optional(),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  budgetAmount: z.coerce.number().nonnegative().optional(),
});

export async function createProject(actorId: string, input: z.input<typeof createProjectSchema>) {
  const parsed = createProjectSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "project.create");

  const ownerUserId = parsed.ownerUserId ?? actor.id;
  await assertActiveCompanyMember(company.id, ownerUserId);
  if (parsed.owningUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.owningUnitId);

  const existing = await db.project.findUnique({ where: { companyId_code: { companyId: company.id, code: parsed.code } } });
  if (existing) throw new Error("Mã dự án đã tồn tại trong công ty này.");

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId: company.id,
        code: parsed.code,
        name: parsed.name,
        description: parsed.description,
        ownerUserId,
        owningUnitId: parsed.owningUnitId,
        startAt: parsed.startAt,
        dueAt: parsed.dueAt,
        budgetAmount: parsed.budgetAmount,
      },
    });
    // Bootstrap: chủ dự án luôn có ProjectMembership OWNER ngay khi tạo —
    // tương tự Company bootstrap ở company-service.ts — để mọi truy vấn
    // "dự án của tôi" nhất quán qua ProjectMembership, không qua Project.ownerUserId.
    await tx.projectMembership.create({
      data: { projectId: project.id, userId: ownerUserId, rolePreset: "OWNER" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROJECT_CREATED,
      targetType: "Project",
      targetId: project.id,
      companyId: company.id,
      metadata: { name: project.name, code: project.code },
    });
    return project;
  });
}

// ===== Update =====

const updateProjectSchema = z.object({
  companyId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  owningUnitId: z.string().min(1).optional(),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  budgetAmount: z.coerce.number().nonnegative().optional(),
});

export async function updateProject(actorId: string, input: z.input<typeof updateProjectSchema>) {
  const parsed = updateProjectSchema.parse(input);
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, parsed.companyId, "project.view");
  assertCompanyWritable(company);
  const project = await assertSameCompanyProject(company.id, parsed.projectId);
  await requireProjectManageAccess(actor.id, project, permissions);
  if (parsed.owningUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.owningUnitId);

  return db.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: project.id },
      data: {
        name: parsed.name,
        description: parsed.description,
        owningUnitId: parsed.owningUnitId,
        startAt: parsed.startAt,
        dueAt: parsed.dueAt,
        budgetAmount: parsed.budgetAmount,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      targetType: "Project",
      targetId: project.id,
      companyId: company.id,
    });
    return updated;
  });
}

// ===== Member =====

const addProjectMemberSchema = z.object({
  companyId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  rolePreset: z.enum(["OWNER", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function addProjectMember(actorId: string, input: z.input<typeof addProjectMemberSchema>) {
  const parsed = addProjectMemberSchema.parse(input);
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, parsed.companyId, "project.view");
  assertCompanyWritable(company);
  const project = await assertSameCompanyProject(company.id, parsed.projectId);
  await requireProjectManageAccess(actor.id, project, permissions);
  // mục LXIII: thành viên Project bắt buộc phải là thành viên đang hoạt động
  // của ĐÚNG Company này — không thể mời người ngoài Company vào Project.
  await assertActiveCompanyMember(company.id, parsed.userId);

  const existing = await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: parsed.userId } },
  });
  if (existing && existing.status === "ACTIVE") throw new Error("Người này đã là thành viên dự án.");

  return db.$transaction(async (tx) => {
    const membership = existing
      ? await tx.projectMembership.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", rolePreset: parsed.rolePreset },
        })
      : await tx.projectMembership.create({
          data: { projectId: project.id, userId: parsed.userId, rolePreset: parsed.rolePreset },
        });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROJECT_MEMBER_ADDED,
      targetType: "Project",
      targetId: project.id,
      companyId: company.id,
      metadata: { targetUserId: parsed.userId, rolePreset: parsed.rolePreset },
    });
    return membership;
  });
}

// ===== Lifecycle =====

export async function completeProject(actorId: string, companyId: string, projectId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "project.view");
  assertCompanyWritable(company);
  const project = await assertSameCompanyProject(company.id, projectId);
  await requireProjectManageAccess(actor.id, project, permissions);
  if (project.status === "COMPLETED" || project.status === "CANCELLED" || project.status === "ARCHIVED") {
    throw new Error("Dự án này đã kết thúc.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.project.update({ where: { id: project.id }, data: { status: "COMPLETED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROJECT_COMPLETED,
      targetType: "Project",
      targetId: project.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function archiveProject(actorId: string, companyId: string, projectId: string) {
  // project.archive là quyền lifecycle riêng (chỉ OWNER/COMPANY_ADMIN) — không
  // dùng requireProjectManageAccess (vốn cho phép cả Project OWNER-membership),
  // vì lưu trữ dự án là hành động cấp Company, không phải cấp Project.
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "project.archive");
  const project = await assertSameCompanyProject(company.id, projectId);
  if (project.status === "ARCHIVED") throw new Error("Dự án đã được lưu trữ.");

  return db.$transaction(async (tx) => {
    const updated = await tx.project.update({ where: { id: project.id }, data: { status: "ARCHIVED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PROJECT_ARCHIVED,
      targetType: "Project",
      targetId: project.id,
      companyId: company.id,
    });
    return updated;
  });
}

// ===== Read =====

export async function getProjects(actorId: string, companyId: string) {
  await requireCompanyContextForActor(actorId, companyId, "project.view");
  return db.project.findMany({
    where: { companyId },
    include: { owner: true, owningUnit: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectDetail(actorId: string, companyId: string, projectId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "project.view");
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      owningUnit: true,
      memberships: { where: { status: "ACTIVE" }, include: { user: true } },
      workItems: { orderBy: { createdAt: "desc" }, include: { assignee: true } },
    },
  });
  if (!project || project.companyId !== company.id) throw new AuthorizationError();
  return project;
}
