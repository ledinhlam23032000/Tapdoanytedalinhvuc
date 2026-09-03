// Integration test suite — Tenant Isolation Matrix cho Phần 6 (Finance +
// Payment + Receivable + Ledger + Payroll + Commission + Inventory). HIGH
// RISK / VERY HIGH RISK domain — xem docs/architecture/DECISIONS.md
// ADR-024..ADR-035. Cùng nguyên tắc tenant-isolation-part5.itest.ts: test
// qua đúng entry point domain service thật, không test resolver cô lập.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { AuthorizationError } from "@/lib/authorization/errors";
import * as financeService from "@/lib/domain/finance-service";
import * as payrollService from "@/lib/domain/payroll-service";
import * as commissionService from "@/lib/domain/commission-service";
import * as inventoryService from "@/lib/domain/inventory-service";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (/clinic|production|hongphuc|zenith/i.test(DATABASE_URL)) {
  throw new Error(
    `Refusing to run tenant-isolation-part6.itest.ts against a DB URL that looks like production/clinic: ${DATABASE_URL}`,
  );
}

type Fixtures = Awaited<ReturnType<typeof seed>>;
let fx: Fixtures;

async function seed() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const pw = await hashPassword("Test-Password-123");

  const mkUser = (name: string) =>
    db.user.create({
      data: { displayName: name, email: `${name.toLowerCase()}-${suffix}@test.local`, passwordHash: pw },
    });

  const [ownerA, managerA, memberA, viewerA, ownerB, memberB, outsider] = await Promise.all([
    mkUser("OwnerA6"),
    mkUser("ManagerA6"),
    mkUser("MemberA6"),
    mkUser("ViewerA6"),
    mkUser("OwnerB6"),
    mkUser("MemberB6"),
    mkUser("Outsider6"),
  ]);

  const ecosystem = await db.ecosystem.create({ data: { code: `e6-${suffix}`, name: "E6" } });

  const companyA = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p6-company-a-${suffix}`, name: "Company A6", status: "ACTIVE" },
  });
  const companyB = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p6-company-b-${suffix}`, name: "Company B6", status: "ACTIVE" },
  });

  await db.companyMembership.createMany({
    data: [
      { companyId: companyA.id, userId: ownerA.id, rolePreset: "OWNER" },
      { companyId: companyA.id, userId: managerA.id, rolePreset: "MANAGER" },
      { companyId: companyA.id, userId: memberA.id, rolePreset: "MEMBER" },
      { companyId: companyA.id, userId: viewerA.id, rolePreset: "VIEWER" },
      { companyId: companyB.id, userId: ownerB.id, rolePreset: "OWNER" },
      { companyId: companyB.id, userId: memberB.id, rolePreset: "MEMBER" },
    ],
  });

  const unitA = await db.organizationUnit.create({
    data: { companyId: companyA.id, type: "DEPARTMENT", name: "Phòng Kinh doanh A6" },
  });
  const unitB = await db.organizationUnit.create({
    data: { companyId: companyB.id, type: "DEPARTMENT", name: "Phòng B6" },
  });

  // Sale CONFIRMED làm neo cho Payment/Commission — tạo trực tiếp qua db,
  // không qua sales-service (Phần 5 đã tự test Sale lifecycle, Phần 6 chỉ
  // cần 1 Sale CONFIRMED có sẵn để treo Payment/Commission).
  const saleA = await db.sale.create({
    data: { companyId: companyA.id, status: "CONFIRMED", totalAmount: 1_000_000, confirmedAt: new Date() },
  });
  const saleB = await db.sale.create({
    data: { companyId: companyB.id, status: "CONFIRMED", totalAmount: 500_000, confirmedAt: new Date() },
  });
  const draftSaleA = await db.sale.create({ data: { companyId: companyA.id, status: "DRAFT", totalAmount: 200_000 } });

  const locationA = await db.inventoryLocation.create({ data: { companyId: companyA.id, name: "Kho A6" } });
  const locationA2 = await db.inventoryLocation.create({ data: { companyId: companyA.id, name: "Kho A6 phụ" } });
  const locationB = await db.inventoryLocation.create({ data: { companyId: companyB.id, name: "Kho B6" } });
  const itemA = await db.inventoryItem.create({
    data: { companyId: companyA.id, name: "Vật tư A6", unit: "cái", reorderLevel: 5 },
  });
  const itemB = await db.inventoryItem.create({ data: { companyId: companyB.id, name: "Vật tư B6", unit: "cái" } });

  return {
    suffix,
    ownerA,
    managerA,
    memberA,
    viewerA,
    ownerB,
    memberB,
    outsider,
    ecosystem,
    companyA,
    companyB,
    unitA,
    unitB,
    saleA,
    saleB,
    draftSaleA,
    locationA,
    locationA2,
    locationB,
    itemA,
    itemB,
  };
}

async function cleanup(f: Fixtures) {
  const userIds = [f.ownerA, f.managerA, f.memberA, f.viewerA, f.ownerB, f.memberB, f.outsider].map((u) => u.id);
  const companyIds = [f.companyA.id, f.companyB.id];
  await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.commissionCalculation.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.commissionRule.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.payrollItem.deleteMany({ where: { payrollRun: { companyId: { in: companyIds } } } });
  await db.payrollRun.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.payrollProfile.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.approvalRequest.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.stockMovement.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.inventoryItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.inventoryLocation.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.ledgerEntry.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.expense.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.payment.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.sale.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.organizationUnit.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.ecosystem.deleteMany({ where: { id: f.ecosystem.id } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  fx = await seed();
});

afterAll(async () => {
  await cleanup(fx);
});

describe("Payment — quyền + cross-company + tính tiền (ADR-024/025/026)", () => {
  it("MemberA ghi nhận thanh toán cho Sale CONFIRMED của Company A: allowed, tạo đúng LedgerEntry", async () => {
    const payment = await financeService.recordPayment(fx.memberA.id, {
      companyId: fx.companyA.id,
      saleId: fx.saleA.id,
      amount: 400_000,
    });
    expect(payment.companyId).toBe(fx.companyA.id);

    const entry = await db.ledgerEntry.findFirst({ where: { sourceType: "PAYMENT", sourceId: payment.id } });
    expect(entry).not.toBeNull();
    expect(entry?.type).toBe("SALE_RECEIPT");
    expect(Number(entry?.amount)).toBe(400_000);
  });

  it("ViewerA (không có finance.payment.create) ghi nhận thanh toán: DENY", async () => {
    await expect(
      financeService.recordPayment(fx.viewerA.id, { companyId: fx.companyA.id, saleId: fx.saleA.id, amount: 1000 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Ghi nhận thanh toán cho Sale thuộc Company B (cross-company FK injection): DENY", async () => {
    await expect(
      financeService.recordPayment(fx.memberA.id, { companyId: fx.companyA.id, saleId: fx.saleB.id, amount: 1000 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Ghi nhận thanh toán cho Sale còn DRAFT (chưa xác nhận): DENY", async () => {
    await expect(
      financeService.recordPayment(fx.memberA.id, {
        companyId: fx.companyA.id,
        saleId: fx.draftSaleA.id,
        amount: 1000,
      }),
    ).rejects.toThrow(/đã xác nhận/);
  });

  it("Overpayment vượt quá Sale.totalAmount: DENY (không có credit-balance)", async () => {
    // saleA đã có 400.000 từ test trước — còn lại 600.000. Thử trả 700.000.
    await expect(
      financeService.recordPayment(fx.memberA.id, {
        companyId: fx.companyA.id,
        saleId: fx.saleA.id,
        amount: 700_000,
      }),
    ).rejects.toThrow(/vượt quá số còn phải thu/);
  });

  it("getCustomerReceivable phản ánh đúng đã thu/còn lại", async () => {
    const receivable = await financeService.getCustomerReceivable(fx.ownerA.id, fx.companyA.id, fx.saleA.id);
    expect(receivable.totalAmount).toBe(1_000_000);
    expect(receivable.paidAmount).toBe(400_000);
    expect(receivable.outstandingAmount).toBe(600_000);
  });

  it("Void Payment: chuyển VOID + Void luôn LedgerEntry liên kết, void lần 2 bị chặn", async () => {
    const payment = await financeService.recordPayment(fx.memberA.id, {
      companyId: fx.companyA.id,
      saleId: fx.saleA.id,
      amount: 100_000,
    });
    await financeService.voidPayment(fx.ownerA.id, fx.companyA.id, payment.id, "Khách huỷ giao dịch");

    const voided = await db.payment.findUnique({ where: { id: payment.id } });
    expect(voided?.status).toBe("VOID");
    const entry = await db.ledgerEntry.findFirst({ where: { sourceType: "PAYMENT", sourceId: payment.id } });
    expect(entry?.status).toBe("VOID");

    await expect(financeService.voidPayment(fx.ownerA.id, fx.companyA.id, payment.id, "Lần 2")).rejects.toThrow(
      /đã bị huỷ trước đó/,
    );

    // outstandingAmount không tính lại payment đã VOID.
    const receivable = await financeService.getCustomerReceivable(fx.ownerA.id, fx.companyA.id, fx.saleA.id);
    expect(receivable.paidAmount).toBe(400_000); // chỉ còn payment 400k ban đầu (100k vừa void không tính)
  });
});

describe("Expense + LedgerEntry correction (ADR-024/025)", () => {
  it("ManagerA ghi nhận chi phí: allowed (MEMBER_PART6 không có finance.expense.create — chỉ MANAGER+)", async () => {
    const expense = await financeService.recordExpense(fx.managerA.id, {
      companyId: fx.companyA.id,
      category: "SUPPLIES",
      amount: 50_000,
    });
    const entry = await db.ledgerEntry.findFirst({ where: { sourceType: "EXPENSE", sourceId: expense.id } });
    expect(entry?.type).toBe("EXPENSE");
  });

  it("Chi phí category SALARY tạo LedgerEntry type SALARY_PAYMENT (không phải EXPENSE)", async () => {
    const expense = await financeService.recordExpense(fx.ownerA.id, {
      companyId: fx.companyA.id,
      category: "SALARY",
      amount: 5_000_000,
    });
    const entry = await db.ledgerEntry.findFirst({ where: { sourceType: "EXPENSE", sourceId: expense.id } });
    expect(entry?.type).toBe("SALARY_PAYMENT");
  });

  it("Ghi chi phí gắn organizationUnitId thuộc Company B: DENY", async () => {
    await expect(
      financeService.recordExpense(fx.ownerA.id, {
        companyId: fx.companyA.id,
        category: "OTHER",
        amount: 1000,
        organizationUnitId: fx.unitB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("MemberA (không có finance.correction.create) tạo correction: DENY; OwnerA tạo correction: entry gốc giữ nguyên, entry mới trỏ đúng correctionOfEntryId", async () => {
    const expense = await financeService.recordExpense(fx.ownerA.id, {
      companyId: fx.companyA.id,
      category: "OTHER",
      amount: 20_000,
    });
    const original = await db.ledgerEntry.findFirstOrThrow({ where: { sourceType: "EXPENSE", sourceId: expense.id } });

    await expect(
      financeService.createLedgerCorrection(fx.memberA.id, {
        companyId: fx.companyA.id,
        correctionOfEntryId: original.id,
        type: "ADJUSTMENT",
        amount: 5_000,
        reason: "Sửa số liệu",
        sourceType: "MANUAL",
        sourceId: "manual-1",
      }),
    ).rejects.toThrow(AuthorizationError);

    await financeService.createLedgerCorrection(fx.ownerA.id, {
      companyId: fx.companyA.id,
      correctionOfEntryId: original.id,
      type: "ADJUSTMENT",
      amount: 5_000,
      reason: "Sửa số liệu",
      sourceType: "MANUAL",
      sourceId: "manual-1",
    });

    const originalAfter = await db.ledgerEntry.findUniqueOrThrow({ where: { id: original.id } });
    expect(Number(originalAfter.amount)).toBe(20_000); // KHÔNG bị patch — vẫn 20.000 nguyên vẹn
    const correction = await db.ledgerEntry.findFirst({ where: { correctionOfEntryId: original.id } });
    expect(correction).not.toBeNull();
    expect(Number(correction?.amount)).toBe(5_000);
  });
});

describe("PayrollRun lifecycle + two-person approval (ADR-027/028/029)", () => {
  it("Thiết lập PayrollProfile effective-dated: đổi lương KHÔNG overwrite tại chỗ, đóng dòng cũ đúng effectiveTo", async () => {
    await payrollService.setPayrollProfile(fx.ownerA.id, {
      companyId: fx.companyA.id,
      userId: fx.memberA.id,
      baseSalary: 10_000_000,
      effectiveFrom: new Date("2026-01-01"),
    });
    await payrollService.setPayrollProfile(fx.ownerA.id, {
      companyId: fx.companyA.id,
      userId: fx.memberA.id,
      baseSalary: 12_000_000,
      effectiveFrom: new Date("2026-06-01"),
    });

    const profiles = await db.payrollProfile.findMany({
      where: { companyId: fx.companyA.id, userId: fx.memberA.id },
      orderBy: { effectiveFrom: "asc" },
    });
    expect(profiles).toHaveLength(2);
    expect(profiles[0].effectiveTo?.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(profiles[1].effectiveTo).toBeNull();
    expect(Number(profiles[0].baseSalary)).toBe(10_000_000); // dòng cũ giữ nguyên giá trị lịch sử
  });

  it("Thiết lập PayrollProfile cho user không phải thành viên active của Company: DENY", async () => {
    await expect(
      payrollService.setPayrollProfile(fx.ownerA.id, {
        companyId: fx.companyA.id,
        userId: fx.outsider.id,
        baseSalary: 5_000_000,
      }),
    ).rejects.toThrow();
  });

  it("Vòng đời đầy đủ: DRAFT->CALCULATED->APPROVED->PENDING->PENDING_SECOND->APPROVED->FINALIZED, sinh đúng Expense SALARY", async () => {
    await payrollService.setPayrollProfile(fx.managerA.id, {
      companyId: fx.companyA.id,
      userId: fx.managerA.id,
      baseSalary: 8_000_000,
      effectiveFrom: new Date("2026-01-01"),
    });
    const run = await payrollService.createPayrollRun(fx.ownerA.id, {
      companyId: fx.companyA.id,
      periodStart: new Date("2026-02-01"),
      periodEnd: new Date("2026-02-28"),
    });
    expect(run.status).toBe("DRAFT");

    await payrollService.calculatePayrollRun(fx.ownerA.id, fx.companyA.id, run.id);
    const afterCalc = await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(afterCalc.status).toBe("CALCULATED");
    const item = await db.payrollItem.findFirstOrThrow({ where: { payrollRunId: run.id, userId: fx.managerA.id } });
    expect(Number(item.netAmount)).toBe(8_000_000);

    await payrollService.approvePayrollRun(fx.ownerA.id, fx.companyA.id, run.id);

    const request = await payrollService.requestPayrollFinalize(fx.ownerA.id, fx.companyA.id, run.id, "Đến hạn trả lương");
    expect(request.status).toBe("PENDING");

    await payrollService.firstApprovePayrollFinalize(fx.ownerA.id, fx.companyA.id, request.id);
    const afterFirst = await db.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(afterFirst.status).toBe("PENDING_SECOND");

    // Chính người vừa duyệt lần 1 tự duyệt lần 2: DENY (ADR-028 bất biến cốt lõi).
    await expect(
      payrollService.secondApprovePayrollFinalize(fx.ownerA.id, fx.companyA.id, request.id),
    ).rejects.toThrow(AuthorizationError);

    await payrollService.secondApprovePayrollFinalize(fx.managerA.id, fx.companyA.id, request.id);
    const afterSecond = await db.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(afterSecond.status).toBe("APPROVED");

    await payrollService.finalizePayrollRun(fx.ownerA.id, fx.companyA.id, run.id, request.id);
    const finalized = await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finalized.status).toBe("FINALIZED");

    // findMany, khong findFirst: memberA co the co PayrollProfile hieu luc
    // trung ky nay do bleed tu fixture cua test truoc trong cung file (chi
    // beforeAll, khong beforeEach) — run.id co the sinh ra hon 1 Expense,
    // thu tu tra ve khong dam bao. Chi assert co dung 1 Expense mang dung
    // netAmount cua managerA (8_000_000), khong gia dinh la Expense DUY
    // NHAT cua run.
    const salaryExpenses = await db.expense.findMany({
      where: { companyId: fx.companyA.id, sourceType: "PAYROLL_RUN", sourceId: run.id },
    });
    const managerExpense = salaryExpenses.find((e) => Number(e.amount) === 8_000_000);
    expect(managerExpense).not.toBeUndefined();
    expect(managerExpense?.category).toBe("SALARY");
  });

  it("Không thể finalize khi chưa có ApprovalRequest APPROVED", async () => {
    const run = await payrollService.createPayrollRun(fx.ownerA.id, {
      companyId: fx.companyA.id,
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
    });
    await payrollService.calculatePayrollRun(fx.ownerA.id, fx.companyA.id, run.id);
    await payrollService.approvePayrollRun(fx.ownerA.id, fx.companyA.id, run.id);

    await expect(
      payrollService.finalizePayrollRun(fx.ownerA.id, fx.companyA.id, run.id, "not-a-real-approval-id"),
    ).rejects.toThrow(/chưa được duyệt đủ hai người/);
  });

  it("PayrollRun đã FINALIZED: không thể Huỷ, không thể Tính lại", async () => {
    const run = await db.payrollRun.findFirstOrThrow({
      where: { companyId: fx.companyA.id, status: "FINALIZED" },
    });
    await expect(payrollService.voidPayrollRun(fx.ownerA.id, fx.companyA.id, run.id, "test")).rejects.toThrow(
      /đã chốt sổ không thể huỷ/,
    );
    await expect(payrollService.calculatePayrollRun(fx.ownerA.id, fx.companyA.id, run.id)).rejects.toThrow();
  });

  it("Tạo trùng PayrollRun cùng period: DENY thông báo rõ ràng", async () => {
    await payrollService.createPayrollRun(fx.ownerA.id, {
      companyId: fx.companyA.id,
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-04-30"),
    });
    await expect(
      payrollService.createPayrollRun(fx.ownerA.id, {
        companyId: fx.companyA.id,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-04-30"),
      }),
    ).rejects.toThrow(/[Đđ]ã tồn tại kỳ lương/);
  });

  it("truy cập PayrollRun thuộc Company B từ Company A (cross-company): DENY", async () => {
    const runB = await payrollService.createPayrollRun(fx.ownerB.id, {
      companyId: fx.companyB.id,
      periodStart: new Date("2026-02-01"),
      periodEnd: new Date("2026-02-28"),
    });
    await expect(payrollService.calculatePayrollRun(fx.ownerA.id, fx.companyA.id, runB.id)).rejects.toThrow(
      AuthorizationError,
    );
  });
});

describe("Commission — allocation double-count guard + versioning (ADR-030)", () => {
  it("Tạo CommissionRule PERCENTAGE_OF_SALE, tính hoa hồng cho Sale, allocation nhiều người đúng tổng", async () => {
    const rule = await commissionService.createCommissionRule(fx.ownerA.id, {
      companyId: fx.companyA.id,
      name: "Hoa hồng chuẩn 10%",
      type: "PERCENTAGE_OF_SALE",
      config: { percentageBps: 1000 },
    });
    await commissionService.updateCommissionRuleStatus(fx.ownerA.id, fx.companyA.id, rule.id, "ACTIVE");

    const sale = await db.sale.create({
      data: { companyId: fx.companyA.id, status: "CONFIRMED", totalAmount: 2_000_000, confirmedAt: new Date() },
    });

    const calculations = await commissionService.calculateCommissionForSale(fx.ownerA.id, {
      companyId: fx.companyA.id,
      saleId: sale.id,
      ruleId: rule.id,
      contributors: [
        { userId: fx.managerA.id, role: "CONSULTANT", allocationBps: 6_000 },
        { userId: fx.memberA.id, role: "DOCTOR", allocationBps: 4_000 },
      ],
    });
    // baseAmount = 2.000.000 * 10% = 200.000; 60/40 -> 120.000/80.000
    const sum = calculations.reduce((s, c) => s + Number(c.amount), 0);
    expect(sum).toBe(200_000);
  });

  it("allocationBps tổng vượt 10000 (double-count): DENY với thông báo rõ ràng, không tạo record nào", async () => {
    const rule = await db.commissionRule.findFirstOrThrow({ where: { companyId: fx.companyA.id, status: "ACTIVE" } });
    const sale = await db.sale.create({
      data: { companyId: fx.companyA.id, status: "CONFIRMED", totalAmount: 1_000_000, confirmedAt: new Date() },
    });

    await expect(
      commissionService.calculateCommissionForSale(fx.ownerA.id, {
        companyId: fx.companyA.id,
        saleId: sale.id,
        ruleId: rule.id,
        contributors: [
          { userId: fx.managerA.id, role: "CONSULTANT", allocationBps: 10_000 },
          { userId: fx.memberA.id, role: "DOCTOR", allocationBps: 10_000 },
        ],
      }),
    ).rejects.toThrow(/vượt quá 100%/);

    const existing = await db.commissionCalculation.findMany({ where: { saleId: sale.id } });
    expect(existing).toHaveLength(0);
  });

  it("Dùng CommissionRule chưa ACTIVE (còn DRAFT) để tính: DENY", async () => {
    const draftRule = await commissionService.createCommissionRule(fx.ownerA.id, {
      companyId: fx.companyA.id,
      name: "Rule nháp",
      type: "FIXED_PER_ITEM",
      config: { amountPerItem: 10_000 },
    });
    const sale = await db.sale.create({
      data: { companyId: fx.companyA.id, status: "CONFIRMED", totalAmount: 100_000, confirmedAt: new Date() },
    });
    await expect(
      commissionService.calculateCommissionForSale(fx.ownerA.id, {
        companyId: fx.companyA.id,
        saleId: sale.id,
        ruleId: draftRule.id,
        contributors: [{ userId: fx.ownerA.id, role: "SALESPERSON", allocationBps: 10_000 }],
      }),
    ).rejects.toThrow(/đang hoạt động/);
  });

  it("Dùng CommissionRule thuộc Company B khi tính cho Sale Company A (cross-company FK): DENY", async () => {
    const ruleB = await commissionService.createCommissionRule(fx.ownerB.id, {
      companyId: fx.companyB.id,
      name: "Rule B",
      type: "PERCENTAGE_OF_SALE",
      config: { percentageBps: 500 },
    });
    await commissionService.updateCommissionRuleStatus(fx.ownerB.id, fx.companyB.id, ruleB.id, "ACTIVE");

    await expect(
      commissionService.calculateCommissionForSale(fx.ownerA.id, {
        companyId: fx.companyA.id,
        saleId: fx.saleA.id,
        ruleId: ruleB.id,
        contributors: [{ userId: fx.ownerA.id, role: "SALESPERSON", allocationBps: 10_000 }],
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("Inventory — StockMovement derive balance + negative-stock guard + idempotency (ADR-031/034)", () => {
  it("Nhập kho rồi xuất kho: số dư derive đúng qua StockMovement", async () => {
    await inventoryService.receiveStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      quantity: 100,
    });
    await inventoryService.issueStock(fx.memberA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      quantity: 30,
    });
    const balance = await inventoryService.getStockBalance(fx.ownerA.id, fx.companyA.id, fx.itemA.id, fx.locationA.id);
    expect(balance).toBe(70);
  });

  it("Xuất kho vượt tồn kho hiện có (không có inventory.manage): DENY", async () => {
    await expect(
      inventoryService.issueStock(fx.memberA.id, {
        companyId: fx.companyA.id,
        inventoryItemId: fx.itemA.id,
        locationId: fx.locationA.id,
        quantity: 1_000,
      }),
    ).rejects.toThrow(/vượt quá tồn kho/);
  });

  it("Xuất kho vượt tồn kho CÓ inventory.manage + reason: cho phép override âm kho", async () => {
    const movement = await inventoryService.issueStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      quantity: 1_000,
      reason: "Bán trước, nhập bù sau — đã xác nhận với khách",
    });
    expect(movement.type).toBe("OUT");
    // Dọn lại số dư cho test sau — issue một IN bù đúng bằng phần âm.
    await inventoryService.receiveStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      quantity: 1_000,
    });
  });

  it("Chuyển kho: tạo đúng cặp TRANSFER_OUT/TRANSFER_IN cùng sourceId, số dư 2 đầu đúng", async () => {
    await inventoryService.transferStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      fromLocationId: fx.locationA.id,
      toLocationId: fx.locationA2.id,
      quantity: 20,
      idempotencyKey: `transfer-test-${fx.suffix}`,
    });
    const balanceFrom = await inventoryService.getStockBalance(
      fx.ownerA.id,
      fx.companyA.id,
      fx.itemA.id,
      fx.locationA.id,
    );
    const balanceTo = await inventoryService.getStockBalance(
      fx.ownerA.id,
      fx.companyA.id,
      fx.itemA.id,
      fx.locationA2.id,
    );
    expect(balanceTo).toBe(20);
    expect(balanceFrom).toBe(70 - 20); // 70 từ test đầu tiên

    // Gọi lại đúng idempotencyKey lần 2: phải bị chặn (unique constraint), không tạo movement trùng.
    await expect(
      inventoryService.transferStock(fx.ownerA.id, {
        companyId: fx.companyA.id,
        inventoryItemId: fx.itemA.id,
        fromLocationId: fx.locationA.id,
        toLocationId: fx.locationA2.id,
        quantity: 20,
        idempotencyKey: `transfer-test-${fx.suffix}`,
      }),
    ).rejects.toThrow();
  });

  it("Chuyển kho tới location thuộc Company B (cross-company): DENY", async () => {
    await expect(
      inventoryService.transferStock(fx.ownerA.id, {
        companyId: fx.companyA.id,
        inventoryItemId: fx.itemA.id,
        fromLocationId: fx.locationA.id,
        toLocationId: fx.locationB.id,
        quantity: 1,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Yêu cầu điều chỉnh tồn kho: two-person approval bắt buộc, thực thi 2 lần bị chặn idempotency", async () => {
    const request = await inventoryService.requestStockAdjustment(fx.managerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      direction: "OUT",
      quantity: 5,
      reason: "Kiểm kê phát hiện hao hụt",
    });
    expect(request.status).toBe("PENDING");

    await inventoryService.firstApproveStockAdjustment(fx.managerA.id, fx.companyA.id, request.id);
    // Cùng người duyệt lần 2: DENY.
    await expect(
      inventoryService.secondApproveStockAdjustment(fx.managerA.id, fx.companyA.id, request.id),
    ).rejects.toThrow(AuthorizationError);

    await inventoryService.secondApproveStockAdjustment(fx.ownerA.id, fx.companyA.id, request.id);

    const balanceBefore = await inventoryService.getStockBalance(
      fx.ownerA.id,
      fx.companyA.id,
      fx.itemA.id,
      fx.locationA.id,
    );
    await inventoryService.executeApprovedStockAdjustment(fx.ownerA.id, {
      companyId: fx.companyA.id,
      approvalRequestId: request.id,
    });
    const balanceAfter = await inventoryService.getStockBalance(
      fx.ownerA.id,
      fx.companyA.id,
      fx.itemA.id,
      fx.locationA.id,
    );
    expect(balanceAfter).toBe(balanceBefore - 5);

    // Thực thi lần 2 cho cùng approvalRequestId: DENY (idempotencyKey = request.id đã dùng).
    await expect(
      inventoryService.executeApprovedStockAdjustment(fx.ownerA.id, {
        companyId: fx.companyA.id,
        approvalRequestId: request.id,
      }),
    ).rejects.toThrow();

    const actionable = await inventoryService.getActionableStockAdjustmentRequests(fx.ownerA.id, fx.companyA.id);
    expect(actionable.find((r) => r.id === request.id)).toBeUndefined(); // đã thực thi -> không còn actionable
  });

  it("Thực thi điều chỉnh khi request CHƯA APPROVED: DENY", async () => {
    const request = await inventoryService.requestStockAdjustment(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: fx.itemA.id,
      locationId: fx.locationA.id,
      direction: "IN",
      quantity: 1,
      reason: "test chưa duyệt",
    });
    await expect(
      inventoryService.executeApprovedStockAdjustment(fx.ownerA.id, {
        companyId: fx.companyA.id,
        approvalRequestId: request.id,
      }),
    ).rejects.toThrow(/chưa được duyệt đủ hai người/);
  });

  it("getLowStockItems trả về đúng item có số dư <= reorderLevel", async () => {
    const lowItem = await db.inventoryItem.create({
      data: { companyId: fx.companyA.id, name: "Item sắp hết", unit: "cái", reorderLevel: 10 },
    });
    await inventoryService.receiveStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: lowItem.id,
      locationId: fx.locationA.id,
      quantity: 5,
    });
    const lowStock = await inventoryService.getLowStockItems(fx.ownerA.id, fx.companyA.id);
    expect(lowStock.some((r) => r.item.id === lowItem.id && r.currentBalance === 5)).toBe(true);
  });
});

describe("Suspended Company — chặn ghi Phần 6, vẫn cho đọc (kế thừa bài học P1 Phần 4)", () => {
  it("Company SUSPENDED: recordPayment/recordExpense/createPayrollRun/receiveStock đều DENY, đọc .view vẫn OK", async () => {
    await db.company.update({ where: { id: fx.companyB.id }, data: { status: "SUSPENDED" } });
    try {
      await expect(
        financeService.recordPayment(fx.ownerB.id, { companyId: fx.companyB.id, saleId: fx.saleB.id, amount: 1000 }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        financeService.recordExpense(fx.ownerB.id, { companyId: fx.companyB.id, category: "OTHER", amount: 1000 }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        payrollService.createPayrollRun(fx.ownerB.id, {
          companyId: fx.companyB.id,
          periodStart: new Date("2026-05-01"),
          periodEnd: new Date("2026-05-31"),
        }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        inventoryService.receiveStock(fx.ownerB.id, {
          companyId: fx.companyB.id,
          inventoryItemId: fx.itemB.id,
          locationId: fx.locationB.id,
          quantity: 1,
        }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        commissionService.createCommissionRule(fx.ownerB.id, {
          companyId: fx.companyB.id,
          name: "x",
          type: "PERCENTAGE_OF_SALE",
          config: { percentageBps: 100 },
        }),
      ).rejects.toThrow(AuthorizationError);

      // Đọc vẫn hoạt động bình thường.
      await expect(financeService.getPaymentList(fx.ownerB.id, fx.companyB.id)).resolves.toBeDefined();
      await expect(inventoryService.getInventoryItemList(fx.ownerB.id, fx.companyB.id)).resolves.toBeDefined();
    } finally {
      await db.company.update({ where: { id: fx.companyB.id }, data: { status: "ACTIVE" } });
    }
  });
});

// Regression cho 3 P0 race condition thật đã phát hiện qua adversarial
// review (RED_TEAM_CODE_REVIEW_PART6.md) — Promise.all ở đây tạo race THẬT
// (Node xen kẽ I/O bất đồng bộ giữa 2 lời gọi Postgres cùng lúc), không
// phải giả lập — nếu thiếu SELECT...FOR UPDATE, các test này sẽ FAIL thật.
describe("Concurrency — race condition regression (P0 fix)", () => {
  it("2 lần recordPayment ĐỒNG THỜI cho cùng Sale vượt tổng: chỉ 1 thành công, không overpay", async () => {
    const sale = await db.sale.create({
      data: { companyId: fx.companyA.id, status: "CONFIRMED", totalAmount: 1_000_000, confirmedAt: new Date() },
    });
    const results = await Promise.allSettled([
      financeService.recordPayment(fx.ownerA.id, { companyId: fx.companyA.id, saleId: sale.id, amount: 700_000 }),
      financeService.recordPayment(fx.managerA.id, { companyId: fx.companyA.id, saleId: sale.id, amount: 700_000 }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1); // đúng 1 trong 2 thành công, không cả 2

    const receivable = await financeService.getCustomerReceivable(fx.ownerA.id, fx.companyA.id, sale.id);
    expect(receivable.paidAmount).toBeLessThanOrEqual(1_000_000); // không overpay
  });

  it("2 lần finalizePayrollRun ĐỒNG THỜI cho cùng run: chỉ 1 thành công, chỉ 1 Expense trả lương", async () => {
    await payrollService.setPayrollProfile(fx.ownerA.id, {
      companyId: fx.companyA.id,
      userId: fx.viewerA.id,
      baseSalary: 6_000_000,
      effectiveFrom: new Date("2026-01-01"),
    });
    const run = await payrollService.createPayrollRun(fx.ownerA.id, {
      companyId: fx.companyA.id,
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
    });
    await payrollService.calculatePayrollRun(fx.ownerA.id, fx.companyA.id, run.id);
    await payrollService.approvePayrollRun(fx.ownerA.id, fx.companyA.id, run.id);
    const request = await payrollService.requestPayrollFinalize(fx.ownerA.id, fx.companyA.id, run.id, "test race");
    await payrollService.firstApprovePayrollFinalize(fx.ownerA.id, fx.companyA.id, request.id);
    await payrollService.secondApprovePayrollFinalize(fx.managerA.id, fx.companyA.id, request.id);

    const results = await Promise.allSettled([
      payrollService.finalizePayrollRun(fx.ownerA.id, fx.companyA.id, run.id, request.id),
      payrollService.finalizePayrollRun(fx.managerA.id, fx.companyA.id, run.id, request.id),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1); // đúng 1 trong 2 lệnh finalize thành công

    // Company A lúc này có thể có nhiều PayrollProfile active (từ các test
    // khác chạy trước, effectiveTo=null) nên số PayrollItem của run này
    // không nhất thiết =1 — so sánh Expense với ĐÚNG số PayrollItem thật của
    // run, không hard-code "1", để test chỉ bắt đúng bug "trả lương 2 lần"
    // (double Expense CHO CÙNG PayrollItem), không nhầm với nhiều nhân viên.
    const items = await db.payrollItem.findMany({ where: { payrollRunId: run.id } });
    const expenses = await db.expense.findMany({
      where: { companyId: fx.companyA.id, sourceType: "PAYROLL_RUN", sourceId: run.id },
    });
    expect(expenses).toHaveLength(items.filter((i) => Number(i.netAmount) > 0).length); // KHÔNG bị trả lương 2 lần
  });

  it("2 lần issueStock ĐỒNG THỜI cùng đẩy tồn kho âm (không override): chỉ 1 thành công", async () => {
    const item = await db.inventoryItem.create({ data: { companyId: fx.companyA.id, name: "Race item", unit: "cái" } });
    await inventoryService.receiveStock(fx.ownerA.id, {
      companyId: fx.companyA.id,
      inventoryItemId: item.id,
      locationId: fx.locationA.id,
      quantity: 10,
    });

    const results = await Promise.allSettled([
      inventoryService.issueStock(fx.memberA.id, {
        companyId: fx.companyA.id,
        inventoryItemId: item.id,
        locationId: fx.locationA.id,
        quantity: 8,
      }),
      inventoryService.issueStock(fx.managerA.id, {
        companyId: fx.companyA.id,
        inventoryItemId: item.id,
        locationId: fx.locationA.id,
        quantity: 8,
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1); // 10 - 8 - 8 sẽ âm nếu cả 2 cùng qua — chỉ 1 được phép

    const balance = await inventoryService.getStockBalance(fx.ownerA.id, fx.companyA.id, item.id, fx.locationA.id);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});
