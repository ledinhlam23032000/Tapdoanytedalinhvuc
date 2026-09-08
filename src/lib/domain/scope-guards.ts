import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/authorization/errors";

// Guard dùng chung cho cross-entity FK trong phạm vi 1 Company — trước khi
// dùng bất kỳ ID nào actor tự truyền (parentId, positionId,
// organizationUnitId, projectId, assigneeUserId, userId...), luôn xác nhận
// nó thuộc ĐÚNG companyId đang thao tác (chống cross-company ID injection,
// xem docs/architecture/TENANT_INVARIANTS.md). Trước đây 3 domain service
// (organization/work/project) mỗi nơi tự viết lại logic này — hợp nhất sau
// simplicity review Phần 4.

export async function assertSameCompanyOrganizationUnit(companyId: string, unitId: string) {
  const unit = await db.organizationUnit.findUnique({ where: { id: unitId } });
  if (!unit || unit.companyId !== companyId) {
    throw new AuthorizationError("Đơn vị tổ chức không hợp lệ trong công ty này.");
  }
  return unit;
}

export async function assertSameCompanyProject(companyId: string, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.companyId !== companyId) {
    throw new AuthorizationError("Dự án không hợp lệ trong công ty này.");
  }
  return project;
}

export async function assertActiveCompanyMember(companyId: string, userId: string): Promise<void> {
  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Người dùng phải là thành viên đang hoạt động của công ty này.");
  }
}

// Phần 5 — CRM + Sales + Appointment

export async function assertSameCompanyCustomer(companyId: string, customerId: string) {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.companyId !== companyId) {
    throw new AuthorizationError("Khách hàng không hợp lệ trong công ty này.");
  }
  return customer;
}

export async function assertSameCompanyAppointment(companyId: string, appointmentId: string) {
  const appointment = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.companyId !== companyId) {
    throw new AuthorizationError("Lịch hẹn không hợp lệ trong công ty này.");
  }
  return appointment;
}

export async function assertSameCompanyCatalogItem(companyId: string, catalogItemId: string) {
  const item = await db.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item || item.companyId !== companyId) {
    throw new AuthorizationError("Sản phẩm/dịch vụ không hợp lệ trong công ty này.");
  }
  return item;
}

export async function assertSameCompanyCustomerSource(companyId: string, sourceId: string) {
  const source = await db.customerSource.findUnique({ where: { id: sourceId } });
  if (!source || source.companyId !== companyId) {
    throw new AuthorizationError("Nguồn khách hàng không hợp lệ trong công ty này.");
  }
  return source;
}

export async function assertSameCompanySale(companyId: string, saleId: string) {
  const sale = await db.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.companyId !== companyId) {
    throw new AuthorizationError("Giao dịch không hợp lệ trong công ty này.");
  }
  return sale;
}

// Phần 6 — Finance + Payroll + Commission + Inventory

export async function assertSameCompanyPayment(companyId: string, paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.companyId !== companyId) {
    throw new AuthorizationError("Khoản thanh toán không hợp lệ trong công ty này.");
  }
  return payment;
}

export async function assertSameCompanyExpense(companyId: string, expenseId: string) {
  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.companyId !== companyId) {
    throw new AuthorizationError("Khoản chi không hợp lệ trong công ty này.");
  }
  return expense;
}

export async function assertSameCompanyLedgerEntry(companyId: string, entryId: string) {
  const entry = await db.ledgerEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.companyId !== companyId) {
    throw new AuthorizationError("Bút toán sổ cái không hợp lệ trong công ty này.");
  }
  return entry;
}

export async function assertSameCompanyPayrollRun(companyId: string, payrollRunId: string) {
  const run = await db.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (!run || run.companyId !== companyId) {
    throw new AuthorizationError("Kỳ lương không hợp lệ trong công ty này.");
  }
  return run;
}

export async function assertSameCompanyCommissionRule(companyId: string, ruleId: string) {
  const rule = await db.commissionRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.companyId !== companyId) {
    throw new AuthorizationError("Quy tắc hoa hồng không hợp lệ trong công ty này.");
  }
  return rule;
}

export async function assertSameCompanyInventoryItem(companyId: string, inventoryItemId: string) {
  const item = await db.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item || item.companyId !== companyId) {
    throw new AuthorizationError("Mặt hàng tồn kho không hợp lệ trong công ty này.");
  }
  return item;
}

export async function assertSameCompanyInventoryLocation(companyId: string, locationId: string) {
  const location = await db.inventoryLocation.findUnique({ where: { id: locationId } });
  if (!location || location.companyId !== companyId) {
    throw new AuthorizationError("Kho/địa điểm không hợp lệ trong công ty này.");
  }
  return location;
}

// ===== Phần 7 — Healthcare Vertical (ADR-038) =====
// Mỗi entity đọc companyId của CHÍNH NÓ. Tuyệt đối không suy Company qua
// customerId -> Customer.companyId: đó chính là lớp lỗ hổng mà legacy mắc
// phải ở dạng khác (không model nào có tenant scoping, phân quyền toàn bộ
// nằm ở tầng ứng dụng).

export async function assertSameCompanyMedicalCase(companyId: string, medicalCaseId: string) {
  const record = await db.medicalCase.findUnique({ where: { id: medicalCaseId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Hồ sơ bệnh án không hợp lệ trong công ty này.");
  }
  return record;
}

export async function assertSameCompanyConsultation(companyId: string, consultationId: string) {
  const record = await db.clinicalConsultation.findUnique({ where: { id: consultationId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Phiếu khám không hợp lệ trong công ty này.");
  }
  return record;
}

export async function assertSameCompanyProcedure(companyId: string, procedureId: string) {
  const record = await db.procedure.findUnique({ where: { id: procedureId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Thủ thuật không hợp lệ trong công ty này.");
  }
  return record;
}

export async function assertSameCompanyConsentTemplate(companyId: string, templateId: string) {
  const record = await db.consentTemplate.findUnique({ where: { id: templateId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Mẫu phiếu đồng ý không hợp lệ trong công ty này.");
  }
  return record;
}

export async function assertSameCompanyConsentRecord(companyId: string, consentId: string) {
  const record = await db.consentRecord.findUnique({ where: { id: consentId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Phiếu đồng ý không hợp lệ trong công ty này.");
  }
  return record;
}

export async function assertSameCompanyClinicalPhoto(companyId: string, photoId: string) {
  const record = await db.clinicalPhoto.findUnique({ where: { id: photoId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Ảnh lâm sàng không hợp lệ trong công ty này.");
  }
  return record;
}

export async function assertSameCompanyMedicalFollowUp(companyId: string, followUpId: string) {
  const record = await db.medicalFollowUp.findUnique({ where: { id: followUpId } });
  if (!record || record.companyId !== companyId) {
    throw new AuthorizationError("Lịch theo dõi không hợp lệ trong công ty này.");
  }
  return record;
}

/** Người được gán vai trò (bác sĩ phụ trách, người thực hiện...) phải là
 * thành viên ACTIVE của đúng Company — không suy company qua bảng User
 * (bảng toàn cục, không tenant-scoped). P0 fix (red-team CONFIRMED, đã
 * chứng minh bằng exploit thật): planProcedure từng bỏ sót guard này, cho
 * phép gán primaryClinicianUserId là User của Company khác/không Company
 * nào — vừa rò rỉ displayName/email cross-tenant qua include, vừa phá đúng
 * bất biến ADR-038. */
export async function assertActiveMemberOfCompany(companyId: string, userId: string) {
  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new AuthorizationError("Người được gán không phải thành viên đang hoạt động của công ty này.");
  }
}
