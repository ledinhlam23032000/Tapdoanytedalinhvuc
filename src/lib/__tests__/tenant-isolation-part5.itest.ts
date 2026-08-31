// Integration test suite — Tenant Isolation Matrix cho Phần 5 (CRM + Lead +
// Appointment + Sales/Catalog). Master Prompt mục XCVII-CCLIII. Cùng nguyên
// tắc với tenant-isolation-part4.itest.ts: test qua đúng entry point domain
// service thật, không test resolver cô lập.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { AuthorizationError } from "@/lib/authorization/errors";
import { hashPhone, normalizePhone } from "@/lib/crypto/phone";
import * as customerService from "@/lib/domain/customer-service";
import * as leadService from "@/lib/domain/lead-service";
import * as appointmentService from "@/lib/domain/appointment-service";
import * as salesService from "@/lib/domain/sales-service";
import * as workService from "@/lib/domain/work-service";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (/clinic|production|hongphuc|zenith/i.test(DATABASE_URL)) {
  throw new Error(
    `Refusing to run tenant-isolation-part5.itest.ts against a DB URL that looks like production/clinic: ${DATABASE_URL}`,
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
    mkUser("OwnerA5"),
    mkUser("ManagerA5"),
    mkUser("MemberA5"),
    mkUser("ViewerA5"),
    mkUser("OwnerB5"),
    mkUser("MemberB5"),
    mkUser("Outsider5"),
  ]);

  const ecosystem = await db.ecosystem.create({ data: { code: `e5-${suffix}`, name: "E5" } });

  const companyA = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p5-company-a-${suffix}`, name: "Company A5", status: "ACTIVE" },
  });
  const companyB = await db.company.create({
    data: { ecosystemId: ecosystem.id, code: `p5-company-b-${suffix}`, name: "Company B5", status: "ACTIVE" },
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

  const sourceA = await db.customerSource.create({ data: { companyId: companyA.id, name: "Facebook" } });
  const sourceB = await db.customerSource.create({ data: { companyId: companyB.id, name: "Website" } });
  const catalogItemA = await db.catalogItem.create({
    data: { companyId: companyA.id, name: "Gói tư vấn cơ bản", type: "SERVICE", defaultPrice: 500_000 },
  });
  const catalogItemB = await db.catalogItem.create({
    data: { companyId: companyB.id, name: "Sản phẩm B", type: "PRODUCT", defaultPrice: 100_000 },
  });
  const unitA = await db.organizationUnit.create({
    data: { companyId: companyA.id, type: "DEPARTMENT", name: "Phòng Kinh doanh A" },
  });
  const unitB = await db.organizationUnit.create({
    data: { companyId: companyB.id, type: "DEPARTMENT", name: "Phòng B" },
  });

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
    sourceA,
    sourceB,
    catalogItemA,
    catalogItemB,
    unitA,
    unitB,
  };
}

async function cleanup(f: Fixtures) {
  const userIds = [f.ownerA, f.managerA, f.memberA, f.viewerA, f.ownerB, f.memberB, f.outsider].map((u) => u.id);
  const companyIds = [f.companyA.id, f.companyB.id];
  await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.workItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.saleLine.deleteMany({ where: { sale: { companyId: { in: companyIds } } } });
  await db.sale.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.catalogItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.appointment.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.customerInteraction.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.lead.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.customer.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.customerSource.deleteMany({ where: { companyId: { in: companyIds } } });
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

describe("Customer — quyền cơ bản + cross-company FK (mục XCVII-CXLVI)", () => {
  it("MemberA tạo Customer trong Company A: allowed", async () => {
    const customer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Nguyễn Văn A",
      phone: "0912345678",
      sourceId: fx.sourceA.id,
    });
    expect(customer.companyId).toBe(fx.companyA.id);
    expect(customer.phoneCiphertext).not.toBeNull();
  });

  it("ViewerA (không có customer.create) tạo Customer: DENY", async () => {
    await expect(
      customerService.createCustomer(fx.viewerA.id, { companyId: fx.companyA.id, name: "X" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Tạo Customer với sourceId thuộc Company B (cross-company FK injection): DENY", async () => {
    await expect(
      customerService.createCustomer(fx.memberA.id, {
        companyId: fx.companyA.id,
        name: "X",
        sourceId: fx.sourceB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Tạo Customer với ownerUserId thuộc Company B: DENY", async () => {
    await expect(
      customerService.createCustomer(fx.memberA.id, {
        companyId: fx.companyA.id,
        name: "X",
        ownerUserId: fx.memberB.id,
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("Tạo Customer với organizationUnitId thuộc Company B: DENY", async () => {
    await expect(
      customerService.createCustomer(fx.memberA.id, {
        companyId: fx.companyA.id,
        name: "X",
        organizationUnitId: fx.unitB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("MemberA (không có customer.assign) đổi owner Customer: DENY; ManagerA (có) đổi được", async () => {
    const customer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách cần đổi owner",
    });
    await expect(
      customerService.assignCustomerOwner(fx.memberA.id, {
        companyId: fx.companyA.id,
        customerId: customer.id,
        ownerUserId: fx.memberA.id,
      }),
    ).rejects.toThrow(AuthorizationError);
    const updated = await customerService.assignCustomerOwner(fx.managerA.id, {
      companyId: fx.companyA.id,
      customerId: customer.id,
      ownerUserId: fx.managerA.id,
    });
    expect(updated.ownerUserId).toBe(fx.managerA.id);
  });

  it("MemberB thao tác trực tiếp lên Customer Company A bằng ID biết trước: DENY", async () => {
    const customer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách Company A",
    });
    await expect(customerService.updateCustomer(fx.memberB.id, { companyId: fx.companyB.id, customerId: customer.id, name: "Hack" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("Archive rồi restore Customer (customer.archive chỉ MANAGER trở lên): allowed, double-archive/double-restore bị chặn bằng lỗi nghiệp vụ", async () => {
    const customer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách sẽ archive",
    });
    await customerService.archiveCustomer(fx.managerA.id, fx.companyA.id, customer.id);
    await expect(customerService.archiveCustomer(fx.managerA.id, fx.companyA.id, customer.id)).rejects.toThrow(
      /đã được lưu trữ/,
    );
    const restored = await customerService.restoreCustomer(fx.managerA.id, fx.companyA.id, customer.id);
    expect(restored.status).toBe("ACTIVE");
    await expect(customerService.restoreCustomer(fx.managerA.id, fx.companyA.id, customer.id)).rejects.toThrow(
      /chưa được lưu trữ/,
    );
  });

  it("MemberA (không có customer.archive) archive Customer: DENY", async () => {
    const customer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách MemberA không được archive",
    });
    await expect(customerService.archiveCustomer(fx.memberA.id, fx.companyA.id, customer.id)).rejects.toThrow(
      AuthorizationError,
    );
  });
});

describe("Customer — duplicate detection (mục XVI-XIX)", () => {
  it("Trùng SĐT chuẩn hoá trong cùng Company: findPossibleDuplicateCustomers trả về gợi ý, KHÔNG chặn tạo mới", async () => {
    const phone = "0987000111";
    const original = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách gốc",
      phone,
    });
    const duplicates = await customerService.findPossibleDuplicateCustomers(fx.memberA.id, fx.companyA.id, phone);
    expect(duplicates.map((d) => d.id)).toContain(original.id);

    // Tạo tiếp Customer thứ 2 cùng SĐT vẫn PASS — chỉ cảnh báo, không chặn (mục XVIII).
    const second = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách trùng SĐT",
      phone,
    });
    expect(second.id).not.toBe(original.id);
  });

  it("findPossibleDuplicateCustomers không throw khi phoneRaw rỗng, trả về mảng rỗng", async () => {
    await expect(customerService.findPossibleDuplicateCustomers(fx.memberA.id, fx.companyA.id, "")).resolves.toEqual(
      [],
    );
  });

  it("Trùng SĐT ở Company khác nhau KHÔNG bị gộp/nhìn thấy chéo", async () => {
    const phone = "0977222333";
    await customerService.createCustomer(fx.memberA.id, { companyId: fx.companyA.id, name: "Khách A", phone });
    const duplicatesInB = await customerService.findPossibleDuplicateCustomers(fx.memberB.id, fx.companyB.id, phone);
    expect(duplicatesInB).toEqual([]);
  });
});

describe("Customer — visibility Company-wide, KHÔNG self-scope (ADR-022)", () => {
  it("MemberA thấy Customer do ManagerA tạo (không phải chỉ Customer của chính mình) — ngược lại hoàn toàn với WorkItem Phần 4", async () => {
    const byManager = await customerService.createCustomer(fx.managerA.id, {
      companyId: fx.companyA.id,
      name: "Khách của Manager",
    });
    const list = await customerService.getCustomerList(fx.memberA.id, fx.companyA.id);
    expect(list.map((c) => c.id)).toContain(byManager.id);
  });

  it("ViewerA (chỉ có customer.view) vẫn thấy toàn bộ danh sách Customer của Company", async () => {
    const list = await customerService.getCustomerList(fx.viewerA.id, fx.companyA.id);
    expect(list.length).toBeGreaterThan(0);
  });
});

describe("Lead — vòng đời + convert (ADR-017, mục IX-XIII)", () => {
  it("MemberA tạo Lead: allowed", async () => {
    const lead = await leadService.createLead(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Lead A",
      phone: "0911222333",
      sourceId: fx.sourceA.id,
    });
    expect(lead.status).toBe("NEW");
  });

  it("MemberA (không có lead.assign) đổi owner Lead: DENY; ManagerA đổi được", async () => {
    const lead = await leadService.createLead(fx.memberA.id, { companyId: fx.companyA.id, name: "Lead cần đổi owner" });
    await expect(
      leadService.assignLeadOwner(fx.memberA.id, { companyId: fx.companyA.id, leadId: lead.id, ownerUserId: fx.memberA.id }),
    ).rejects.toThrow(AuthorizationError);
    const updated = await leadService.assignLeadOwner(fx.managerA.id, {
      companyId: fx.companyA.id,
      leadId: lead.id,
      ownerUserId: fx.managerA.id,
    });
    expect(updated.ownerUserId).toBe(fx.managerA.id);
  });

  it("Convert Lead (không trùng SĐT với Customer nào): tạo Customer mới, Lead chuyển CONVERTED, sinh 1 WorkItem follow-up", async () => {
    const lead = await leadService.createLead(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Lead sẽ convert",
      phone: "0933444555",
      ownerUserId: fx.memberA.id,
    });
    const { lead: converted, customer } = await leadService.convertLead(fx.memberA.id, fx.companyA.id, lead.id);
    expect(converted.status).toBe("CONVERTED");
    expect(converted.convertedCustomerId).toBe(customer.id);
    expect(customer.name).toBe("Lead sẽ convert");

    const work = await workService.getOpenWorkForCustomer(fx.memberA.id, fx.companyA.id, customer.id);
    expect(work.length).toBeGreaterThan(0);
  });

  it("Convert Lead trùng SĐT với Customer đã có: TÁI DÙNG Customer đó, không tạo bản trùng", async () => {
    const phone = "0955666777";
    const existingCustomer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách đã tồn tại",
      phone,
    });
    const lead = await leadService.createLead(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Lead trùng SĐT khách cũ",
      phone,
    });
    const { customer } = await leadService.convertLead(fx.memberA.id, fx.companyA.id, lead.id);
    expect(customer.id).toBe(existingCustomer.id);
  });

  it("Convert Lead đã CONVERTED lần 2: DENY bằng lỗi nghiệp vụ, Lead KHÔNG bị xoá (mục XIII)", async () => {
    const lead = await leadService.createLead(fx.memberA.id, { companyId: fx.companyA.id, name: "Lead convert 2 lần" });
    await leadService.convertLead(fx.memberA.id, fx.companyA.id, lead.id);
    await expect(leadService.convertLead(fx.memberA.id, fx.companyA.id, lead.id)).rejects.toThrow(/đã được chuyển đổi/);
    const stillExists = await db.lead.findUnique({ where: { id: lead.id } });
    expect(stillExists).not.toBeNull();
  });

  it("MemberB convert Lead của Company A bằng ID biết trước: DENY", async () => {
    const lead = await leadService.createLead(fx.memberA.id, { companyId: fx.companyA.id, name: "Lead Company A" });
    await expect(leadService.convertLead(fx.memberB.id, fx.companyB.id, lead.id)).rejects.toThrow(AuthorizationError);
  });
});

describe("Appointment — cross-company + conflict + no-show follow-up (mục XLII-LIX)", () => {
  it("MemberA tạo Appointment không cần Customer (customerId optional, ADR-018): allowed", async () => {
    const appointment = await appointmentService.createAppointment(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Họp nội bộ",
      startAt: new Date("2026-09-10T02:00:00.000Z"),
    });
    expect(appointment.customerId).toBeNull();
  });

  it("Tạo Appointment với customerId thuộc Company B: DENY", async () => {
    const customerB = await customerService.createCustomer(fx.memberB.id, { companyId: fx.companyB.id, name: "Khách B" });
    await expect(
      appointmentService.createAppointment(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "X",
        startAt: new Date("2026-09-10T03:00:00.000Z"),
        customerId: customerB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Tạo Appointment với assignedUserId thuộc Company B: DENY", async () => {
    await expect(
      appointmentService.createAppointment(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "X",
        startAt: new Date("2026-09-10T03:00:00.000Z"),
        assignedUserId: fx.memberB.id,
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("Tạo Appointment với organizationUnitId thuộc Company B: DENY", async () => {
    await expect(
      appointmentService.createAppointment(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "X",
        startAt: new Date("2026-09-10T03:30:00.000Z"),
        organizationUnitId: fx.unitB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Trùng giờ cho cùng assignedUserId: DENY bằng lỗi nghiệp vụ", async () => {
    const startAt = new Date("2026-09-11T04:00:00.000Z");
    const endAt = new Date("2026-09-11T05:00:00.000Z");
    await appointmentService.createAppointment(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Lịch hẹn 1",
      startAt,
      endAt,
      assignedUserId: fx.managerA.id,
    });
    await expect(
      appointmentService.createAppointment(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "Lịch hẹn trùng giờ",
        startAt: new Date("2026-09-11T04:30:00.000Z"),
        endAt: new Date("2026-09-11T05:30:00.000Z"),
        assignedUserId: fx.managerA.id,
      }),
    ).rejects.toThrow(/trùng giờ/);
  });

  it("No-show sinh đúng 1 WorkItem follow-up, xử lý lại (idempotent) không tạo thêm bản thứ 2", async () => {
    const appointment = await appointmentService.createAppointment(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Lịch hẹn sẽ No-show",
      startAt: new Date("2026-09-12T02:00:00.000Z"),
      assignedUserId: fx.memberA.id,
    });
    await appointmentService.markNoShow(fx.memberA.id, fx.companyA.id, appointment.id);
    const workAfterFirst = await db.workItem.findMany({ where: { companyId: fx.companyA.id, appointmentId: appointment.id } });
    expect(workAfterFirst.length).toBe(1);

    // markNoShow lần 2 phải bị chặn bởi status guard (không còn SCHEDULED/CONFIRMED),
    // xác nhận hàm không chạy lại logic sinh Work.
    await expect(appointmentService.markNoShow(fx.memberA.id, fx.companyA.id, appointment.id)).rejects.toThrow(
      /chưa kết thúc/,
    );
    const workAfterSecond = await db.workItem.findMany({ where: { companyId: fx.companyA.id, appointmentId: appointment.id } });
    expect(workAfterSecond.length).toBe(1);
  });

  it("MemberB thao tác trực tiếp lên Appointment Company A: DENY", async () => {
    const appointment = await appointmentService.createAppointment(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Appointment Company A",
      startAt: new Date("2026-09-13T02:00:00.000Z"),
    });
    await expect(appointmentService.cancelAppointment(fx.memberB.id, fx.companyB.id, appointment.id)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("Appointment visibility Company-wide (ADR-022): MemberA thấy Appointment do ManagerA tạo", async () => {
    const byManager = await appointmentService.createAppointment(fx.managerA.id, {
      companyId: fx.companyA.id,
      title: "Appointment của Manager",
      startAt: new Date("2026-09-14T02:00:00.000Z"),
    });
    const list = await appointmentService.getAppointmentList(fx.memberA.id, fx.companyA.id);
    expect(list.map((a) => a.id)).toContain(byManager.id);
  });
});

describe("WorkItem — attribution CRM cross-company (mở rộng Phần 4, mục CXIII/CLXXXV)", () => {
  it("createWorkItem với customerId thuộc Company B: DENY", async () => {
    const customerB = await customerService.createCustomer(fx.memberB.id, {
      companyId: fx.companyB.id,
      name: "Khách B cho WorkItem",
    });
    await expect(
      workService.createWorkItem(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "X",
        customerId: customerB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("createWorkItem với appointmentId thuộc Company B: DENY", async () => {
    const appointmentB = await appointmentService.createAppointment(fx.memberB.id, {
      companyId: fx.companyB.id,
      title: "Lịch hẹn Company B",
      startAt: new Date("2026-09-16T02:00:00.000Z"),
    });
    await expect(
      workService.createWorkItem(fx.memberA.id, {
        companyId: fx.companyA.id,
        title: "X",
        appointmentId: appointmentB.id,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("getOpenWorkForCustomer/hasOpenWorkItemForAppointment chỉ trả về đúng phạm vi Company đang truy vấn", async () => {
    const customerA = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách A cho WorkItem",
    });
    await workService.createWorkItem(fx.memberA.id, {
      companyId: fx.companyA.id,
      title: "Việc gắn khách A",
      customerId: customerA.id,
      assigneeUserId: fx.memberA.id,
    });
    // Company B hỏi cùng customerId (không tồn tại ở B) — vẫn phải trả rỗng, không leak.
    const crossCompanyResult = await workService.getOpenWorkForCustomer(fx.memberB.id, fx.companyB.id, customerA.id);
    expect(crossCompanyResult).toEqual([]);
  });
});

describe("Sales/Catalog — cross-company + money integrity + lifecycle (mục LX-LXXXIII, CLXXV-CLXXXIII)", () => {
  it("MemberA tạo Sale với lines hợp lệ: tổng tiền tính đúng, DRAFT", async () => {
    const sale = await salesService.createSale(fx.memberA.id, {
      companyId: fx.companyA.id,
      lines: [
        { catalogItemId: fx.catalogItemA.id, description: "Gói tư vấn", quantity: 2, unitPrice: 500_000, discountAmount: 50_000 },
      ],
    });
    expect(sale.status).toBe("DRAFT");
    expect(Number(sale.subtotalAmount)).toBe(1_000_000);
    expect(Number(sale.discountAmount)).toBe(50_000);
    expect(Number(sale.totalAmount)).toBe(950_000);
    expect(sale.salespersonUserId).toBe(fx.memberA.id); // mặc định actor nếu không truyền
  });

  it("Sale với customerId thuộc Company B: DENY", async () => {
    const customerB = await customerService.createCustomer(fx.memberB.id, { companyId: fx.companyB.id, name: "Khách B cho Sale" });
    await expect(
      salesService.createSale(fx.memberA.id, { companyId: fx.companyA.id, customerId: customerB.id, lines: [] }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Sale với catalogItemId thuộc Company B: DENY", async () => {
    await expect(
      salesService.createSale(fx.memberA.id, {
        companyId: fx.companyA.id,
        lines: [{ catalogItemId: fx.catalogItemB.id, description: "X", quantity: 1, unitPrice: 1000 }],
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Sale với salespersonUserId thuộc Company B: DENY", async () => {
    await expect(
      salesService.createSale(fx.memberA.id, {
        companyId: fx.companyA.id,
        salespersonUserId: fx.memberB.id,
        lines: [],
      }),
    ).rejects.toThrow(/thành viên đang hoạt động/);
  });

  it("Sale với organizationUnitId thuộc Company B: DENY", async () => {
    await expect(
      salesService.createSale(fx.memberA.id, {
        companyId: fx.companyA.id,
        organizationUnitId: fx.unitB.id,
        lines: [],
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Thêm dòng tham chiếu CatalogItem đã ngừng bán (active=false): DENY", async () => {
    const inactiveItem = await db.catalogItem.create({
      data: { companyId: fx.companyA.id, name: "Đã ngừng bán", type: "SERVICE", active: false },
    });
    await expect(
      salesService.createSale(fx.memberA.id, {
        companyId: fx.companyA.id,
        lines: [{ catalogItemId: inactiveItem.id, description: "X", quantity: 1, unitPrice: 1000 }],
      }),
    ).rejects.toThrow(/ngừng bán/);
  });

  it("Đổi CatalogItem.defaultPrice sau khi Sale đã tạo KHÔNG hồi tố SaleLine đã snapshot (mục LXXII)", async () => {
    const item = await db.catalogItem.create({
      data: { companyId: fx.companyA.id, name: "Giá sẽ đổi", type: "SERVICE", defaultPrice: 200_000 },
    });
    const sale = await salesService.createSale(fx.memberA.id, {
      companyId: fx.companyA.id,
      lines: [{ catalogItemId: item.id, description: "Dịch vụ", quantity: 1, unitPrice: 200_000 }],
    });
    await salesService.updateCatalogItem(fx.ownerA.id, {
      companyId: fx.companyA.id,
      catalogItemId: item.id,
      defaultPrice: 999_999,
    });
    const detail = await salesService.getSaleDetail(fx.memberA.id, fx.companyA.id, sale.id);
    expect(Number(detail!.lines[0]!.unitPrice)).toBe(200_000);
  });

  it("Confirm Sale không có dòng nào: DENY", async () => {
    const sale = await salesService.createSale(fx.memberA.id, { companyId: fx.companyA.id, lines: [] });
    await expect(salesService.confirmSale(fx.memberA.id, fx.companyA.id, sale.id)).rejects.toThrow(/ít nhất 1 dòng/);
  });

  it("Confirm rồi sửa (updateDraftSale) bị chặn — Sale đã Confirmed không sửa ngầm được (mục CXIX)", async () => {
    const sale = await salesService.createSale(fx.memberA.id, {
      companyId: fx.companyA.id,
      lines: [{ catalogItemId: fx.catalogItemA.id, description: "X", quantity: 1, unitPrice: 100_000 }],
    });
    await salesService.confirmSale(fx.memberA.id, fx.companyA.id, sale.id);
    await expect(
      salesService.updateDraftSale(fx.memberA.id, { companyId: fx.companyA.id, saleId: sale.id, lines: [] }),
    ).rejects.toThrow(/trạng thái Nháp/);
  });

  it("MemberA (không có sales.cancel) huỷ Sale đã Confirmed: DENY; ManagerA huỷ được, giữ lịch sử (không xoá)", async () => {
    const sale = await salesService.createSale(fx.memberA.id, {
      companyId: fx.companyA.id,
      lines: [{ catalogItemId: fx.catalogItemA.id, description: "X", quantity: 1, unitPrice: 100_000 }],
    });
    await salesService.confirmSale(fx.memberA.id, fx.companyA.id, sale.id);
    await expect(salesService.cancelSale(fx.memberA.id, fx.companyA.id, sale.id)).rejects.toThrow(AuthorizationError);
    const cancelled = await salesService.cancelSale(fx.managerA.id, fx.companyA.id, sale.id);
    expect(cancelled.status).toBe("CANCELLED");
    const stillExists = await db.sale.findUnique({ where: { id: sale.id } });
    expect(stillExists).not.toBeNull();
  });

  it("Sale visibility Company-wide (ADR-022): MemberA thấy Sale do ManagerA tạo", async () => {
    const byManager = await salesService.createSale(fx.managerA.id, { companyId: fx.companyA.id, lines: [] });
    const list = await salesService.getSaleList(fx.memberA.id, fx.companyA.id);
    expect(list.map((s) => s.id)).toContain(byManager.id);
  });

  it("ViewerA (không có sales.create) tạo Sale: DENY", async () => {
    await expect(salesService.createSale(fx.viewerA.id, { companyId: fx.companyA.id, lines: [] })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("catalog.manage: ManagerA (không có, chỉ catalog.view) tạo CatalogItem: DENY; OwnerA tạo được", async () => {
    await expect(
      salesService.createCatalogItem(fx.managerA.id, { companyId: fx.companyA.id, name: "X", type: "SERVICE" }),
    ).rejects.toThrow(AuthorizationError);
    const item = await salesService.createCatalogItem(fx.ownerA.id, {
      companyId: fx.companyA.id,
      name: "Sản phẩm mới",
      type: "PRODUCT",
      defaultPrice: 10_000,
    });
    expect(item.companyId).toBe(fx.companyA.id);
  });
});

describe("Suspended Company chặn ghi Phần 5 (mục CXLVII)", () => {
  it("Company A suspended → createCustomer/createLead/createAppointment/createSale/createCatalogItem đều DENY, đọc vẫn được", async () => {
    await db.company.update({ where: { id: fx.companyA.id }, data: { status: "SUSPENDED" } });
    try {
      await expect(
        customerService.createCustomer(fx.ownerA.id, { companyId: fx.companyA.id, name: "X" }),
      ).rejects.toThrow(AuthorizationError);
      await expect(leadService.createLead(fx.ownerA.id, { companyId: fx.companyA.id, name: "X" })).rejects.toThrow(
        AuthorizationError,
      );
      await expect(
        appointmentService.createAppointment(fx.ownerA.id, {
          companyId: fx.companyA.id,
          title: "X",
          startAt: new Date("2026-09-15T02:00:00.000Z"),
        }),
      ).rejects.toThrow(AuthorizationError);
      await expect(salesService.createSale(fx.ownerA.id, { companyId: fx.companyA.id, lines: [] })).rejects.toThrow(
        AuthorizationError,
      );
      await expect(
        salesService.createCatalogItem(fx.ownerA.id, { companyId: fx.companyA.id, name: "X", type: "SERVICE" }),
      ).rejects.toThrow(AuthorizationError);

      const list = await customerService.getCustomerList(fx.ownerA.id, fx.companyA.id);
      expect(Array.isArray(list)).toBe(true);
    } finally {
      await db.company.update({ where: { id: fx.companyA.id }, data: { status: "ACTIVE" } });
    }
  });
});

describe("Phone encryption tại rest thật (ADR-023) — không chỉ unit test cô lập", () => {
  it("Customer.phoneCiphertext không phải plaintext, nhưng phoneHash tra đúng qua getCustomerDetail", async () => {
    const phone = "0966123456";
    const customer = await customerService.createCustomer(fx.memberA.id, {
      companyId: fx.companyA.id,
      name: "Khách kiểm tra mã hoá",
      phone,
    });
    const raw = await db.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(raw.phoneCiphertext).not.toContain("0966123456");
    expect(raw.phoneHash).toBe(hashPhone(normalizePhone(phone)));

    const detail = await customerService.getCustomerDetail(fx.memberA.id, fx.companyA.id, customer.id);
    expect(detail.phone).toBe(normalizePhone(phone));
    expect((detail as Record<string, unknown>).phoneCiphertext).toBeUndefined();
  });
});
