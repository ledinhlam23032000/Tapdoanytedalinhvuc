import { describe, expect, it } from "vitest";
import {
  evaluateProcedureReadiness,
  DEFAULT_PROCEDURE_POLICY,
  CONSULTATION_ONLY_POLICY,
  type ProcedureReadinessInput,
} from "@/lib/domain/healthcare/procedure-readiness";

const ready: ProcedureReadinessInput = {
  caseStatus: "IN_TREATMENT",
  procedureStatus: "PLANNED",
  hasPrimaryClinician: true,
  hasValidSignedConsent: true,
  hasFinalizedConsultation: true,
  unrecordedRequiredScreeningCount: 0,
};

describe("evaluateProcedureReadiness (ADR-044)", () => {
  it("đủ điều kiện: ready, không lý do nào", () => {
    expect(evaluateProcedureReadiness(ready)).toEqual({ ready: true, reasons: [] });
  });

  it("#68 thiếu consent -> not ready VÀ nêu rõ lý do", () => {
    const r = evaluateProcedureReadiness({ ...ready, hasValidSignedConsent: false });
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain("Chưa có phiếu đồng ý đã ký còn hiệu lực.");
  });

  it("#67 deterministic: gọi 2 lần cùng input cho kết quả y hệt", () => {
    const input = { ...ready, hasValidSignedConsent: false, unrecordedRequiredScreeningCount: 2 };
    expect(evaluateProcedureReadiness(input)).toEqual(evaluateProcedureReadiness(input));
  });

  it("gom ĐỦ mọi lý do, không dừng ở lý do đầu tiên", () => {
    const r = evaluateProcedureReadiness({
      caseStatus: "CLOSED",
      procedureStatus: "PLANNED",
      hasPrimaryClinician: false,
      hasValidSignedConsent: false,
      hasFinalizedConsultation: false,
      unrecordedRequiredScreeningCount: 3,
    });
    expect(r.ready).toBe(false);
    expect(r.reasons).toHaveLength(5);
  });

  it("mục CVI — dịch vụ chỉ tư vấn KHÔNG cần consent/screening/phiếu khám", () => {
    const r = evaluateProcedureReadiness(
      {
        ...ready,
        hasValidSignedConsent: false,
        hasFinalizedConsultation: false,
        unrecordedRequiredScreeningCount: 5,
      },
      CONSULTATION_ONLY_POLICY,
    );
    expect(r).toEqual({ ready: true, reasons: [] });
  });

  it("hồ sơ đã đóng thì không bao giờ ready, kể cả policy lỏng nhất", () => {
    const r = evaluateProcedureReadiness({ ...ready, caseStatus: "CLOSED" }, CONSULTATION_ONLY_POLICY);
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain("Hồ sơ bệnh án đã đóng hoặc đã huỷ.");
  });

  it("thủ thuật đã COMPLETED không ready lại (chống thực hiện 2 lần)", () => {
    const r = evaluateProcedureReadiness({ ...ready, procedureStatus: "COMPLETED" });
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain("Thủ thuật đã được thực hiện.");
  });

  it("số mục sàng lọc chưa ghi nhận hiện đúng trong lý do", () => {
    const r = evaluateProcedureReadiness({ ...ready, unrecordedRequiredScreeningCount: 4 });
    expect(r.reasons).toContain("Còn 4 mục sàng lọc chưa ghi nhận.");
  });

  it("policy mặc định bật đủ 4 điều kiện (chống nới lỏng ngầm)", () => {
    expect(DEFAULT_PROCEDURE_POLICY).toEqual({
      requiresConsent: true,
      requiresFinalizedConsultation: true,
      requiresScreeningComplete: true,
      requiresPrimaryClinician: true,
    });
  });
});
