import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  assertSameCompanySale,
  assertSameCompanyOrganizationUnit,
  assertSameCompanyProject,
  assertSameCompanyPayment,
  assertSameCompanyExpense,
  assertSameCompanyLedgerEntry,
} from "@/lib/domain/scope-guards";
import type {
  ExpenseCategory,
  ExpenseSourceType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma";

// Domain service — Finance (Payment + Expense + LedgerEntry + Receivable).
// Master Prompt Phần 6 — HIGH RISK / VERY HIGH RISK. LedgerEntry là nguồn sự
// thật tài chính duy nhất, BẤT BIẾN (chỉ Void hoặc correction, không sửa/xoá
// — ADR-024). Sale ≠ Payment ≠ Ledger, KHÔNG dùng 1 bảng đại diện cả ba
// (ADR-025). Receivable/công nợ KHÔNG có bảng riêng — luôn derive từ
// Sale.totalAmount trừ tổng Payment còn hiệu lực (ADR-026). Xem
// docs/domain/FINANCE.md.

// ===== Payment =====

const recordPaymentSchema = z.object({
  companyId: z.string().min(1),
  saleId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "EWALLET", "OTHER"]).optional(),
  occurredAt: z.coerce.date().optional(),
  reference: z.string().trim().min(1).max(500).optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export async function recordPayment(actorId: string, input: z.input<typeof recordPaymentSchema>) {
  const parsed = recordPaymentSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "finance.payment.create");
  const sale = await assertSameCompanySale(company.id, parsed.saleId);
  if (sale.status !== "CONFIRMED") {
    throw new Error("Chỉ có thể ghi nhận thanh toán cho giao dịch đã xác nhận.");
  }

  return db.$transaction(async (tx) => {
    // Khoá row Sale (SELECT...FOR UPDATE) TRƯỚC khi đọc tổng đã thu — chỉ
    // tính lại trong transaction (dòng cũ) KHÔNG đủ dưới Postgres READ
    // COMMITTED mặc định: 2 transaction đồng thời vẫn có thể cùng đọc cùng
    // 1 baseline trước khi bên nào commit INSERT, cả 2 đều pass check rồi
    // cùng ghi → overpayment thật (phát hiện qua adversarial review, không
    // phải giả định — xem RED_TEAM_CODE_REVIEW_PART6.md). Lock ép request
    // thứ 2 phải đợi request thứ 1 commit xong mới được đọc tiếp.
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${sale.id} FOR UPDATE`;
    const paidAggregate = await tx.payment.aggregate({
      _sum: { amount: true },
      where: { saleId: sale.id, status: "POSTED" },
    });
    const alreadyPaid = Number(paidAggregate._sum.amount ?? 0);
    if (alreadyPaid + parsed.amount > Number(sale.totalAmount)) {
      throw new Error("Số tiền thanh toán vượt quá số còn phải thu.");
    }

    const payment = await tx.payment.create({
      data: {
        companyId: company.id,
        saleId: sale.id,
        amount: parsed.amount,
        method: (parsed.method as PaymentMethod | undefined) ?? undefined,
        occurredAt: parsed.occurredAt,
        reference: parsed.reference,
        idempotencyKey: parsed.idempotencyKey,
        createdByUserId: actor.id,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        companyId: company.id,
        type: "SALE_RECEIPT" as LedgerEntryType,
        amount: payment.amount,
        occurredAt: payment.occurredAt,
        sourceType: "PAYMENT" as LedgerSourceType,
        sourceId: payment.id,
        customerId: sale.customerId ?? undefined,
        organizationUnitId: sale.organizationUnitId ?? undefined,
        projectId: sale.projectId ?? undefined,
        createdByUserId: actor.id,
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYMENT_RECORDED,
      targetType: "Payment",
      targetId: payment.id,
      companyId: company.id,
      metadata: { saleId: sale.id, amount: Number(payment.amount) },
    });
    return payment;
  });
}

export async function voidPayment(actorId: string, companyId: string, paymentId: string, reason: string) {
  if (!reason?.trim()) {
    throw new Error("Phải nhập lý do khi huỷ khoản thanh toán.");
  }
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "finance.payment.void");
  const payment = await assertSameCompanyPayment(company.id, paymentId);
  if (payment.status !== "POSTED") {
    throw new Error("Khoản thanh toán này đã bị huỷ trước đó.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "VOID", voidedAt: new Date(), voidedByUserId: actor.id, voidReason: reason },
    });
    await tx.ledgerEntry.updateMany({
      where: { sourceType: "PAYMENT", sourceId: payment.id, status: "POSTED" },
      data: { status: "VOID", voidedAt: new Date(), voidedByUserId: actor.id, voidReason: reason },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYMENT_VOIDED,
      targetType: "Payment",
      targetId: payment.id,
      companyId: company.id,
      metadata: { reason },
    });
    return updated;
  });
}

// ===== Expense =====

const recordExpenseSchema = z.object({
  companyId: z.string().min(1),
  category: z.enum(["RENT", "MARKETING", "SALARY", "SUPPLIES", "UTILITIES", "OTHER"]),
  amount: z.number().positive(),
  occurredAt: z.coerce.date().optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  organizationUnitId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

export async function recordExpense(actorId: string, input: z.input<typeof recordExpenseSchema>) {
  const parsed = recordExpenseSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "finance.expense.create");
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  if (parsed.projectId) await assertSameCompanyProject(company.id, parsed.projectId);

  return db.$transaction(async (tx) => {
    const expense = await createExpenseRecordTx(tx, {
      companyId: company.id,
      category: parsed.category as ExpenseCategory,
      amount: parsed.amount,
      occurredAt: parsed.occurredAt,
      description: parsed.description,
      organizationUnitId: parsed.organizationUnitId,
      projectId: parsed.projectId,
      sourceType: "MANUAL",
      createdByUserId: actor.id,
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.EXPENSE_RECORDED,
      targetType: "Expense",
      targetId: expense.id,
      companyId: company.id,
      metadata: { category: expense.category, amount: Number(expense.amount) },
    });
    return expense;
  });
}

export async function voidExpense(actorId: string, companyId: string, expenseId: string, reason: string) {
  if (!reason?.trim()) {
    throw new Error("Phải nhập lý do khi huỷ khoản chi.");
  }
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "finance.expense.void");
  const expense = await assertSameCompanyExpense(company.id, expenseId);
  if (expense.status !== "POSTED") {
    throw new Error("Khoản chi này đã bị huỷ trước đó.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: { status: "VOID", voidedAt: new Date(), voidedByUserId: actor.id, voidReason: reason },
    });
    await tx.ledgerEntry.updateMany({
      where: { sourceType: "EXPENSE", sourceId: expense.id, status: "POSTED" },
      data: { status: "VOID", voidedAt: new Date(), voidedByUserId: actor.id, voidReason: reason },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.EXPENSE_VOIDED,
      targetType: "Expense",
      targetId: expense.id,
      companyId: company.id,
      metadata: { reason },
    });
    return updated;
  });
}

// ===== LedgerEntry correction =====

const createLedgerCorrectionSchema = z.object({
  companyId: z.string().min(1),
  correctionOfEntryId: z.string().min(1),
  type: z.enum(["SALE_RECEIPT", "EXPENSE", "SALARY_PAYMENT", "REFUND", "ADJUSTMENT", "OTHER"]),
  amount: z.number().positive(),
  reason: z.string().trim().min(1).max(2000),
  sourceType: z.enum(["SALE", "PAYMENT", "EXPENSE", "PAYROLL_RUN", "MANUAL"]),
  sourceId: z.string().min(1),
  organizationUnitId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
});

/** Sửa sổ cái KHÔNG BAO GIỜ patch entry gốc (ADR-024) — chỉ tạo entry mới
 * trỏ correctionOfEntryId về entry gốc, entry gốc giữ nguyên nội dung lịch
 * sử. */
export async function createLedgerCorrection(actorId: string, input: z.input<typeof createLedgerCorrectionSchema>) {
  const parsed = createLedgerCorrectionSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "finance.correction.create");
  const original = await assertSameCompanyLedgerEntry(company.id, parsed.correctionOfEntryId);
  if (parsed.organizationUnitId) await assertSameCompanyOrganizationUnit(company.id, parsed.organizationUnitId);
  if (parsed.projectId) await assertSameCompanyProject(company.id, parsed.projectId);

  return db.$transaction(async (tx) => {
    const entry = await tx.ledgerEntry.create({
      data: {
        companyId: company.id,
        type: parsed.type as LedgerEntryType,
        amount: parsed.amount,
        sourceType: parsed.sourceType as LedgerSourceType,
        sourceId: parsed.sourceId,
        correctionOfEntryId: original.id,
        organizationUnitId: parsed.organizationUnitId,
        projectId: parsed.projectId,
        customerId: parsed.customerId,
        createdByUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.LEDGER_CORRECTION_CREATED,
      targetType: "LedgerEntry",
      targetId: entry.id,
      companyId: company.id,
      metadata: { correctionOfEntryId: original.id },
    });
    return entry;
  });
}

// ===== Hàm nội bộ dùng chung (KHÔNG check quyền — caller tự chịu trách
// nhiệm đã requireCompanyContextForActor trước khi gọi) =====

type CreateExpenseRecordTxParams = {
  companyId: string;
  category: ExpenseCategory;
  amount: number;
  occurredAt?: Date;
  description?: string;
  organizationUnitId?: string;
  projectId?: string;
  sourceType: ExpenseSourceType;
  sourceId?: string;
  createdByUserId: string;
};

/** Ghi 1 Expense + 1 LedgerEntry tương ứng trong CÙNG tx được truyền vào —
 * dùng bởi payroll-service.ts khi finalize payroll (mỗi PayrollItem.netAmount
 * > 0 sinh 1 Expense category SALARY, sourceType PAYROLL_RUN) để tránh xây
 * hệ thanh toán song song (ADR-025/ADR-027). */
export async function createExpenseRecordTx(tx: Prisma.TransactionClient, params: CreateExpenseRecordTxParams) {
  const expense = await tx.expense.create({
    data: {
      companyId: params.companyId,
      category: params.category,
      amount: params.amount,
      occurredAt: params.occurredAt,
      description: params.description,
      organizationUnitId: params.organizationUnitId,
      projectId: params.projectId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdByUserId: params.createdByUserId,
    },
  });

  await tx.ledgerEntry.create({
    data: {
      companyId: params.companyId,
      type: (params.category === "SALARY" ? "SALARY_PAYMENT" : "EXPENSE") as LedgerEntryType,
      amount: expense.amount,
      occurredAt: expense.occurredAt,
      sourceType: "EXPENSE" as LedgerSourceType,
      sourceId: expense.id,
      organizationUnitId: expense.organizationUnitId ?? undefined,
      projectId: expense.projectId ?? undefined,
      createdByUserId: params.createdByUserId,
    },
  });

  return expense;
}

// ===== Read =====

export async function getCustomerReceivable(actorId: string, companyId: string, saleId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "finance.view");
  const sale = await assertSameCompanySale(company.id, saleId);

  const paidAggregate = await db.payment.aggregate({
    _sum: { amount: true },
    where: { saleId: sale.id, status: "POSTED" },
  });
  const totalAmount = Number(sale.totalAmount);
  const paidAmount = Number(paidAggregate._sum.amount ?? 0);
  return { saleId: sale.id, totalAmount, paidAmount, outstandingAmount: totalAmount - paidAmount };
}

export async function getPaymentList(actorId: string, companyId: string, filters?: { saleId?: string }) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "finance.view");
  return db.payment.findMany({
    where: { companyId: company.id, ...(filters?.saleId ? { saleId: filters.saleId } : {}) },
    include: { sale: true },
    orderBy: { occurredAt: "desc" },
  });
}

export async function getExpenseList(actorId: string, companyId: string, filters?: { category?: ExpenseCategory }) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "finance.view");
  return db.expense.findMany({
    where: { companyId: company.id, ...(filters?.category ? { category: filters.category } : {}) },
    orderBy: { occurredAt: "desc" },
  });
}

export async function getLedgerEntries(
  actorId: string,
  companyId: string,
  filters?: { type?: LedgerEntryType; sourceType?: LedgerSourceType },
) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "finance.view");
  return db.ledgerEntry.findMany({
    where: {
      companyId: company.id,
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.sourceType ? { sourceType: filters.sourceType } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
}

export async function getPaymentDetail(actorId: string, companyId: string, paymentId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "finance.view");
  const payment = await assertSameCompanyPayment(company.id, paymentId);
  // omit phoneCiphertext/phoneHash — chỉ getCustomerDetail/getLeadDetail
  // (Phần 5) được phép chạm 2 field này (bài học P1 PII over-fetch đã vá ở
  // Phần 5, xem RED_TEAM_CODE_REVIEW_PART5.md).
  return db.payment.findUnique({
    where: { id: payment.id },
    include: { sale: { include: { customer: { omit: { phoneCiphertext: true, phoneHash: true } } } } },
  });
}

export async function getExpenseDetail(actorId: string, companyId: string, expenseId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "finance.view");
  const expense = await assertSameCompanyExpense(company.id, expenseId);
  return db.expense.findUnique({
    where: { id: expense.id },
    include: { organizationUnit: true, project: true },
  });
}
