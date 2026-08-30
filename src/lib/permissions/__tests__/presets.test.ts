import { describe, expect, it } from "vitest";
import { ECOSYSTEM_ROLE_PERMISSIONS, COMPANY_ROLE_PERMISSIONS } from "@/lib/permissions/presets";

// "No magic superadmin" static check (Master Prompt mục CXLVIII) — chạy như
// một unit test thay vì chỉ search bằng tay, để CI tự bắt regression nếu ai
// đó lỡ thêm quyền quá rộng cho một preset.

describe("Không có preset nào là 'god mode' ngầm định", () => {
  it("ECOSYSTEM_ADMIN không có ecosystem.membership.manage (chống tự cấp quyền FOUNDER)", () => {
    expect(ECOSYSTEM_ROLE_PERMISSIONS.ECOSYSTEM_ADMIN).not.toContain("ecosystem.membership.manage");
  });

  it("AUDITOR và VIEWER (Ecosystem) không có bất kỳ quyền ghi nào", () => {
    const writeLikePermissions = [
      "ecosystem.manage",
      "ecosystem.membership.manage",
      "ecosystem.company.create",
      "ecosystem.company.lifecycle",
    ] as const;
    for (const perm of writeLikePermissions) {
      expect(ECOSYSTEM_ROLE_PERMISSIONS.AUDITOR).not.toContain(perm);
      expect(ECOSYSTEM_ROLE_PERMISSIONS.VIEWER).not.toContain(perm);
    }
  });

  it("Company MEMBER/VIEWER không có company.members.manage hay company.manage", () => {
    for (const role of ["MEMBER", "VIEWER"] as const) {
      expect(COMPANY_ROLE_PERMISSIONS[role]).not.toContain("company.members.manage");
      expect(COMPANY_ROLE_PERMISSIONS[role]).not.toContain("company.manage");
    }
  });

  it("MANAGER không tự động có company.manage (mục XXVIII — không hard-code Manager = full quyền)", () => {
    expect(COMPANY_ROLE_PERMISSIONS.MANAGER).not.toContain("company.manage");
  });

  it("Mọi preset ít nhất có company.view / ecosystem.view (không preset nào rỗng hoàn toàn — nếu rỗng, không nên là preset thật)", () => {
    for (const perms of Object.values(ECOSYSTEM_ROLE_PERMISSIONS)) {
      expect(perms.length).toBeGreaterThan(0);
    }
    for (const perms of Object.values(COMPANY_ROLE_PERMISSIONS)) {
      expect(perms.length).toBeGreaterThan(0);
    }
  });
});
