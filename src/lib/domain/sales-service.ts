import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { calculateSaleTotals, calculateLineTotal } from "@/lib/domain/sale-totals";
import {
  assertSameCompanyCustomer,
  assertSameCompanyOrganizationUnit,
  assertSameCompanyProject,
  assertActiveCompanyMember,
  assertSameCompanyCatalogItem,
  assertSameCompanySale,
} from "@/lib/domain/scope-guards";
import type { CatalogItemType, SaleStatus } from "@/generated/prisma";

// Domain service — Catalog + Sale/SaleLine. Master Prompt Phần 5 mục
// LX-LXXXIII. Xem docs/domain/SALES.md. Sale là thực tế thương mại — KHÔNG
// phải Payment, KHÔNG phải Ledger, KHÔNG tự tính hoa hồng (Phần 6). Mọi phép
// tính tiền đi qua calculateSaleTotals/calculateLineTotal (ADR-021: không có
// rule engine chiết khấu/hoa hồng chung — SaleLine.discountAmount chỉ là 1
// số phẳng). Không tự viết lại công thức tính tiền ở đây dưới bất kỳ hình
// thức nào — kể cả tưởng như tương đương — sau khi red-team review Phần 5
// phát hiện 1 bản sao công thức tay từng lệch kết quả với hàm đã unit-test.

// ===== Catalog =====

const createCatalogItemSchema = z.object({
  companyId: z.string().min(1),
  code: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200),
  type: z.enum(["PRODUCT", "SERVICE"]),
  defaultPrice: z.number().nonnegative().optional(),
});

export async function createCatalogItem(actorId: string, input: z.input<typeof createCatalogItemSchema>) {
  const parsed = createCatalogItemSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "catalog.manage");

  return db.$transaction(async (tx) => {
    const item = await tx.catalogItem.create({
      data: {
        companyId: company.id,
        code: parsed.code,
        name: parsed.name,
        type: parsed.type as CatalogItemType,
        defaultPrice: parsed.defaultPrice,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CATALOG_ITEM_CREATED,
      targetType: "CatalogItem",
      targetId: item.id,
      companyId: company.id,
      metadata: { name: item.name },
    });
    return item;
  });
}

const updateCatalogItemSchema = z.object({
  companyId: z.string().min(1),
  catalogItemId: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  defaultPrice: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

/** mục LXXII: đổi defaultPrice ở đây KHÔNG BAO GIỜ hồi tố SaleLine.unitPrice
 * đã tạo — SaleLine là snapshot bất biến, file này không có code path nào
 * sửa nó sau khi tạo ngoại trừ updateDraftSale thay-toàn-bộ khi còn DRAFT. */
export async function updateCatalogItem(actorId: string, input: z.input<typeof updateCatalogItemSchema>) {
  const parsed = updateCatalogItemSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "catalog.manage");
  const item = await assertSameCompanyCatalogItem(company.id, parsed.catalogItemId);

  return db.$transaction(async (tx) => {
    const updated = await tx.catalogItem.update({
      where: { id: item.id },
      data: {
        name: parsed.name,
        defaultPrice: parsed.defaultPrice,
        active: parsed.active,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.CATALOG_ITEM_UPDATED,
      targetType: "CatalogItem",
      targetId: updated.id,
      companyId: company.id,
      metadata: { name: updated.name },
    });
    return updated;
  });
}

export async function getCatalogItems(
  actorId: string,
  companyId: string,
  filters: { activeOnly?: boolean } = {},
) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "catalog.view");
  const activeOnly = filters.activeOnly ?? true;
  return db.catalogItem.findMany({
    where: { companyId: company.id, ...(activeOnly ? { active: true } : {}) },
    orderBy: { name: "asc" },
  });
}

// ===== Sale =====

// Chặn trên hợp lý để quantity * unitPrice không bao giờ tiến gần
// Number.MAX_SAFE_INTEGER dù cộng dồn nhiều dòng — không phải giới hạn
// nghiệp vụ thật, chỉ là biên an toàn số học (red-team review Phần 5).
const saleLineInputSchema = z.object({
  catalogItemId: z.string().min(1).optional(),
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(100_000),
  unitPrice: z.number().nonnegative().max(1_000_000_000),
  discountAmount: z.number().nonnegative().max(1_000_000_000).optional(),
});

/** Xác nhận mọi dòng có catalogItemId đều thuộc đúng company và còn bán
 * (active) — chặn thêm sản phẩm/dịch vụ đã ngừng bán vào giao dịch mới. */
async function assertLinesUsableCatalogItems(companyId: string, lines: z.infer<typeof saleLineInputSchema>[]) {
  for (const line of lines) {
    if (!line.catalogItemId) continue;
    const catalogItem = await assertSameCompanyCatalogItem(companyId, line.catalogItemId);
    if (!catalogItem.active) {
      throw new Error("Sản phẩm/dịch vụ này đã ngừng bán, không thể thêm vào giao dịch mới.");
    }
  }
}

function buildLineTotals(lines: z.infer<typeof saleLineInputSchema>[]) {
  return lines.map((line) => ({
    ...line,
    lineTotal: calculateLineTotal(line),
  }));
}

const createSaleSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  salespersonUserId: z.string().min(1).optional(),
  lines: z.array(saleLineInputSchema),
});

/** mục LXVI: Sale DRAFT sửa tự do, lines có thể để trống lúc tạo và bổ sung
 * sau qua updateDraftSale. */
export async function createSale(actorId: string, input: z.input<typeof createSaleSchema>) {
  const parsed = createSaleSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "sales.create");

  if (parsed.customerId) await assertSameCompanyCustomer(company.id, parsed.customerId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  if (parsed.projectId) await assertSameCompanyProject(company.id, parsed.projectId);
  if (parsed.salespersonUserId) await assertActiveCompanyMember(company.id, parsed.salespersonUserId);
  await assertLinesUsableCatalogItems(company.id, parsed.lines);

  const totals = calculateSaleTotals(parsed.lines);
  const linesWithTotal = buildLineTotals(parsed.lines);
  const salespersonUserId = parsed.salespersonUserId ?? actor.id;

  return db.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        companyId: company.id,
        customerId: parsed.customerId,
        organizationUnitId: parsed.organizationUnitId,
        projectId: parsed.projectId,
        salespersonUserId,
        status: "DRAFT",
        subtotalAmount: totals.subtotalAmount,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount,
        lines: {
          create: linesWithTotal.map((line) => ({
            catalogItemId: line.catalogItemId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount ?? 0,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: { lines: true },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.SALE_CREATED,
      targetType: "Sale",
      targetId: sale.id,
      companyId: company.id,
      metadata: { totalAmount: totals.totalAmount },
    });
    return sale;
  });
}

const updateDraftSaleSchema = z.object({
  companyId: z.string().min(1),
  saleId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  organizationUnitId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  salespersonUserId: z.string().min(1).optional(),
  lines: z.array(saleLineInputSchema).optional(),
});

export async function updateDraftSale(actorId: string, input: z.input<typeof updateDraftSaleSchema>) {
  const parsed = updateDraftSaleSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "sales.update");
  const sale = await assertSameCompanySale(company.id, parsed.saleId);
  if (sale.status !== "DRAFT") {
    throw new Error("Chỉ có thể sửa giao dịch đang ở trạng thái Nháp.");
  }

  if (parsed.customerId) await assertSameCompanyCustomer(company.id, parsed.customerId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  if (parsed.projectId) await assertSameCompanyProject(company.id, parsed.projectId);
  if (parsed.salespersonUserId) await assertActiveCompanyMember(company.id, parsed.salespersonUserId);
  if (parsed.lines) await assertLinesUsableCatalogItems(company.id, parsed.lines);

  const totals = parsed.lines ? calculateSaleTotals(parsed.lines) : null;
  const linesWithTotal = parsed.lines ? buildLineTotals(parsed.lines) : null;

  return db.$transaction(async (tx) => {
    if (linesWithTotal) {
      await tx.saleLine.deleteMany({ where: { saleId: sale.id } });
      await tx.saleLine.createMany({
        data: linesWithTotal.map((line) => ({
          saleId: sale.id,
          catalogItemId: line.catalogItemId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount ?? 0,
          lineTotal: line.lineTotal,
        })),
      });
    }

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        customerId: parsed.customerId,
        organizationUnitId: parsed.organizationUnitId,
        projectId: parsed.projectId,
        salespersonUserId: parsed.salespersonUserId,
        ...(totals
          ? {
              subtotalAmount: totals.subtotalAmount,
              discountAmount: totals.discountAmount,
              totalAmount: totals.totalAmount,
            }
          : {}),
      },
      include: { lines: true },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.SALE_UPDATED,
      targetType: "Sale",
      targetId: updated.id,
      companyId: company.id,
    });
    return updated;
  });
}

/** Nơi DUY NHẤT status chuyển thành CONFIRMED — updateDraftSale đã từ chối
 * sửa Sale không còn DRAFT, nên Sale đã confirm được bảo vệ khỏi bị âm thầm
 * sửa đổi về mặt cấu trúc. */
export async function confirmSale(actorId: string, companyId: string, saleId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "sales.confirm");
  const sale = await assertSameCompanySale(company.id, saleId);
  if (sale.status !== "DRAFT") {
    throw new Error("Giao dịch này đã được xác nhận hoặc đã huỷ.");
  }
  const lines = await db.saleLine.findMany({ where: { saleId: sale.id } });
  if (lines.length === 0) {
    throw new Error("Giao dịch cần có ít nhất 1 dòng để xác nhận.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.SALE_CONFIRMED,
      targetType: "Sale",
      targetId: updated.id,
      companyId: company.id,
      metadata: { totalAmount: updated.totalAmount.toString() },
    });
    return updated;
  });
}

/** mục LXVII: huỷ chứ không bao giờ xoá — hoạt động từ cả DRAFT lẫn
 * CONFIRMED. */
export async function cancelSale(actorId: string, companyId: string, saleId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "sales.cancel");
  const sale = await assertSameCompanySale(company.id, saleId);
  if (sale.status === "CANCELLED") {
    throw new Error("Giao dịch này đã được huỷ.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.SALE_CANCELLED,
      targetType: "Sale",
      targetId: updated.id,
      companyId: company.id,
    });
    return updated;
  });
}

/** ADR-022: Sale KHÔNG self-scope theo salespersonUserId — bất kỳ ai có
 * sales.view đều thấy toàn bộ giao dịch của Company. */
export async function getSaleList(
  actorId: string,
  companyId: string,
  filters: { status?: SaleStatus } = {},
) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "sales.view");
  return db.sale.findMany({
    where: { companyId: company.id, ...(filters.status ? { status: filters.status } : {}) },
    // omit phoneCiphertext/phoneHash trên Customer lồng — Sale list/detail
    // không cần và không nên kéo theo dữ liệu SĐT đã mã hoá ra khỏi tầng
    // service (red-team review Phần 5 — chỉ getCustomerDetail/getLeadDetail
    // mới được phép chạm 2 field này).
    include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } }, salesperson: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getSaleDetail(actorId: string, companyId: string, saleId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "sales.view");
  await assertSameCompanySale(company.id, saleId);
  return db.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: { omit: { phoneCiphertext: true, phoneHash: true } },
      salesperson: true,
      organizationUnit: true,
      project: true,
      lines: { include: { catalogItem: true } },
    },
  });
}
