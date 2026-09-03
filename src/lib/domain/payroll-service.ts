import { z } from "zod";
import { db } from "@/lib/db";
import { requireCompanyContextForActor } from "@/lib/authorization/company-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { assertActiveCompanyMember, assertSameCompanyPayrollRun } from "@/lib/domain/scope-guards";
import { calculatePayrollItemTotals } from "@/lib/domain/payroll-calc";
import {
  createApprovalRequest,
  firstApproveRequest,
  secondApproveRequest,
  rejectApprovalRequest,
  getApprovalRequestForTarget,
} from "@/lib/domain/approval-service";
import { createExpenseRecordTx } from "@/lib/domain/finance-service";
import { getUnallocatedCommissionForPeriod, linkCommissionCalculationsToPayrollItemTx } from "@/lib/domain/commission-service";
import type { Prisma, PayrollRun } from "@/generated/prisma";

// Domain service — Payroll (PayrollProfile + PayrollRun + PayrollItem).
// Master Prompt Phần 6 mục XLIV-LIX. MỘT engine đích duy nhất, gộp
// PayrollEntry/ZWorkspacePayrollRun/ZMechanismDefinition của legacy
// (ADR-027) — xem docs/architecture/DECISIONS.md và docs/domain/PAYROLL.md.
//
// Visibility: KHÁC ADR-022 (Company-wide) của Customer/Lead/Appointment/Sale
// Phần 5 — payroll là dữ liệu cá nhân nhạy cảm, theo đúng anti-drift Q12
// ("User bình thường có thấy payroll? NO unless permission"). Actor có
// payroll.manage thấy toàn Company; actor chỉ có payroll.view (không có
// payroll.manage) chỉ thấy dữ liệu của chính mình — cùng tinh thần
// ADR-015 (WorkItem) hơn là ADR-022.

// ===== PayrollProfile — effective-dated, KHÔNG BAO GIỜ overwrite tại chỗ =====

const setPayrollProfileSchema = z.object({
  companyId: z.string().min(1),
  userId: z.string().min(1),
  baseSalary: z.number().positive(),
  // Mac dinh dau ngay hom nay theo UTC (KHONG phai gio-phut-giay hien tai)
  // — phat hien qua browser-test that: mac dinh new Date() khien 1
  // PayrollProfile thiet lap "hom nay" bi loai khoi PayrollRun cung bat dau
  // "hom nay" vi effectiveFrom (vd 11:35 sang) muon hon periodStart (00:00
  // dau ngay do) — vi pham ky vong nghiep vu hien nhien ("thiet lap luong
  // hom nay ap dung tu hom nay"). calculatePayrollRun so sanh effectiveFrom
  // <= periodStart, ca hai deu can cung chuan dau-ngay de so sanh dung y
  // nghia. Dung getUTC*/Date.UTC (khong phai gio dia phuong may chay) vi
  // periodStart/effectiveFrom deu duoc coerce tu date-only string (vd
  // "2026-10-01") — z.coerce.date() luon parse chuoi do thanh UTC midnight,
  // nen truncate cung phai theo UTC de khong lech ngay so voi input UTC
  // midnight da co san (bug thu 2 tung xay ra: truncate theo gio dia
  // phuong lam mot effectiveFrom UTC-midnight tuong minh bi lui 1 ngay tren
  // may chay o timezone lui sau UTC).
  effectiveFrom: z.coerce
    .date()
    .default(() => new Date())
    .transform((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))),
});

export async function setPayrollProfile(actorId: string, input: z.input<typeof setPayrollProfileSchema>) {
  const parsed = setPayrollProfileSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "payroll.manage");
  await assertActiveCompanyMember(company.id, parsed.userId);

  return db.$transaction(async (tx) => {
    // Đóng dòng đang hiệu lực (nếu có) tại đúng effectiveFrom mới — không
    // overwrite baseSalary tại chỗ (mục XLVIII, bài học từ User.baseSalary
    // phẳng của legacy).
    await tx.payrollProfile.updateMany({
      where: { companyId: company.id, userId: parsed.userId, effectiveTo: null },
      data: { effectiveTo: parsed.effectiveFrom },
    });
    const profile = await tx.payrollProfile.create({
      data: {
        companyId: company.id,
        userId: parsed.userId,
        baseSalary: parsed.baseSalary,
        effectiveFrom: parsed.effectiveFrom,
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYROLL_PROFILE_SET,
      targetType: "PayrollProfile",
      targetId: profile.id,
      companyId: company.id,
      metadata: { userId: parsed.userId, baseSalary: parsed.baseSalary },
    });
    return profile;
  });
}

export async function getCurrentPayrollProfile(actorId: string, companyId: string, userId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "payroll.view");
  if (!permissions.has("payroll.manage") && userId !== actor.id) {
    throw new AuthorizationError("Bạn không có quyền xem thông tin lương của người khác.");
  }
  return db.payrollProfile.findFirst({
    where: { companyId: company.id, userId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
}

// ===== PayrollRun lifecycle: DRAFT -> CALCULATED -> APPROVED -> FINALIZED/VOIDED =====

const createPayrollRunSchema = z.object({
  companyId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export async function createPayrollRun(actorId: string, input: z.input<typeof createPayrollRunSchema>) {
  const parsed = createPayrollRunSchema.parse(input);
  if (parsed.periodStart >= parsed.periodEnd) {
    throw new Error("Ngày bắt đầu kỳ lương phải trước ngày kết thúc.");
  }
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "payroll.manage");

  try {
    return await db.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          companyId: company.id,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          createdByUserId: actor.id,
        },
      });
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PAYROLL_RUN_CREATED,
        targetType: "PayrollRun",
        targetId: run.id,
        companyId: company.id,
      });
      return run;
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new Error("Đã tồn tại kỳ lương với đúng khoảng thời gian này.");
    }
    throw err;
  }
}

async function assertRunStatus(run: PayrollRun, expected: PayrollRun["status"], actionLabel: string) {
  if (run.status !== expected) {
    throw new Error(`Chỉ có thể ${actionLabel} khi kỳ lương đang ở đúng trạng thái trước đó.`);
  }
}

/** Tính lương: gom PayrollProfile hiện hành + hoa hồng chưa phân bổ (Sale
 * đã confirm trong kỳ) cho mọi thành viên đang hoạt động có PayrollProfile.
 * Bonus/deduction mặc định 0 — nhập tay riêng qua adjustPayrollItem (mục
 * LXXI, không có HR performance engine tự tính thưởng/phạt). */
export async function calculatePayrollRun(actorId: string, companyId: string, payrollRunId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "payroll.manage");
  const run = await assertSameCompanyPayrollRun(company.id, payrollRunId);
  await assertRunStatus(run, "DRAFT", "tính lương");

  const profiles = await db.payrollProfile.findMany({
    where: {
      companyId: company.id,
      effectiveFrom: { lte: run.periodStart },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: run.periodStart } }],
    },
  });

  return db.$transaction(async (tx) => {
    // Khoá row PayrollRun rồi RE-VERIFY status ngay trong transaction — check
    // "DRAFT" ở ngoài (dòng 133) không đủ dưới READ COMMITTED: 2 lần gọi
    // đồng thời đều pass check ngoài trước khi bên nào commit, cả hai đều
    // chạy vòng lặp tính lương (phát hiện qua adversarial review). Lock +
    // re-check ép request thứ 2 thấy đúng status mới nhất và tự dừng.
    await tx.$queryRaw`SELECT id FROM "PayrollRun" WHERE id = ${run.id} FOR UPDATE`;
    const lockedRun = await tx.payrollRun.findUniqueOrThrow({ where: { id: run.id } });
    await assertRunStatus(lockedRun, "DRAFT", "tính lương");

    let itemCount = 0;
    for (const profile of profiles) {
      const commissionRows = await getUnallocatedCommissionForPeriod(
        company.id,
        profile.userId,
        run.periodStart,
        run.periodEnd,
      );
      const commissionAmount = commissionRows.reduce((sum, row) => sum + Number(row.amount), 0);
      // Đọc bonus/deduction ĐÃ CÓ (nếu recalc trên item đã tồn tại) để
      // netAmount không bị lệch khỏi calculatePayrollItemTotals — bug thật
      // đã phát hiện: nhánh update trước đây tự viết tay
      // `baseAmount+commissionAmount`, làm mất bonus/deduction đã điều
      // chỉnh trước đó (ADR-032 — luôn gọi hàm calc thuần, không viết tay).
      const existingItem = await tx.payrollItem.findUnique({
        where: { payrollRunId_userId: { payrollRunId: run.id, userId: profile.userId } },
      });
      const totals = calculatePayrollItemTotals({
        baseAmount: Number(profile.baseSalary),
        commissionAmount,
        bonusAmount: existingItem ? Number(existingItem.bonusAmount) : 0,
        deductionAmount: existingItem ? Number(existingItem.deductionAmount) : 0,
      });

      const item = await tx.payrollItem.upsert({
        where: { payrollRunId_userId: { payrollRunId: run.id, userId: profile.userId } },
        create: {
          payrollRunId: run.id,
          userId: profile.userId,
          baseAmount: totals.baseAmount,
          commissionAmount: totals.commissionAmount,
          bonusAmount: totals.bonusAmount,
          deductionAmount: totals.deductionAmount,
          netAmount: totals.netAmount,
          calculationSnapshot: {
            payrollProfileId: profile.id,
            baseSalary: Number(profile.baseSalary),
            commissionCalculationIds: commissionRows.map((r) => r.id),
          },
        },
        update: {
          baseAmount: totals.baseAmount,
          commissionAmount: totals.commissionAmount,
          netAmount: totals.netAmount,
          calculationSnapshot: {
            payrollProfileId: profile.id,
            baseSalary: Number(profile.baseSalary),
            commissionCalculationIds: commissionRows.map((r) => r.id),
          },
        },
      });

      if (commissionRows.length > 0) {
        await linkCommissionCalculationsToPayrollItemTx(
          tx,
          commissionRows.map((r) => r.id),
          item.id,
        );
      }
      itemCount += 1;
    }

    const updated = await tx.payrollRun.update({ where: { id: run.id }, data: { status: "CALCULATED" } });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYROLL_RUN_CALCULATED,
      targetType: "PayrollRun",
      targetId: run.id,
      companyId: company.id,
      metadata: { itemCount },
    });
    return updated;
  });
}

/** "Kiểm tra" — bước xác nhận đơn (1 người), KHÔNG phải two-person approval
 * (đó là Finalize, xem ADR-029). */
export async function approvePayrollRun(actorId: string, companyId: string, payrollRunId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "payroll.manage");
  const run = await assertSameCompanyPayrollRun(company.id, payrollRunId);
  await assertRunStatus(run, "CALCULATED", "duyệt kiểm tra");

  return db.$transaction(async (tx) => {
    const updated = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "APPROVED", approvedByUserId: actor.id, approvedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYROLL_RUN_APPROVED,
      targetType: "PayrollRun",
      targetId: run.id,
      companyId: company.id,
    });
    return updated;
  });
}

/** "Chốt" bước 1/2 — tạo ApprovalRequest 2 người (ADR-029). */
export async function requestPayrollFinalize(actorId: string, companyId: string, payrollRunId: string, reason: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "payroll.manage");
  const run = await assertSameCompanyPayrollRun(company.id, payrollRunId);
  await assertRunStatus(run, "APPROVED", "xin chốt sổ");

  // Vệ sinh dữ liệu (không phải lỗ hổng bảo mật — finalizePayrollRun luôn
  // tự re-verify actionType/targetId/status độc lập, xem comment ở đó) —
  // tránh tạo nhiều ApprovalRequest PENDING trùng mục tiêu gây nhiễu UI/
  // audit log khi actor bấm "Xin chốt sổ" nhiều lần.
  const existing = await getApprovalRequestForTarget(company.id, "PAYROLL_FINALIZE", run.id);
  if (existing && (existing.status === "PENDING" || existing.status === "PENDING_SECOND")) {
    throw new Error("Kỳ lương này đã có yêu cầu chốt sổ đang chờ duyệt.");
  }

  return createApprovalRequest(actorId, "payroll.manage", {
    companyId: company.id,
    actionType: "PAYROLL_FINALIZE",
    targetType: "PayrollRun",
    targetId: run.id,
    reason,
  });
}

// Bọc lại 3 hàm approval-service với permission "payroll.manage" CỐ ĐỊNH ở
// tầng server — KHÔNG để Server Action/client tự chọn permission truyền
// vào (nếu client chọn được permission, một actor chỉ có vd "customer.view"
// có thể tự ý duyệt yêu cầu Finalize payroll bằng cách truyền permission
// khác mà họ có — lỗ hổng privilege escalation thật sự, không phải giả
// định). UI chỉ biết companyId/approvalRequestId, không biết/chọn permission.

export async function firstApprovePayrollFinalize(actorId: string, companyId: string, approvalRequestId: string) {
  return firstApproveRequest(actorId, "payroll.manage", companyId, approvalRequestId);
}

export async function secondApprovePayrollFinalize(actorId: string, companyId: string, approvalRequestId: string) {
  return secondApproveRequest(actorId, "payroll.manage", companyId, approvalRequestId);
}

export async function rejectPayrollFinalize(actorId: string, companyId: string, approvalRequestId: string) {
  return rejectApprovalRequest(actorId, "payroll.manage", companyId, approvalRequestId);
}

/** "Chốt" bước 2/2 — thực thi sau khi ApprovalRequest đã APPROVED. Sau bước
 * này: KHÔNG mutate ngược (ADR-027) — mỗi PayrollItem.netAmount > 0 sinh 1
 * Expense (category SALARY, sourceType PAYROLL_RUN) qua
 * finance-service.createExpenseRecordTx, KHÔNG tạo hệ thanh toán song song
 * (mục LVI). */
export async function finalizePayrollRun(
  actorId: string,
  companyId: string,
  payrollRunId: string,
  approvalRequestId: string,
) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "payroll.manage");
  const run = await assertSameCompanyPayrollRun(company.id, payrollRunId);
  await assertRunStatus(run, "APPROVED", "chốt sổ");

  return db.$transaction(async (tx) => {
    // Khoá row PayrollRun rồi RE-VERIFY status + ApprovalRequest ngay trong
    // transaction — bug thật đã phát hiện: check "APPROVED" ở ngoài
    // transaction (như dòng phía trên) không chặn được 2 lần gọi
    // finalizePayrollRun gần-đồng-thời (2 tab/network retry), cả hai đều
    // pass check trước khi bên nào commit `status: "FINALIZED"`, dẫn tới
    // ghi Expense trả lương HAI LẦN cho cùng kỳ lương — không có unique
    // constraint nào chặn Expense trùng. Lock ép request thứ 2 phải đợi
    // request thứ 1 commit xong, rồi tự thấy status đã FINALIZED và dừng.
    await tx.$queryRaw`SELECT id FROM "PayrollRun" WHERE id = ${run.id} FOR UPDATE`;
    const lockedRun = await tx.payrollRun.findUniqueOrThrow({ where: { id: run.id } });
    await assertRunStatus(lockedRun, "APPROVED", "chốt sổ");

    const approval = await tx.approvalRequest.findUnique({ where: { id: approvalRequestId } });
    if (
      !approval ||
      approval.companyId !== company.id ||
      approval.actionType !== "PAYROLL_FINALIZE" ||
      approval.targetId !== run.id ||
      approval.status !== "APPROVED"
    ) {
      throw new Error("Kỳ lương này chưa được duyệt đủ hai người — không thể chốt sổ.");
    }

    const items = await tx.payrollItem.findMany({ where: { payrollRunId: run.id } });

    const updated = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "FINALIZED", finalizedByUserId: actor.id, finalizedAt: new Date() },
    });

    let totalNetAmount = 0;
    for (const item of items) {
      const netAmount = Number(item.netAmount);
      if (netAmount <= 0) continue;
      totalNetAmount += netAmount;
      await createExpenseRecordTx(tx, {
        companyId: company.id,
        category: "SALARY",
        amount: netAmount,
        occurredAt: new Date(),
        description: `Trả lương kỳ ${run.periodStart.toISOString().slice(0, 10)} – ${run.periodEnd.toISOString().slice(0, 10)}`,
        sourceType: "PAYROLL_RUN",
        sourceId: run.id,
        createdByUserId: actor.id,
      });
    }

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYROLL_RUN_FINALIZED,
      targetType: "PayrollRun",
      targetId: run.id,
      companyId: company.id,
      metadata: { itemCount: items.length, totalNetAmount },
    });
    return updated;
  });
}

export async function voidPayrollRun(actorId: string, companyId: string, payrollRunId: string, reason: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "payroll.manage");
  const run = await assertSameCompanyPayrollRun(company.id, payrollRunId);
  if (run.status === "FINALIZED") {
    throw new Error("Kỳ lương đã chốt sổ không thể huỷ — tạo kỳ lương điều chỉnh mới nếu cần sửa.");
  }
  if (run.status === "VOIDED") {
    throw new Error("Kỳ lương này đã bị huỷ trước đó.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "VOIDED", voidedByUserId: actor.id, voidedAt: new Date(), voidReason: reason },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYROLL_RUN_VOIDED,
      targetType: "PayrollRun",
      targetId: run.id,
      companyId: company.id,
      metadata: { reason },
    });
    return updated;
  });
}

const adjustPayrollItemSchema = z.object({
  companyId: z.string().min(1),
  payrollItemId: z.string().min(1),
  bonusAmount: z.number().min(0).optional(),
  deductionAmount: z.number().min(0).optional(),
  reason: z.string().trim().min(1).max(2000),
});

/** Điều chỉnh thưởng/khấu trừ thủ công — chỉ cho phép trước khi Approve
 * (mục LXXI, nhập tay, không có HR performance engine). Sau APPROVED phải
 * quay lại từ đầu (không patch ngầm 1 dòng đã qua bước Kiểm tra). */
export async function adjustPayrollItem(actorId: string, input: z.input<typeof adjustPayrollItemSchema>) {
  const parsed = adjustPayrollItemSchema.parse(input);
  const { actor, company } = await requireCompanyContextForActor(actorId, parsed.companyId, "payroll.manage");

  const item = await db.payrollItem.findUnique({ where: { id: parsed.payrollItemId }, include: { payrollRun: true } });
  if (!item || item.payrollRun.companyId !== company.id) {
    throw new AuthorizationError("Dòng lương không hợp lệ trong công ty này.");
  }
  if (item.payrollRun.status !== "DRAFT" && item.payrollRun.status !== "CALCULATED") {
    throw new Error("Chỉ có thể điều chỉnh thưởng/khấu trừ trước khi kỳ lương được duyệt kiểm tra.");
  }

  const totals = calculatePayrollItemTotals({
    baseAmount: Number(item.baseAmount),
    commissionAmount: Number(item.commissionAmount),
    bonusAmount: parsed.bonusAmount ?? Number(item.bonusAmount),
    deductionAmount: parsed.deductionAmount ?? Number(item.deductionAmount),
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.payrollItem.update({
      where: { id: item.id },
      data: {
        bonusAmount: totals.bonusAmount,
        deductionAmount: totals.deductionAmount,
        netAmount: totals.netAmount,
        calculationSnapshot: {
          ...(item.calculationSnapshot as Prisma.JsonObject),
          lastAdjustment: { byUserId: actor.id, reason: parsed.reason },
        },
      },
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.PAYROLL_ITEM_ADJUSTED,
      targetType: "PayrollItem",
      targetId: item.id,
      companyId: company.id,
      metadata: { reason: parsed.reason },
    });
    return updated;
  });
}

// ===== Read =====

export async function getPayrollRunList(actorId: string, companyId: string) {
  const { company } = await requireCompanyContextForActor(actorId, companyId, "payroll.view");
  return db.payrollRun.findMany({ where: { companyId: company.id }, orderBy: { periodStart: "desc" } });
}

export async function getPayrollRunDetail(actorId: string, companyId: string, payrollRunId: string) {
  const { actor, company, permissions } = await requireCompanyContextForActor(actorId, companyId, "payroll.view");
  const run = await assertSameCompanyPayrollRun(company.id, payrollRunId);
  const items = await db.payrollItem.findMany({
    where: {
      payrollRunId: run.id,
      ...(permissions.has("payroll.manage") ? {} : { userId: actor.id }),
    },
    include: { user: { omit: { passwordHash: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { run, items };
}

/** "Của tôi" — self-scope luôn, không cần payroll.manage (chính đáng xem
 * lương của chính mình nếu có payroll.view, mục LIX Payslip). */
export async function getMyPayrollItems(actorId: string, companyId: string) {
  const { actor, company } = await requireCompanyContextForActor(actorId, companyId, "payroll.view");
  return db.payrollItem.findMany({
    where: { userId: actor.id, payrollRun: { companyId: company.id } },
    include: { payrollRun: true },
    orderBy: { createdAt: "desc" },
  });
}
