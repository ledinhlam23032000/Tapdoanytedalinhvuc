import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { assertSameCompanyOrganizationUnit as assertSameCompanyUnit, assertActiveCompanyMember } from "@/lib/domain/scope-guards";

// Domain service — Organization (OrganizationUnit + Position + Assignment).
// Master Prompt Phần 4 mục V-XXV. Xem docs/domain/ORGANIZATION.md và
// ADR-013 (Position là template Company, không gắn Unit).

// ===== OrganizationUnit =====

const createUnitSchema = z.object({
  companyId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  type: z.enum(["BRANCH", "DEPARTMENT", "TEAM", "FUNCTION", "BUSINESS_UNIT"]),
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(120),
});

export async function createOrganizationUnit(actorId: string, input: z.input<typeof createUnitSchema>) {
  const parsed = createUnitSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "organization.manage");

  if (parsed.parentId) {
    await assertSameCompanyUnit(company.id, parsed.parentId);
    // Không cần chống cycle khi TẠO MỚI — unit mới chưa có con nào có thể trỏ
    // ngược lại nó. Cycle chỉ có thể xảy ra khi MOVE (mục XI), chưa implement
    // Phần 4 (mục XI cho phép defer).
  }

  return db.$transaction(async (tx) => {
    const unit = await tx.organizationUnit.create({
      data: {
        companyId: company.id,
        parentId: parsed.parentId,
        type: parsed.type,
        code: parsed.code,
        name: parsed.name,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.ORG_UNIT_CREATED,
      targetType: "OrganizationUnit",
      targetId: unit.id,
      companyId: company.id,
      metadata: { name: unit.name, type: unit.type },
    });
    return unit;
  });
}

export async function archiveOrganizationUnit(actorId: string, companyId: string, unitId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "organization.manage");
  const unit = await assertSameCompanyUnit(company.id, unitId);
  if (unit.status === "ARCHIVED") throw new Error("Đơn vị đã được lưu trữ.");

  const activeChildren = await db.organizationUnit.count({ where: { parentId: unit.id, status: "ACTIVE" } });
  if (activeChildren > 0) {
    throw new Error("Không thể lưu trữ đơn vị còn đơn vị con đang hoạt động. Hãy lưu trữ đơn vị con trước.");
  }
  const activeAssignments = await db.assignment.count({
    where: { organizationUnitId: unit.id, status: "ACTIVE" },
  });
  if (activeAssignments > 0) {
    throw new Error("Không thể lưu trữ đơn vị còn nhân sự đang được gán. Hãy kết thúc các phân công trước.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.organizationUnit.update({ where: { id: unit.id }, data: { status: "ARCHIVED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.ORG_UNIT_ARCHIVED,
      targetType: "OrganizationUnit",
      targetId: unit.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function getOrganizationTree(actorId: string, companyId: string) {
  await requireCompanyContextForActor(actorId, companyId, "organization.view");
  return db.organizationUnit.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
}

// ===== Position =====

const createPositionSchema = z.object({
  companyId: z.string().min(1),
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(120),
});

export async function createPosition(actorId: string, input: z.input<typeof createPositionSchema>) {
  const parsed = createPositionSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "organization.manage");

  return db.$transaction(async (tx) => {
    const position = await tx.position.create({
      data: { companyId: company.id, code: parsed.code, name: parsed.name },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.POSITION_CREATED,
      targetType: "Position",
      targetId: position.id,
      companyId: company.id,
      metadata: { name: position.name },
    });
    return position;
  });
}

export async function archivePosition(actorId: string, companyId: string, positionId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "organization.manage");
  const position = await assertSameCompanyPosition(company.id, positionId);
  if (position.status === "ARCHIVED") throw new Error("Vị trí đã được lưu trữ.");

  const activeAssignments = await db.assignment.count({ where: { positionId: position.id, status: "ACTIVE" } });
  if (activeAssignments > 0) {
    throw new Error("Không thể lưu trữ vị trí còn người đang giữ. Hãy kết thúc các phân công trước.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id: position.id }, data: { status: "ARCHIVED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.POSITION_ARCHIVED,
      targetType: "Position",
      targetId: position.id,
      companyId: company.id,
    });
    return updated;
  });
}

async function assertSameCompanyPosition(companyId: string, positionId: string) {
  const position = await db.position.findUnique({ where: { id: positionId } });
  if (!position || position.companyId !== companyId) {
    throw new AuthorizationError("Vị trí không hợp lệ trong công ty này.");
  }
  return position;
}

export async function getPositions(actorId: string, companyId: string) {
  await requireCompanyContextForActor(actorId, companyId, "organization.view");
  return db.position.findMany({ where: { companyId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
}

// ===== Assignment =====

const createAssignmentSchema = z.object({
  companyId: z.string().min(1),
  userId: z.string().min(1),
  positionId: z.string().min(1),
  organizationUnitId: z.string().min(1).optional(),
});

export async function createAssignment(actorId: string, input: z.input<typeof createAssignmentSchema>) {
  const parsed = createAssignmentSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "people.assign");

  // Bất biến XVIII: user phải có CompanyMembership ACTIVE trước khi có
  // Assignment active — Assignment không tự cấp quyền, nhưng cũng không nên
  // tồn tại độc lập với tư cách thành viên.
  await assertActiveCompanyMember(company.id, parsed.userId);

  const position = await assertSameCompanyPosition(company.id, parsed.positionId);
  if (position.status !== "ACTIVE") throw new Error("Vị trí này đã được lưu trữ, không thể gán mới.");

  if (parsed.organizationUnitId) {
    const unit = await assertSameCompanyUnit(company.id, parsed.organizationUnitId);
    if (unit.status !== "ACTIVE") throw new Error("Đơn vị này đã được lưu trữ, không thể gán mới.");
  }

  return db.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: {
        companyId: company.id,
        userId: parsed.userId,
        positionId: parsed.positionId,
        organizationUnitId: parsed.organizationUnitId,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.ASSIGNMENT_CREATED,
      targetType: "Assignment",
      targetId: assignment.id,
      companyId: company.id,
      metadata: { targetUserId: parsed.userId, positionId: parsed.positionId },
    });
    return assignment;
  });
}

export async function endAssignment(actorId: string, companyId: string, assignmentId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "people.assign");
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.companyId !== company.id) throw new AuthorizationError();
  if (assignment.status === "ENDED") throw new Error("Phân công này đã kết thúc.");

  return db.$transaction(async (tx) => {
    const updated = await tx.assignment.update({
      where: { id: assignment.id },
      data: { status: "ENDED", endAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.ASSIGNMENT_ENDED,
      targetType: "Assignment",
      targetId: assignment.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function getCompanyPeople(actorId: string, companyId: string) {
  await requireCompanyContextForActor(actorId, companyId, "people.view");
  return db.assignment.findMany({
    where: { companyId, status: "ACTIVE" },
    include: { user: true, position: true, organizationUnit: true },
    orderBy: { createdAt: "asc" },
  });
}
