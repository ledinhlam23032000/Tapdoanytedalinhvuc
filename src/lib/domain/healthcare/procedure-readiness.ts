/**
 * ADR-044 — Tính "thủ thuật đã đủ điều kiện thực hiện chưa".
 *
 * PURE FUNCTION: không chạm DB, không gọi AI, không dùng Date.now()/random.
 * Cùng input luôn cho cùng output (bất biến #67/#69/#149). Caller tự đọc dữ
 * liệu rồi truyền vào — để hàm này unit-test được và để KHÔNG có đường nào
 * cho LLM quyết định readiness (mục CX-CXI: AI không authorize thủ thuật).
 *
 * Điều kiện đọc từ POLICY THEO TỪNG LOẠI thủ thuật, không hard-code một bộ
 * chung: mục CVI đòi dịch vụ chỉ-tư-vấn phải hoàn tất được mà KHÔNG cần
 * consent/screening/vật tư — một bộ điều kiện cứng sẽ chặn nhầm chính luồng
 * phổ biến nhất.
 */

export type ProcedurePolicy = {
  /** Cần ít nhất một ConsentRecord SIGNED còn hiệu lực cho ca này. */
  requiresConsent: boolean;
  /** Cần một ClinicalConsultation đã FINAL cho ca này. */
  requiresFinalizedConsultation: boolean;
  /** Cần mọi mục sàng lọc bắt buộc đã được ghi nhận (khác "chưa ghi nhận"). */
  requiresScreeningComplete: boolean;
  /** Cần có bác sĩ phụ trách được gán. */
  requiresPrimaryClinician: boolean;
};

/** Mặc định an toàn cho thủ thuật xâm lấn. Dịch vụ chỉ tư vấn dùng policy
 *  lỏng hơn (xem CONSULTATION_ONLY_POLICY). */
export const DEFAULT_PROCEDURE_POLICY: ProcedurePolicy = {
  requiresConsent: true,
  requiresFinalizedConsultation: true,
  requiresScreeningComplete: true,
  requiresPrimaryClinician: true,
};

/** Mục CVI — dịch vụ chỉ tư vấn hoàn tất được mà không cần consent/screening. */
export const CONSULTATION_ONLY_POLICY: ProcedurePolicy = {
  requiresConsent: false,
  requiresFinalizedConsultation: false,
  requiresScreeningComplete: false,
  requiresPrimaryClinician: true,
};

export type ProcedureReadinessInput = {
  caseStatus: "OPEN" | "IN_TREATMENT" | "FOLLOW_UP" | "CLOSED" | "CANCELLED";
  procedureStatus: "PLANNED" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  hasPrimaryClinician: boolean;
  hasValidSignedConsent: boolean;
  hasFinalizedConsultation: boolean;
  /** Số mục sàng lọc bắt buộc CHƯA được ghi nhận (answer === null). */
  unrecordedRequiredScreeningCount: number;
};

export type ProcedureReadiness = {
  ready: boolean;
  /** Lý do CỤ THỂ, hiển thị được cho người dùng (bất biến #68). Rỗng khi ready. */
  reasons: string[];
};

/**
 * Trả về readiness + danh sách lý do. Không ném lỗi — caller quyết định hiển
 * thị hay chặn. `reasons` luôn theo thứ tự cố định để test ổn định.
 */
export function evaluateProcedureReadiness(
  input: ProcedureReadinessInput,
  policy: ProcedurePolicy = DEFAULT_PROCEDURE_POLICY,
): ProcedureReadiness {
  const reasons: string[] = [];

  if (input.caseStatus === "CLOSED" || input.caseStatus === "CANCELLED") {
    reasons.push("Hồ sơ bệnh án đã đóng hoặc đã huỷ.");
  }
  if (input.procedureStatus === "COMPLETED") {
    reasons.push("Thủ thuật đã được thực hiện.");
  }
  if (input.procedureStatus === "CANCELLED") {
    reasons.push("Thủ thuật đã bị huỷ.");
  }
  if (policy.requiresPrimaryClinician && !input.hasPrimaryClinician) {
    reasons.push("Chưa phân công bác sĩ phụ trách.");
  }
  if (policy.requiresConsent && !input.hasValidSignedConsent) {
    reasons.push("Chưa có phiếu đồng ý đã ký còn hiệu lực.");
  }
  if (policy.requiresFinalizedConsultation && !input.hasFinalizedConsultation) {
    reasons.push("Chưa có phiếu khám được chốt.");
  }
  if (policy.requiresScreeningComplete && input.unrecordedRequiredScreeningCount > 0) {
    reasons.push(
      `Còn ${input.unrecordedRequiredScreeningCount} mục sàng lọc chưa ghi nhận.`,
    );
  }

  return { ready: reasons.length === 0, reasons };
}
