import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { normalizePhone, hashPhone, encryptPhone, decryptPhone } from "@/lib/crypto/phone";
import {
  assertSameCompanyCustomer,
  assertSameCompanyCustomerSource,
  assertActiveCompanyMember,
  assertSameCompanyOrganizationUnit,
} from "@/lib/domain/scope-guards";
import type { Prisma } from "@/generated/prisma";

// Domain service — Customer (CRM). Master Prompt Phần 5 mục XCVII-CXXII. Xem
// docs/domain/CUSTOMER.md.

// ===== Duplicate check =====

/** mục CXCIII: chỉ để gợi ý UI cảnh báo trùng khi tạo mới — KHÔNG BAO GIỜ
 * throw, kể cả khi phoneRaw rỗng/không hợp lệ, chỉ trả [] trong trường hợp đó. */
export async function findPossibleDuplicateCustomers(actorId: string, companyId: string, phoneRaw: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "customer.create");
  if (!phoneRaw) return [];

  const normalizedPhone = normalizePhone(phoneRaw);
  if (!normalizedPhone) return [];

  return db.customer.findMany({
    where: { companyId: company.id, phoneHash: hashPhone(normalizedPhone), status: { not: "ARCHIVED" } },
    select: { id: true, name: true },
  });
}

// ===== Create =====

const createCustomerSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(20).optional(),
  email: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  sourceId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
});

export async function createCustomer(actorId: string, input: z.input<typeof createCustomerSchema>) {
  const parsed = createCustomerSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "customer.create");

  if (parsed.sourceId) await assertSameCompanyCustomerSource(company.id, parsed.sourceId);
  if (parsed.ownerUserId) await assertActiveCompanyMember(company.id, parsed.ownerUserId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);

  // ADR-023: không có cột phone dạng plaintext — luôn hash để tra trùng +
  // mã hoá để lưu, không lưu song song bản rõ.
  const normalizedPhone = parsed.phone ? normalizePhone(parsed.phone) : undefined;

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        companyId: company.id,
        name: parsed.name,
        email: parsed.email,
        address: parsed.address,
        sourceId: parsed.sourceId,
        ownerUserId: parsed.ownerUserId,
        organizationUnitId: parsed.organizationUnitId,
        tags: parsed.tags,
        phoneHash: normalizedPhone ? hashPhone(normalizedPhone) : undefined,
        phoneCiphertext: normalizedPhone ? encryptPhone(normalizedPhone) : undefined,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CUSTOMER_CREATED,
      targetType: "Customer",
      targetId: customer.id,
      companyId: company.id,
      metadata: { name: customer.name },
    });
    return customer;
  });
}

// ===== Update =====

const updateCustomerSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  email: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  sourceId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
});

export async function updateCustomer(actorId: string, input: z.input<typeof updateCustomerSchema>) {
  const parsed = updateCustomerSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "customer.update");
  await assertSameCompanyCustomer(company.id, parsed.customerId);

  if (parsed.sourceId) await assertSameCompanyCustomerSource(company.id, parsed.sourceId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);

  const normalizedPhone = parsed.phone ? normalizePhone(parsed.phone) : undefined;

  return db.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: parsed.customerId },
      data: {
        name: parsed.name,
        email: parsed.email,
        address: parsed.address,
        sourceId: parsed.sourceId,
        organizationUnitId: parsed.organizationUnitId,
        tags: parsed.tags,
        ...(normalizedPhone
          ? { phoneHash: hashPhone(normalizedPhone), phoneCiphertext: encryptPhone(normalizedPhone) }
          : {}),
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
      targetType: "Customer",
      targetId: updated.id,
      companyId: company.id,
      metadata: { name: updated.name },
    });
    return updated;
  });
}

// ===== Owner assignment =====

const assignCustomerOwnerSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  ownerUserId: z.string().min(1),
});

/** mục XCVII: reassign owner đòi hỏi tier Manager trở lên — đã mã hoá qua
 * permission "customer.assign" (MEMBER không có), không cần check thêm ở đây. */
export async function assignCustomerOwner(actorId: string, input: z.input<typeof assignCustomerOwnerSchema>) {
  const parsed = assignCustomerOwnerSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "customer.assign");
  await assertSameCompanyCustomer(company.id, parsed.customerId);
  await assertActiveCompanyMember(company.id, parsed.ownerUserId);

  return db.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: parsed.customerId },
      data: { ownerUserId: parsed.ownerUserId },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CUSTOMER_OWNER_CHANGED,
      targetType: "Customer",
      targetId: updated.id,
      companyId: company.id,
      metadata: { ownerUserId: parsed.ownerUserId },
    });
    return updated;
  });
}

// ===== Archive / restore =====

/** mục XX/XXI: không có hard-delete cho Customer — chỉ archive/restore. */
export async function archiveCustomer(actorId: string, companyId: string, customerId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "customer.archive");
  const customer = await assertSameCompanyCustomer(company.id, customerId);
  if (customer.status === "ARCHIVED") throw new Error("Khách hàng đã được lưu trữ.");

  return db.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { status: "ARCHIVED" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CUSTOMER_ARCHIVED,
      targetType: "Customer",
      targetId: updated.id,
      companyId: company.id,
    });
    return updated;
  });
}

export async function restoreCustomer(actorId: string, companyId: string, customerId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "customer.archive");
  const customer = await assertSameCompanyCustomer(company.id, customerId);
  if (customer.status !== "ARCHIVED") throw new Error("Khách hàng này chưa được lưu trữ.");

  return db.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { status: "ACTIVE" },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
      targetType: "Customer",
      targetId: updated.id,
      companyId: company.id,
      metadata: { restored: true },
    });
    return updated;
  });
}

// ===== Interaction timeline (append-only) =====

const recordCustomerInteractionSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  type: z.enum(["CALL", "SMS", "CHAT", "MEETING", "EMAIL", "NOTE"]),
  summary: z.string().trim().min(1).max(4000),
  occurredAt: z.coerce.date().optional(),
});

/** mục CXXII: interaction TỰ NÓ là bản ghi nghiệp vụ, không audit kèm —
 * append-only, không có update/delete cho model này ở bất kỳ đâu trong file. */
export async function recordCustomerInteraction(
  actorId: string,
  input: z.input<typeof recordCustomerInteractionSchema>,
) {
  const parsed = recordCustomerInteractionSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "customer.interaction.create");
  await assertSameCompanyCustomer(company.id, parsed.customerId);

  return db.customerInteraction.create({
    data: {
      companyId: company.id,
      customerId: parsed.customerId,
      type: parsed.type,
      summary: parsed.summary,
      performedByUserId: actor.id,
      ...(parsed.occurredAt ? { occurredAt: parsed.occurredAt } : {}),
    },
  });
}

// ===== Read =====

/** ADR-022: Customer KHÔNG self-scope theo ownerUserId — bất kỳ ai có
 * customer.view đều thấy toàn bộ khách hàng của Company (khác WorkItem Phần 4). */
export async function getCustomerList(
  actorId: string,
  companyId: string,
  filters: { search?: string; status?: "ACTIVE" | "INACTIVE" | "ARCHIVED" } = {},
) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "customer.view");

  const where: Prisma.CustomerWhereInput = {
    companyId: company.id,
    status: filters.status ?? { not: "ARCHIVED" },
  };

  if (filters.search) {
    const search = filters.search.trim();
    const normalizedPhone = normalizePhone(search);
    const isPhoneLike = /^\d{8,12}$/.test(normalizedPhone);
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      ...(isPhoneLike ? [{ phoneHash: hashPhone(normalizedPhone) }] : []),
    ];
  }

  return db.customer.findMany({
    where,
    // omit SĐT đã mã hoá — danh sách không cần và không nên kéo ciphertext/
    // hash ra khỏi tầng service (red-team review Phần 5); chỉ
    // getCustomerDetail mới decrypt để hiển thị 1 record.
    omit: { phoneCiphertext: true, phoneHash: true },
    include: { owner: true, source: true, organizationUnit: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getCustomerDetail(actorId: string, companyId: string, customerId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "customer.view");
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: { owner: true, source: true, organizationUnit: true },
  });
  if (!customer || customer.companyId !== company.id) {
    throw new AuthorizationError("Khách hàng không hợp lệ trong công ty này.");
  }

  // Giải mã để hiển thị, không bao giờ trả ciphertext/hash ra ngoài service này.
  const { phoneCiphertext, phoneHash, ...rest } = customer;
  void phoneHash; // chỉ destructure để loại khỏi object trả về, không dùng giá trị
  return {
    ...rest,
    phone: phoneCiphertext ? decryptPhone(phoneCiphertext) : null,
  };
}

/** mục XXXIV: timeline là VIEW dẫn xuất (derived) — không có bảng timeline
 * hợp nhất được persist riêng, luôn ráp từ 3 nguồn tại thời điểm đọc. */
export async function getCustomerTimeline(actorId: string, companyId: string, customerId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "customer.view");
  await assertSameCompanyCustomer(company.id, customerId);

  const [interactions, appointments, sales] = await Promise.all([
    db.customerInteraction.findMany({
      where: { companyId: company.id, customerId },
      include: { performedBy: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    db.appointment.findMany({
      where: { companyId: company.id, customerId },
      orderBy: { startAt: "desc" },
      take: 200,
    }),
    db.sale.findMany({
      where: { companyId: company.id, customerId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return { interactions, appointments, sales };
}
