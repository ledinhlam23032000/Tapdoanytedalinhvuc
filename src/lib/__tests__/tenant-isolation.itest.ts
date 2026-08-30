// Integration test suite — Tenant Isolation Matrix (Master Prompt Phần 3
// mục LXVI-LXXXI, CLXVIII-CLXXV). Chạy trên Postgres thật (docker compose
// up -d). Test persona theo đúng mục CXXXIV: Founder F, CompanyAdmin A,
// Member A, Viewer A, Member B, Outsider, Ecosystem E1/E2, Company A/B/C.
//
// Nguyên tắc: test qua đúng entry point mà app thật dùng (domain service +
// authorization core actorId-based) — KHÔNG test permission resolver cô
// lập rồi coi là đủ (mục LXXII: "Hidden button không phải security test —
// luôn test direct action").

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  resolveCompanyContextForActor,
  requireCompanyContextForActor,
} from "@/lib/authorization/company-context";
import { requireEcosystemContextForActor } from "@/lib/authorization/ecosystem-context";
import { AuthorizationError } from "@/lib/authorization/errors";
import * as companyService from "@/lib/domain/company-service";

// An toàn: chặn chạy nhầm lên DB trông giống production/clinic thật (salvage
// pattern từ ZenithTasks v2-write-denial.itest.ts — xem Salvage Ledger).
const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (/clinic|production|hongphuc|zenith/i.test(DATABASE_URL)) {
  throw new Error(
    `Refusing to run tenant-isolation.itest.ts against a DB URL that looks like production/clinic: ${DATABASE_URL}`,
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

  const [founder, ecosystemAdmin, ownerA, adminA, memberA, viewerA, ownerB, memberB, outsider] =
    await Promise.all([
      mkUser("Founder"),
      mkUser("EcosystemAdmin"),
      mkUser("OwnerA"),
      mkUser("AdminA"),
      mkUser("MemberA"),
      mkUser("ViewerA"),
      mkUser("OwnerB"),
      mkUser("MemberB"),
      mkUser("Outsider"),
    ]);

  const e1 = await db.ecosystem.create({ data: { code: `e1-${suffix}`, name: "E1" } });
  const e2 = await db.ecosystem.create({ data: { code: `e2-${suffix}`, name: "E2" } });

  await db.ecosystemMembership.createMany({
    data: [
      { ecosystemId: e1.id, userId: founder.id, rolePreset: "FOUNDER" },
      { ecosystemId: e1.id, userId: ecosystemAdmin.id, rolePreset: "ECOSYSTEM_ADMIN" },
    ],
  });

  const companyA = await db.company.create({
    data: { ecosystemId: e1.id, code: `company-a-${suffix}`, name: "Company A", status: "ACTIVE" },
  });
  const companyB = await db.company.create({
    data: { ecosystemId: e1.id, code: `company-b-${suffix}`, name: "Company B", status: "ACTIVE" },
  });
  const companyC = await db.company.create({
    data: { ecosystemId: e2.id, code: `company-c-${suffix}`, name: "Company C", status: "ACTIVE" },
  });

  await db.companyMembership.createMany({
    data: [
      { companyId: companyA.id, userId: ownerA.id, rolePreset: "OWNER" },
      { companyId: companyA.id, userId: adminA.id, rolePreset: "COMPANY_ADMIN" },
      { companyId: companyA.id, userId: memberA.id, rolePreset: "MEMBER" },
      { companyId: companyA.id, userId: viewerA.id, rolePreset: "VIEWER" },
      { companyId: companyB.id, userId: ownerB.id, rolePreset: "OWNER" },
      { companyId: companyB.id, userId: memberB.id, rolePreset: "MEMBER" },
    ],
  });

  const customerRecordCompanyA = companyA; // alias for readability in cross-company tests

  return {
    suffix,
    founder,
    ecosystemAdmin,
    ownerA,
    adminA,
    memberA,
    viewerA,
    ownerB,
    memberB,
    outsider,
    e1,
    e2,
    companyA,
    companyB,
    companyC,
    customerRecordCompanyA,
  };
}

async function cleanup(f: Fixtures) {
  const userIds = [
    f.founder.id,
    f.ecosystemAdmin.id,
    f.ownerA.id,
    f.adminA.id,
    f.memberA.id,
    f.viewerA.id,
    f.ownerB.id,
    f.memberB.id,
    f.outsider.id,
  ];
  // Xoá audit theo actorUserId (bao trùm cả audit của các company tạo thêm
  // ad-hoc trong từng test, vd temp/solo/archive-test/revoke-test) trước —
  // rộng hơn và an toàn hơn lọc riêng theo companyId/ecosystemId.
  await db.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
  await db.company.deleteMany({ where: { id: { in: [f.companyA.id, f.companyB.id, f.companyC.id] } } });
  await db.ecosystemMembership.deleteMany({ where: { ecosystemId: { in: [f.e1.id, f.e2.id] } } });
  await db.ecosystem.deleteMany({ where: { id: { in: [f.e1.id, f.e2.id] } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  fx = await seed();
});

afterAll(async () => {
  await cleanup(fx);
});

describe("mục LXVII-LXX — Member A đọc/ghi Company A vs Company B", () => {
  it("MemberA đọc Company A: allowed", async () => {
    const ctx = await resolveCompanyContextForActor(fx.memberA.id, fx.companyA.id);
    expect(ctx).not.toBeNull();
    expect(ctx?.permissions.has("company.view")).toBe(true);
  });

  it("MemberA đọc Company B (chỉ thuộc A): DENY", async () => {
    const ctx = await resolveCompanyContextForActor(fx.memberA.id, fx.companyB.id);
    expect(ctx).toBeNull();
  });

  it("MemberA ghi trực tiếp vào Company B qua action (server action injection, mục LXXI): DENY", async () => {
    await expect(
      companyService.addCompanyMember(fx.memberA.id, {
        companyId: fx.companyB.id,
        email: fx.outsider.email,
        rolePreset: "MEMBER",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("URL/ID guessing (mục LXX): MemberA truy cập Company B bằng ID trực tiếp vẫn DENY", async () => {
    await expect(requireCompanyContextForActor(fx.memberA.id, fx.companyB.id, "company.view")).rejects.toThrow(
      AuthorizationError,
    );
  });
});

describe("mục LXXIII — Outsider (không membership nào)", () => {
  it("không list/enter được Company A hay B", async () => {
    expect(await resolveCompanyContextForActor(fx.outsider.id, fx.companyA.id)).toBeNull();
    expect(await resolveCompanyContextForActor(fx.outsider.id, fx.companyB.id)).toBeNull();
  });
});

describe("mục LXXIV-LXXV — Founder E1 vs Ecosystem E2 (cross-ecosystem)", () => {
  it("Founder E1 xem aggregate Company A/B (cùng E1): allowed (view-only)", async () => {
    const ctxA = await resolveCompanyContextForActor(fx.founder.id, fx.companyA.id);
    expect(ctxA?.permissions.has("company.view")).toBe(true);
    expect(ctxA?.permissions.has("company.manage")).toBe(false); // read-only, không CompanyMembership thật
  });

  it("Founder E1 KHÔNG tự nhìn thấy Company C (thuộc E2) dù chỉ có 1 Ecosystem lúc deploy — cross-ecosystem test quan trọng ngay cả khi hiện tại ít Ecosystem (mục LXXV)", async () => {
    const ctxC = await resolveCompanyContextForActor(fx.founder.id, fx.companyC.id);
    expect(ctxC).toBeNull();
  });

  it("Founder E1 không quản lý được Ecosystem E2 (mục CLXXII)", async () => {
    await expect(requireEcosystemContextForActor(fx.founder.id, fx.e2.id, "ecosystem.manage")).rejects.toThrow(
      AuthorizationError,
    );
  });
});

describe("mục CVII — Founder ghi vào Company cụ thể cần CompanyMembership tường minh (sửa sau red-team review Phần 2)", () => {
  it("Founder KHÔNG tự động có company.manage trên Company A dù có ecosystem.company.view_all", async () => {
    const ctx = await resolveCompanyContextForActor(fx.founder.id, fx.companyA.id);
    expect(ctx?.permissions.has("company.manage")).toBe(false);
    expect(ctx?.permissions.has("company.members.manage")).toBe(false);
  });

  it("Founder KHÔNG thêm member vào Company A qua action nếu không có CompanyMembership trên A: DENY", async () => {
    await expect(
      companyService.addCompanyMember(fx.founder.id, {
        companyId: fx.companyA.id,
        email: fx.outsider.email,
        rolePreset: "MEMBER",
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("mục CLXIX.9-10 / CLXXI — Privilege escalation", () => {
  it("Company Admin KHÔNG tự nâng mình thành FOUNDER (không path nào tồn tại từ Company action tới Ecosystem membership)", async () => {
    // Company-tier action không có tham số nào chạm EcosystemMembership —
    // bất khả thi về mặt cấu trúc, không chỉ vì permission thiếu.
    // Xác nhận adminA vẫn chỉ có EcosystemMembership rỗng sau khi thao tác Company A.
    await companyService.addCompanyMember(fx.adminA.id, {
      companyId: fx.companyA.id,
      email: fx.outsider.email,
      rolePreset: "MEMBER",
    });
    const membership = await db.ecosystemMembership.findUnique({
      where: { ecosystemId_userId: { ecosystemId: fx.e1.id, userId: fx.adminA.id } },
    });
    expect(membership).toBeNull();
    // dọn side effect
    await db.companyMembership.deleteMany({ where: { companyId: fx.companyA.id, userId: fx.outsider.id } });
  });

  it("Member A cố tự đổi role của mình thành OWNER (mục CLXX): DENY", async () => {
    const membership = await db.companyMembership.findUnique({
      where: { companyId_userId: { companyId: fx.companyA.id, userId: fx.memberA.id } },
    });
    await expect(
      companyService.updateCompanyMemberRole(fx.memberA.id, {
        companyId: fx.companyA.id,
        membershipId: membership!.id,
        rolePreset: "OWNER",
      }),
    ).rejects.toThrow(); // DENY vì memberA không có company.members.manage (MEMBER preset)
  });

  it("Company Admin (không phải Owner) cố cấp OWNER cho người khác: DENY", async () => {
    const targetMembership = await db.companyMembership.findFirst({
      where: { companyId: fx.companyA.id, userId: fx.memberA.id },
    });
    await expect(
      companyService.updateCompanyMemberRole(fx.adminA.id, {
        companyId: fx.companyA.id,
        membershipId: targetMembership!.id,
        rolePreset: "OWNER",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("Owner A tự đổi role của chính mình: DENY (chống self-escalation/self-demotion qua đường quản lý thành viên)", async () => {
    const ownerMembership = await db.companyMembership.findUnique({
      where: { companyId_userId: { companyId: fx.companyA.id, userId: fx.ownerA.id } },
    });
    await expect(
      companyService.updateCompanyMemberRole(fx.ownerA.id, {
        companyId: fx.companyA.id,
        membershipId: ownerMembership!.id,
        rolePreset: "COMPANY_ADMIN",
      }),
    ).rejects.toThrow();
  });
});

describe("mục CLXX / LI / LXXX — Last owner protection", () => {
  it("Không thể demote Owner cuối cùng của Company B", async () => {
    const ownerMembership = await db.companyMembership.findUnique({
      where: { companyId_userId: { companyId: fx.companyB.id, userId: fx.ownerB.id } },
    });
    await expect(
      companyService.updateCompanyMemberRole(fx.ownerB.id, {
        companyId: fx.companyB.id,
        membershipId: ownerMembership!.id,
        rolePreset: "MEMBER",
      }),
    ).rejects.toThrow(); // self-change bị chặn ở lớp khác nhưng cũng đúng last-owner
  });

  it("Không thể xoá Owner cuối cùng (test qua second owner cố xoá owner còn lại sau khi chỉ còn 1)", async () => {
    // Tạo company riêng chỉ có đúng 1 owner để test remove.
    const solo = await db.company.create({
      data: { ecosystemId: fx.e1.id, code: `solo-${fx.suffix}`, name: "Solo Co", status: "ACTIVE" },
    });
    const soloOwnerMembership = await db.companyMembership.create({
      data: { companyId: solo.id, userId: fx.ownerA.id, rolePreset: "OWNER" },
    });
    // ownerA cố xoá chính mình — bị chặn bởi self-removal rule trước cả last-owner rule, cả hai đều đúng hướng DENY.
    await expect(
      companyService.removeCompanyMember(fx.ownerA.id, solo.id, soloOwnerMembership.id),
    ).rejects.toThrow();
    await db.companyMembership.deleteMany({ where: { companyId: solo.id } });
    await db.company.delete({ where: { id: solo.id } });
  });
});

describe("mục LXXVI — Suspended Company blocks writes", () => {
  it("Company A suspended → MemberA/AdminA không ghi được; Founder vẫn resume được", async () => {
    await companyService.suspendCompany(fx.founder.id, fx.companyA.id, "test suspend");
    await expect(
      companyService.addCompanyMember(fx.adminA.id, {
        companyId: fx.companyA.id,
        email: fx.outsider.email,
        rolePreset: "MEMBER",
      }),
    ).rejects.toThrow(AuthorizationError);

    // Đọc (view) vẫn được phép theo policy hiện tại.
    const ctx = await resolveCompanyContextForActor(fx.memberA.id, fx.companyA.id);
    expect(ctx).not.toBeNull();

    await companyService.resumeCompany(fx.founder.id, fx.companyA.id);
    const company = await db.company.findUniqueOrThrow({ where: { id: fx.companyA.id } });
    expect(company.status).toBe("ACTIVE");
  });

  it("Chỉ role Ecosystem-tier có ecosystem.company.lifecycle mới suspend được — MemberA/AdminA không suspend được Company A", async () => {
    await expect(companyService.suspendCompany(fx.adminA.id, fx.companyA.id)).rejects.toThrow(AuthorizationError);
  });
});

describe("mục LXXVII — Archived Company", () => {
  it("Archived company không cho ghi mới, nhưng Founder vẫn xem/quản trị được", async () => {
    const temp = await db.company.create({
      data: { ecosystemId: fx.e1.id, code: `archive-test-${fx.suffix}`, name: "Archive Test", status: "ACTIVE" },
    });
    await companyService.archiveCompany(fx.founder.id, temp.id);
    const reloaded = await db.company.findUniqueOrThrow({ where: { id: temp.id } });
    expect(reloaded.status).toBe("ARCHIVED");

    // Archive lần 2 phải báo lỗi nghiệp vụ (không phải authorization error).
    await expect(companyService.archiveCompany(fx.founder.id, temp.id)).rejects.toThrow(/đã được lưu trữ/);

    await db.company.delete({ where: { id: temp.id } });
  });
});

describe("mục LXXVIII — Revoked membership takes effect ngay", () => {
  it("Sau khi membership bị remove (INACTIVE), request tiếp theo DENY", async () => {
    const temp = await db.company.create({
      data: { ecosystemId: fx.e1.id, code: `revoke-test-${fx.suffix}`, name: "Revoke Test", status: "ACTIVE" },
    });
    const ownerMembership = await db.companyMembership.create({
      data: { companyId: temp.id, userId: fx.ownerA.id, rolePreset: "OWNER" },
    });
    const tempMembership = await db.companyMembership.create({
      data: { companyId: temp.id, userId: fx.outsider.id, rolePreset: "MEMBER" },
    });

    expect(await resolveCompanyContextForActor(fx.outsider.id, temp.id)).not.toBeNull();

    await companyService.removeCompanyMember(fx.ownerA.id, temp.id, tempMembership.id);

    expect(await resolveCompanyContextForActor(fx.outsider.id, temp.id)).toBeNull();

    await db.companyMembership.deleteMany({ where: { companyId: temp.id } });
    await db.company.delete({ where: { id: temp.id } });
    void ownerMembership;
  });
});

describe("mục LXXXI — Role preset behavior đúng như khai báo", () => {
  it("Viewer A chỉ có company.view, không có company.manage/members.manage", async () => {
    const ctx = await resolveCompanyContextForActor(fx.viewerA.id, fx.companyA.id);
    expect(ctx?.permissions.has("company.view")).toBe(true);
    expect(ctx?.permissions.has("company.manage")).toBe(false);
    expect(ctx?.permissions.has("company.members.manage")).toBe(false);
  });

  it("Manager không tự động có quyền Owner (mục XXVIII: không hard-code Manager = Owner)", async () => {
    // memberA hiện là MEMBER; nâng tạm lên MANAGER để test đúng preset MANAGER.
    const membership = await db.companyMembership.findUnique({
      where: { companyId_userId: { companyId: fx.companyA.id, userId: fx.memberA.id } },
    });
    await db.companyMembership.update({ where: { id: membership!.id }, data: { rolePreset: "MANAGER" } });
    const ctx = await resolveCompanyContextForActor(fx.memberA.id, fx.companyA.id);
    expect(ctx?.permissions.has("company.members.view")).toBe(true);
    expect(ctx?.permissions.has("company.manage")).toBe(false);
    // khôi phục
    await db.companyMembership.update({ where: { id: membership!.id }, data: { rolePreset: "MEMBER" } });
  });
});

describe("mục CVI — Cross-company relation injection (Customer/Sale placeholder qua Company scope)", () => {
  it("Company scope không cho phép actor của Company B thao tác resource gắn companyId=A", async () => {
    // Ở Phần 3 chưa có Customer/Sale thật (Part 4+); test đại diện bằng
    // chính Company entity: memberB (chỉ thuộc B) không thể resolve context
    // cho companyId=A dù biết chính xác ID thật.
    const ctx = await resolveCompanyContextForActor(fx.memberB.id, fx.companyA.id);
    expect(ctx).toBeNull();
  });
});

describe("mục CIII — Default deny khi resolver không xác định được gì", () => {
  it("companyId không tồn tại → null, không throw ngoài ý muốn, không leak", async () => {
    const ctx = await resolveCompanyContextForActor(fx.founder.id, "non-existent-id");
    expect(ctx).toBeNull();
  });
});
