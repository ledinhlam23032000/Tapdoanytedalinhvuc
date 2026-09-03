import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  assertSameCompanySale,
  assertSameCompanyCommissionRule,
  assertActiveCompanyMember,
} from "@/lib/domain/scope-guards";
import {
  calculateCommissionBaseAmount,
  allocateCommissionAmount,
  CommissionAllocationOverflowError,
  type CommissionRuleConfig,
} from "@/lib/domain/commission-calc";
import type { CommissionCalculation, Prisma } from "@/generated/prisma";

// Domain service — CommissionRule + CommissionCalculation (Phần 6, ADR-030).
// getUnallocatedCommissionForPeriod / linkCommissionCalculationsToPayrollItemTx
// là 2 hàm nội bộ payroll-service.ts (viết bởi người khác) sẽ import và gọi
// SAU KHI đã tự requireCompanyContextForActor — không lặp lại check quyền ở
// đây, tránh double-authorization gây nhầm lẫn permission nào là nguồn thật.

// Config mỗi CommissionRuleType có shape khác nhau (ADR-030) — validate thủ
// công theo nhánh type thay vì z.discriminatedUnion, vì type/config là 2
// field tách rời trong input (không phải 1 object gắn discriminator sẵn).
function assertCommissionRuleConfigMatchesType(type: string, config: unknown): void {
  if (type === "PERCENTAGE_OF_SALE") {
    const result = z.object({ percentageBps: z.number().min(0).max(10_000) }).safeParse(config);
    if (!result.success) {
      throw new Error("Config không hợp lệ cho loại PERCENTAGE_OF_SALE — cần { percentageBps: number (0-10000) }.");
    }
    return;
  }
  if (type === "FIXED_PER_ITEM") {
    const result = z.object({ amountPerItem: z.number().positive() }).safeParse(config);
    if (!result.success) {
      throw new Error("Config không hợp lệ cho loại FIXED_PER_ITEM — cần { amountPerItem: number (>0) }.");
    }
    return;
  }
  // TIERED_THRESHOLD
  const result = z
    .object({
      tiers: z
        .array(z.object({ minAmount: z.number().min(0), bps: z.number().min(0).max(10_000) }))
        .min(1),
    })
    .safeParse(config);
  if (!result.success) {
    throw new Error("Config không hợp lệ cho loại TIERED_THRESHOLD — cần { tiers: [{minAmount, bps}] } với ít nhất 1 phần tử.");
  }
}

const createCommissionRuleSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  type: z.enum(["PERCENTAGE_OF_SALE", "FIXED_PER_ITEM", "TIERED_THRESHOLD"]),
  config: z.record(z.string(), z.unknown()),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

export async function createCommissionRule(actorId: string, input: z.input<typeof createCommissionRuleSchema>) {
  const parsed = createCommissionRuleSchema.parse(input);
  assertCommissionRuleConfigMatchesType(parsed.type, parsed.config);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "commission.manage");

  return db.$transaction(async (tx) => {
    const rule = await tx.commissionRule.create({
      data: {
        companyId: company.id,
        name: parsed.name,
        type: parsed.type,
        config: parsed.config as Prisma.InputJsonValue,
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo,
        createdByUserId: actor.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMMISSION_RULE_CREATED,
      targetType: "CommissionRule",
      targetId: rule.id,
      companyId: company.id,
      metadata: { name: rule.name, type: rule.type },
    });
    return rule;
  });
}

const updateCommissionRuleStatusSchema = z.enum(["ACTIVE", "RETIRED"]);

export async function updateCommissionRuleStatus(
  actorId: string,
  companyId: string,
  ruleId: string,
  status: z.input<typeof updateCommissionRuleStatusSchema>,
) {
  const parsedStatus = updateCommissionRuleStatusSchema.parse(status);
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "commission.manage");
  await assertSameCompanyCommissionRule(company.id, ruleId);

  return db.$transaction(async (tx) => {
    const rule = await tx.commissionRule.update({
      where: { id: ruleId },
      data: { status: parsedStatus },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMMISSION_RULE_UPDATED,
      targetType: "CommissionRule",
      targetId: rule.id,
      companyId: company.id,
      metadata: { status: parsedStatus },
    });
    return rule;
  });
}

const calculateCommissionForSaleSchema = z.object({
  companyId: z.string().min(1),
  saleId: z.string().min(1),
  ruleId: z.string().min(1),
  contributors: z
    .array(
      z.object({
        userId: z.string().min(1),
        role: z.string().trim().min(1).max(100),
        allocationBps: z.number().int().min(0).max(10_000),
      }),
    )
    .min(1),
});

export async function calculateCommissionForSale(
  actorId: string,
  input: z.input<typeof calculateCommissionForSaleSchema>,
) {
  const parsed = calculateCommissionForSaleSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "commission.manage");

  await assertSameCompanySale(company.id, parsed.saleId);
  // assertSameCompanySale chỉ xác nhận quyền sở hữu company, KHÔNG include
  // lines — fetch riêng để có totalQuantity (đã qua guard ở dòng trên).
  const sale = await db.sale.findUnique({ where: { id: parsed.saleId }, include: { lines: true } });
  if (!sale) {
    throw new AuthorizationError("Giao dịch không hợp lệ trong công ty này.");
  }

  const rule = await assertSameCompanyCommissionRule(company.id, parsed.ruleId);
  if (rule.status !== "ACTIVE") {
    throw new Error("Chỉ có thể dùng Commission Rule đang hoạt động (ACTIVE) để tính hoa hồng.");
  }

  // Mỗi contributor PHẢI là thành viên đang hoạt động của đúng Company —
  // thiếu guard này (phát hiện qua adversarial review) cho phép gán hoa
  // hồng cho bất kỳ userId nào tồn tại trong hệ thống, kể cả người ngoài
  // Company. Cùng nguyên tắc assertActiveCompanyMember đã áp dụng ở mọi
  // service khác nhận actor-supplied userId (setPayrollProfile, sales-service...).
  await Promise.all(parsed.contributors.map((c) => assertActiveCompanyMember(company.id, c.userId)));

  const totalQuantity = sale.lines.reduce((sum, line) => sum + line.quantity, 0);
  const baseAmount = calculateCommissionBaseAmount(rule.type, rule.config as unknown as CommissionRuleConfig, {
    saleTotalAmount: Number(sale.totalAmount),
    totalQuantity,
  });

  let allocations: ReturnType<typeof allocateCommissionAmount>;
  try {
    allocations = allocateCommissionAmount(baseAmount, parsed.contributors);
  } catch (err) {
    if (err instanceof CommissionAllocationOverflowError) {
      throw new Error("Tổng tỷ lệ phân bổ hoa hồng vượt quá 100% — kiểm tra lại vai trò của từng người đóng góp.");
    }
    throw err;
  }

  return db.$transaction(async (tx) => {
    // Khoá row Sale trước khi đọc/xoá/tạo lại CommissionCalculation — không
    // có lock thì 2 lần gọi tính hoa hồng đồng thời cho cùng Sale (double-
    // submit UI, 2 tab) đều thấy 0 dòng cũ dưới READ COMMITTED và đều tạo
    // ra bộ dòng riêng, nhân đôi hoa hồng khi cộng vào lương (đúng loại bug
    // double-count ADR-030 vừa fix ở tầng allocation, phát hiện lại ở tầng
    // concurrency qua adversarial review).
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${sale.id} FOR UPDATE`;
    const existing = await tx.commissionCalculation.findMany({
      where: { companyId: company.id, saleId: sale.id },
    });
    if (existing.some((calc) => calc.payrollItemId != null)) {
      throw new Error("Hoa hồng của giao dịch này đã được đưa vào kỳ lương, không thể tính lại.");
    }

    await tx.commissionCalculation.deleteMany({ where: { companyId: company.id, saleId: sale.id } });

    const created: CommissionCalculation[] = [];
    for (const allocation of allocations) {
      const row = await tx.commissionCalculation.create({
        data: {
          companyId: company.id,
          saleId: sale.id,
          userId: allocation.userId,
          role: allocation.role,
          ruleId: rule.id,
          allocationBps: allocation.allocationBps,
          amount: allocation.amount,
          snapshot: {
            ruleId: rule.id,
            ruleType: rule.type,
            config: rule.config,
            saleTotalAmount: Number(sale.totalAmount),
            totalQuantity,
            baseAmount,
          } as Prisma.InputJsonValue,
        },
      });
      created.push(row);
    }

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMMISSION_CALCULATED,
      targetType: "Sale",
      targetId: sale.id,
      companyId: company.id,
      metadata: { saleId: sale.id, ruleId: rule.id, contributorCount: parsed.contributors.length },
    });

    return created;
  });
}

const overrideCommissionCalculationSchema = z.object({
  companyId: z.string().min(1),
  calculationId: z.string().min(1),
  newAmount: z.number().min(0),
  reason: z.string().trim().min(1).max(2000),
});

export async function overrideCommissionCalculation(
  actorId: string,
  input: z.input<typeof overrideCommissionCalculationSchema>,
) {
  const parsed = overrideCommissionCalculationSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "commission.manage");

  const calculation = await db.commissionCalculation.findUnique({ where: { id: parsed.calculationId } });
  if (!calculation || calculation.companyId !== company.id) {
    throw new AuthorizationError("Bản ghi hoa hồng không hợp lệ trong công ty này.");
  }
  if (calculation.payrollItemId != null) {
    throw new Error("Hoa hồng này đã được chi trả trong kỳ lương, không thể ghi đè.");
  }

  return db.$transaction(async (tx) => {
    const previousAmount = Number(calculation.amount);
    const updated = await tx.commissionCalculation.update({
      where: { id: calculation.id },
      data: {
        amount: parsed.newAmount,
        snapshot: {
          ...(calculation.snapshot as object),
          overriddenByUserId: actor.id,
          overrideReason: parsed.reason,
          previousAmount,
        } as Prisma.InputJsonValue,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.COMMISSION_OVERRIDDEN,
      targetType: "CommissionCalculation",
      targetId: updated.id,
      companyId: company.id,
      metadata: { previousAmount, newAmount: parsed.newAmount, reason: parsed.reason },
    });
    return updated;
  });
}

export async function getCommissionRuleList(actorId: string, companyId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "commission.view");
  return db.commissionRule.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSaleCommissionBreakdown(actorId: string, companyId: string, saleId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "commission.view");
  const sale = await assertSameCompanySale(company.id, saleId);
  return db.commissionCalculation.findMany({
    where: { companyId: company.id, saleId: sale.id },
    include: { user: { omit: { passwordHash: true } }, rule: true },
    orderBy: { createdAt: "asc" },
  });
}

// ===== Hàm nội bộ — payroll-service.ts import trực tiếp, KHÔNG actor/permission
// check ở đây (caller đã tự requireCompanyContextForActor với "payroll.manage"
// trước khi gọi). Đổi tên hoặc shape tham số 2 hàm dưới đây làm vỡ payroll-service.ts. =====

export async function getUnallocatedCommissionForPeriod(
  companyId: string,
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CommissionCalculation[]> {
  return db.commissionCalculation.findMany({
    where: {
      companyId,
      userId,
      payrollItemId: null,
      sale: { confirmedAt: { gte: periodStart, lte: periodEnd } },
    },
  });
}

export async function linkCommissionCalculationsToPayrollItemTx(
  tx: Prisma.TransactionClient,
  calculationIds: string[],
  payrollItemId: string,
): Promise<void> {
  await tx.commissionCalculation.updateMany({
    where: { id: { in: calculationIds } },
    data: { payrollItemId },
  });
}
