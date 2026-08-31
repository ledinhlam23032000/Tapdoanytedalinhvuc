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
