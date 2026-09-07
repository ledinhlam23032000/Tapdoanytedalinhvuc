import { describe, expect, it } from "vitest";
import { ECOSYSTEM_ROLE_PERMISSIONS, COMPANY_ROLE_PERMISSIONS, PERMISSION_PACKS } from "@/lib/permissions/presets";
import { COMPANY_PERMISSIONS } from "@/lib/permissions/registry";

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

// ===== Phần 7 — ràng buộc ÂM TÍNH của permission pack (ADR-051) =====
// Ba bất biến này (#50/#51/#52 trong PART7_SPEC_DIGEST.md) nói pack KHÔNG
// được chứa gì. Loại bất biến này rất dễ trôi khi ai đó "tiện tay" thêm
// quyền vào pack, và sẽ không có test nào khác bắt được — nên test riêng.
describe("Phần 7 — permission pack (ADR-051)", () => {
  it("#50 RECEPTION không đọc được nội dung khám", () => {
    expect(PERMISSION_PACKS.HEALTHCARE_RECEPTION).not.toContain("healthcare.consultation.view");
  });

  it("#51 NURSE không có bất kỳ quyền finance/payroll nào", () => {
    const leaked = PERMISSION_PACKS.HEALTHCARE_NURSE.filter(
      (p) => p.startsWith("finance.") || p.startsWith("payroll."),
    );
    expect(leaked).toEqual([]);
  });

  it("#52 DOCTOR không có quyền quản trị Company", () => {
    expect(PERMISSION_PACKS.HEALTHCARE_DOCTOR).not.toContain("company.manage");
    expect(PERMISSION_PACKS.HEALTHCARE_DOCTOR).not.toContain("company.members.manage");
  });

  it("#49 không pack healthcare nào implicit-grant finance/payroll", () => {
    for (const [name, perms] of Object.entries(PERMISSION_PACKS)) {
      const leaked = perms.filter((p) => p.startsWith("finance.") || p.startsWith("payroll."));
      expect({ name, leaked }).toEqual({ name, leaked: [] });
    }
  });

  it("mọi permission trong pack đều là key hợp lệ trong registry", () => {
    for (const [name, perms] of Object.entries(PERMISSION_PACKS)) {
      for (const p of perms) {
        expect({ name, p, ok: (COMPANY_PERMISSIONS as readonly string[]).includes(p) }).toEqual({
          name,
          p,
          ok: true,
        });
      }
    }
  });

  it("MEMBER/VIEWER không mặc định thấy dữ liệu lâm sàng (#200)", () => {
    for (const preset of ["MEMBER", "VIEWER"] as const) {
      const clinical = COMPANY_ROLE_PERMISSIONS[preset].filter((p) => p.startsWith("healthcare."));
      expect({ preset, clinical }).toEqual({ preset, clinical: [] });
    }
  });
});
