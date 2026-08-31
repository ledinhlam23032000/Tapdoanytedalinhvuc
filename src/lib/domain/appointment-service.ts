import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { dateKeyInTimezone } from "@/lib/domain/work-priority";
import { appointmentsOverlap } from "@/lib/domain/appointment-conflict";
import { createWorkItem, hasOpenWorkItemForAppointment } from "@/lib/domain/work-service";
import {
  assertSameCompanyCustomer,
  assertSameCompanyOrganizationUnit,
  assertActiveCompanyMember,
  assertSameCompanyAppointment,
} from "@/lib/domain/scope-guards";
import type { CompanyPermission } from "@/lib/permissions/registry";
import type { Appointment } from "@/generated/prisma";

// Domain service — Appointment. Master Prompt Phần 5 mục XLII-LIX. Xem
// docs/domain/APPOINTMENT.md.

/** work.manage-tương-đương cho Appointment: appointment.manage, hoặc chính
 * người được gán/người tạo mới được sửa/hoàn thành/huỷ 1 Appointment cụ thể. */
function canActOnAppointment(actorId: string, appointment: Appointment, permissions: Set<CompanyPermission>): boolean {
  if (permissions.has("appointment.manage")) return true;
  if (appointment.assignedUserId === actorId) return true;
  if (appointment.createdByUserId === actorId) return true;
  return false;
}

/** mục LII: kiểm tra overlap đơn giản trong bộ lịch hẹn chưa huỷ của đúng
 * assignedUserId — không xây range query DB, không engine tối ưu tài nguyên. */
async function assertNoScheduleConflict(
  companyId: string,
  assignedUserId: string,
  range: { startAt: Date; endAt: Date | null },
  excludeAppointmentId?: string,
): Promise<void> {
  const existing = await db.appointment.findMany({
    where: {
      companyId,
      assignedUserId,
      status: { notIn: ["CANCELLED"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  });
  const conflict = existing.some((other) => appointmentsOverlap(range, other));
  if (conflict) {
    throw new Error("Người được gán đã có lịch hẹn trùng giờ.");
  }
}

// ===== Create =====

const createAppointmentSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
  assignedUserId: z.string().min(1).optional(),
  type: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(200),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  location: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().min(1).max(4000).optional(),
});

export async function createAppointment(actorId: string, input: z.input<typeof createAppointmentSchema>) {
  const parsed = createAppointmentSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "appointment.create");

  if (parsed.customerId) await assertSameCompanyCustomer(company.id, parsed.customerId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  if (parsed.assignedUserId) {
    await assertActiveCompanyMember(company.id, parsed.assignedUserId);
    await assertNoScheduleConflict(company.id, parsed.assignedUserId, {
      startAt: parsed.startAt,
      endAt: parsed.endAt ?? null,
    });
  }

  return db.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        companyId: company.id,
        customerId: parsed.customerId,
        organizationUnitId: parsed.organizationUnitId,
        assignedUserId: parsed.assignedUserId,
        type: parsed.type,
        title: parsed.title,
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        location: parsed.location,
        note: parsed.note,
        status: "SCHEDULED",
        createdByUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPOINTMENT_CREATED,
      targetType: "Appointment",
      targetId: appointment.id,
      companyId: company.id,
      metadata: { title: appointment.title, startAt: appointment.startAt },
    });
    return appointment;
  });
}

// ===== Reschedule =====

const rescheduleAppointmentSchema = z.object({
  companyId: z.string().min(1),
  appointmentId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
});

export async function rescheduleAppointment(actorId: string, input: z.input<typeof rescheduleAppointmentSchema>) {
  const parsed = rescheduleAppointmentSchema.parse(input);
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, parsed.companyId, "appointment.update");
  const appointment = await assertSameCompanyAppointment(company.id, parsed.appointmentId);
  if (!canActOnAppointment(actor.id, appointment, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật lịch hẹn này.");
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED" || appointment.status === "NO_SHOW") {
    throw new Error("Không thể đổi giờ lịch hẹn đã kết thúc hoặc đã huỷ.");
  }

  if (appointment.assignedUserId) {
    await assertNoScheduleConflict(
      company.id,
      appointment.assignedUserId,
      { startAt: parsed.startAt, endAt: parsed.endAt ?? null },
      appointment.id,
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: { startAt: parsed.startAt, endAt: parsed.endAt },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPOINTMENT_RESCHEDULED,
      targetType: "Appointment",
      targetId: appointment.id,
      companyId: company.id,
      metadata: { startAt: updated.startAt },
    });
    return updated;
  });
}

// ===== Complete / Cancel / No-show =====

export async function completeAppointment(actorId: string, companyId: string, appointmentId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "appointment.update");
  const appointment = await assertSameCompanyAppointment(company.id, appointmentId);
  if (!canActOnAppointment(actor.id, appointment, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật lịch hẹn này.");
  }
  if (appointment.status !== "SCHEDULED" && appointment.status !== "CONFIRMED") {
    throw new Error("Lịch hẹn này đã kết thúc hoặc đã huỷ.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPOINTMENT_COMPLETED,
      targetType: "Appointment",
      targetId: appointment.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function cancelAppointment(actorId: string, companyId: string, appointmentId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "appointment.update");
  const appointment = await assertSameCompanyAppointment(company.id, appointmentId);
  if (!canActOnAppointment(actor.id, appointment, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật lịch hẹn này.");
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    throw new Error("Lịch hẹn này đã kết thúc hoặc đã huỷ.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPOINTMENT_CANCELLED,
      targetType: "Appointment",
      targetId: appointment.id,
      companyId: company.id,
    });
    return updated;
  });
}

/** mục L/LVII/CLXXXIV/CLXXXV: No-show tự động sinh 1 WorkItem theo dõi —
 * tạo SAU khi transaction chính commit (Prisma không nest transaction), và
 * idempotent qua hasOpenWorkItemForAppointment để không tạo trùng khi xử lý
 * lại cùng 1 sự kiện. */
export async function markNoShow(actorId: string, companyId: string, appointmentId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "appointment.update");
  const appointment = await assertSameCompanyAppointment(company.id, appointmentId);
  if (!canActOnAppointment(actor.id, appointment, permissions)) {
    throw new AuthorizationError("Bạn không có quyền cập nhật lịch hẹn này.");
  }
  if (appointment.status !== "SCHEDULED" && appointment.status !== "CONFIRMED") {
    throw new Error("Chỉ có thể đánh dấu Không đến cho lịch hẹn chưa kết thúc.");
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "NO_SHOW" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.APPOINTMENT_NO_SHOW,
      targetType: "Appointment",
      targetId: appointment.id,
      companyId: company.id,
    });
    return result;
  });

  const alreadyHasFollowUp = await hasOpenWorkItemForAppointment(company.id, appointment.id);
  if (!alreadyHasFollowUp) {
    await createWorkItem(actorId, {
      companyId: company.id,
      customerId: appointment.customerId ?? undefined,
      appointmentId: appointment.id,
      title: "Theo dõi khách không đến hẹn: " + appointment.title,
      priority: "HIGH",
      assigneeUserId: appointment.assignedUserId ?? actorId,
    });
  }

  return updated;
}

// ===== Read =====

/** ADR-022: Appointment KHÔNG self-scope theo assignedUserId — bất kỳ ai có
 * appointment.view đều thấy toàn bộ lịch hẹn của Company (khác WorkItem
 * Phần 4). */
export async function getAppointmentList(
  actorId: string,
  companyId: string,
  filters: { view?: "today" | "upcoming" | "completed" | "no_show" } = {},
  now: Date = new Date(),
) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "appointment.view");

  if (filters.view === "today") {
    const appointments = await db.appointment.findMany({
      where: { companyId: company.id, status: { notIn: ["CANCELLED"] } },
      include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } }, assignedUser: true, organizationUnit: true },
      orderBy: { startAt: "asc" },
      take: 500,
    });
    const todayKey = dateKeyInTimezone(now, company.timezone);
    return appointments.filter((a) => dateKeyInTimezone(a.startAt, company.timezone) === todayKey);
  }

  if (filters.view === "upcoming") {
    return db.appointment.findMany({
      where: { companyId: company.id, startAt: { gte: now }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } }, assignedUser: true, organizationUnit: true },
      orderBy: { startAt: "asc" },
      take: 200,
    });
  }

  if (filters.view === "completed") {
    return db.appointment.findMany({
      where: { companyId: company.id, status: "COMPLETED" },
      include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } }, assignedUser: true, organizationUnit: true },
      orderBy: { startAt: "desc" },
      take: 200,
    });
  }

  if (filters.view === "no_show") {
    return db.appointment.findMany({
      where: { companyId: company.id, status: "NO_SHOW" },
      include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } }, assignedUser: true, organizationUnit: true },
      orderBy: { startAt: "desc" },
      take: 200,
    });
  }

  return db.appointment.findMany({
    where: { companyId: company.id },
    include: { customer: true, assignedUser: true, organizationUnit: true },
    orderBy: { startAt: "desc" },
    take: 200,
  });
}

/** "Lịch hẹn của tôi hôm nay" (mục CVII) — self-scope tường minh theo thiết
 * kế, khác với getAppointmentList company-wide ở trên. */
export async function getMyAppointmentsToday(actorId: string, companyId: string, now: Date) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "appointment.view");
  const appointments = await db.appointment.findMany({
    where: { companyId: company.id, assignedUserId: actor.id, status: { notIn: ["CANCELLED"] } },
    include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } } },
    orderBy: { startAt: "asc" },
  });
  const todayKey = dateKeyInTimezone(now, company.timezone);
  return appointments.filter((a) => dateKeyInTimezone(a.startAt, company.timezone) === todayKey);
}

export async function getAppointmentDetail(actorId: string, companyId: string, appointmentId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "appointment.view");
  await assertSameCompanyAppointment(company.id, appointmentId);
  return db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      customer: { omit: { phoneCiphertext: true, phoneHash: true } },
      assignedUser: true,
      organizationUnit: true,
      createdBy: true,
    },
  });
}
