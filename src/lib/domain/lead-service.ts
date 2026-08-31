import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { normalizePhone, hashPhone, encryptPhone, decryptPhone } from "@/lib/crypto/phone";
import { createWorkItem } from "@/lib/domain/work-service";
import { assertSameCompanyCustomerSource, assertActiveCompanyMember } from "@/lib/domain/scope-guards";
import type { Lead, LeadStatus } from "@/generated/prisma";

// Domain service — Lead. Master Prompt Phần 5 mục IX-XIII. Lead là entity
// thật, tách biệt Customer (ADR-017, bằng chứng L-C04 trong
// LEGACY_CAPABILITY_MATRIX.md) — "khách tiềm năng chưa xác minh" khác hẳn
// "khách hàng thật". Converted Lead KHÔNG BAO GIỜ bị xoá (mục XIII, giữ lịch
// sử chuyển đổi). Xem docs/domain/LEAD.md.

async function assertSameCompanyLead(companyId: string, leadId: string): Promise<Lead> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.companyId !== companyId) {
    throw new AuthorizationError("Lead không hợp lệ trong công ty này.");
  }
  return lead;
}

// ===== Create =====

const createLeadSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(30).optional(),
  email: z.string().trim().min(1).max(200).optional(),
  sourceId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
});

export async function createLead(actorId: string, input: z.input<typeof createLeadSchema>) {
  const parsed = createLeadSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "lead.create");

  if (parsed.sourceId) await assertSameCompanyCustomerSource(company.id, parsed.sourceId);
  if (parsed.ownerUserId) await assertActiveCompanyMember(company.id, parsed.ownerUserId);

  // Cùng pattern mã hoá SĐT với Customer (ADR-023) — không có cột phone
  // plaintext trên Lead.
  let phoneHash: string | undefined;
  let phoneCiphertext: string | undefined;
  if (parsed.phone) {
    const normalized = normalizePhone(parsed.phone);
    phoneHash = hashPhone(normalized);
    phoneCiphertext = encryptPhone(normalized);
  }

  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        companyId: company.id,
        name: parsed.name,
        phoneHash,
        phoneCiphertext,
        email: parsed.email,
        sourceId: parsed.sourceId,
        ownerUserId: parsed.ownerUserId,
        status: "NEW",
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.LEAD_CREATED,
      targetType: "Lead",
      targetId: lead.id,
      companyId: company.id,
      metadata: { name: lead.name },
    });
    return lead;
  });
}

// ===== Assign owner =====

const assignLeadOwnerSchema = z.object({
  companyId: z.string().min(1),
  leadId: z.string().min(1),
  ownerUserId: z.string().min(1),
});

export async function assignLeadOwner(actorId: string, input: z.input<typeof assignLeadOwnerSchema>) {
  const parsed = assignLeadOwnerSchema.parse(input);
  const { company } = await requireCompanyContextForActor(actorId, parsed.companyId, "lead.assign");
  const lead = await assertSameCompanyLead(company.id, parsed.leadId);
  await assertActiveCompanyMember(company.id, parsed.ownerUserId);

  // Không có audit action riêng cho "đổi chủ Lead" trong danh sách đóng
  // AUDIT_ACTIONS (khác CUSTOMER_OWNER_CHANGED của Customer) — cố ý bỏ qua
  // recordAudit ở đây, không tự thêm action mới ngoài spec.
  return db.$transaction(async (tx) => {
    return tx.lead.update({
      where: { id: lead.id },
      data: { ownerUserId: parsed.ownerUserId },
    });
  });
}

// ===== Convert =====

export async function convertLead(actorId: string, companyId: string, leadId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "lead.convert");
  const lead = await assertSameCompanyLead(company.id, leadId);

  if (lead.status === "CONVERTED") {
    throw new Error("Lead này đã được chuyển đổi thành khách hàng.");
  }
  if (lead.status === "LOST") {
    throw new Error("Không thể chuyển đổi Lead đã đánh dấu Mất.");
  }

  const { updatedLead, customer } = await db.$transaction(async (tx) => {
    // Dedup theo phoneHash trong cùng Company trước khi tạo Customer mới
    // (mục XII bước 2) — tránh 1 SĐT sinh nhiều Customer trùng khi convert.
    let customer = lead.phoneHash
      ? await tx.customer.findFirst({
          where: { companyId: company.id, phoneHash: lead.phoneHash, status: { not: "ARCHIVED" } },
        })
      : null;

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          companyId: company.id,
          name: lead.name,
          phoneCiphertext: lead.phoneCiphertext,
          phoneHash: lead.phoneHash,
          email: lead.email,
          sourceId: lead.sourceId,
          ownerUserId: lead.ownerUserId,
        },
      });
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.CUSTOMER_CREATED,
        targetType: "Customer",
        targetId: customer.id,
        companyId: company.id,
        metadata: { name: lead.name, convertedFromLeadId: lead.id },
      });
    }

    const updatedLead = await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED", convertedCustomerId: customer.id, convertedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.LEAD_CONVERTED,
      targetType: "Lead",
      targetId: lead.id,
      companyId: company.id,
      metadata: { customerId: customer.id },
    });

    return { updatedLead, customer };
  });

  // Sau khi transaction chính commit (Prisma không nest transaction) —
  // createWorkItem tự mở transaction riêng, tự re-validate mọi id (mục XII
  // bước 6). Không try/catch: nếu bước này thất bại, Lead/Customer đã commit
  // là tradeoff đã biết của Phần 5, không phải lỗi cần né tránh ở đây.
  await createWorkItem(actorId, {
    companyId: company.id,
    customerId: customer.id,
    title: "Liên hệ khách hàng mới chuyển đổi: " + lead.name,
    priority: "NORMAL",
    assigneeUserId: lead.ownerUserId ?? undefined,
  });

  return { lead: updatedLead, customer };
}

// ===== Read =====

/** ADR-022: company-wide, không lọc theo ownerUserId — bất kỳ ai có
 * lead.view đều thấy toàn bộ Lead của Company. */
export async function getLeadList(actorId: string, companyId: string, filters: { status?: LeadStatus } = {}) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "lead.view");
  return db.lead.findMany({
    where: { companyId: company.id, status: filters.status },
    // omit SĐT đã mã hoá khỏi danh sách — cùng lý do với getCustomerList.
    omit: { phoneCiphertext: true, phoneHash: true },
    include: { owner: true, source: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getLeadDetail(actorId: string, companyId: string, leadId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "lead.view");
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { owner: true, source: true, convertedCustomer: true },
  });
  if (!lead || lead.companyId !== company.id) throw new AuthorizationError();

  // Giải mã SĐT ra field "phone" tính toán — không trả phoneCiphertext/
  // phoneHash thô ra ngoài service layer.
  const { phoneCiphertext, phoneHash, ...rest } = lead;
  void phoneHash; // chỉ destructure để loại khỏi object trả về, không dùng giá trị
  return {
    ...rest,
    phone: phoneCiphertext ? decryptPhone(phoneCiphertext) : null,
  };
}
