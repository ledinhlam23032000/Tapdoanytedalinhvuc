import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { isHealthcareModuleEnabled, getMemberPermissionPacks } from "@/lib/domain/healthcare/module-service";
import { db } from "@/lib/db";
import type { PermissionPack } from "@/generated/prisma";
import { HealthcareModuleToggle } from "./healthcare-module-toggle";
import { MemberPermissionPacksTable } from "./member-permission-packs-table";

export const dynamic = "force-dynamic";

type MemberWithPacks = {
  userId: string;
  displayName: string;
  email: string;
  packs: PermissionPack[];
};

/** Cài đặt phân hệ Y tế — chỉ OWNER/quản trị (yêu cầu
 * "healthcare.module.manage" để vào trang này). Bật/tắt module (ADR-047) và
 * gán/thu hồi gói quyền chuyên môn (ADR-051) là hai mối quan tâm độc lập —
 * phần gán gói CHỈ hiện thêm khi actor cũng có "company.members.manage". */
export default async function HealthcareSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "healthcare.module.manage");

  const moduleEnabled = await isHealthcareModuleEnabled(ctx.company.id);
  const canManageMembers = ctx.permissions.has("company.members.manage");

  // N+1 đơn giản, quy mô nhỏ không đáng lo (theo chỉ định nhiệm vụ) — mỗi
  // thành viên một lượt gọi getMemberPermissionPacks để lấy pack hiện có.
  let members: MemberWithPacks[] = [];
  if (canManageMembers) {
    const memberships = await db.companyMembership.findMany({
      where: { companyId: ctx.company.id, status: "ACTIVE" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    members = await Promise.all(
      memberships.map(async (m) => {
        const packs = await getMemberPermissionPacks(ctx.actor.id, ctx.company.id, m.userId);
        return {
          userId: m.userId,
          displayName: m.user.displayName,
          email: m.user.email,
          packs: packs.map((p) => p.pack),
        };
      }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Cài đặt phân hệ Y tế</h2>
        <p className="text-sm text-zinc-500">
          Bật/tắt phân hệ Y tế cho công ty và gán gói quyền chuyên môn cho từng thành viên.
        </p>
      </div>

      <HealthcareModuleToggle companyId={ctx.company.id} enabled={moduleEnabled} />

      {canManageMembers ? (
        <MemberPermissionPacksTable companyId={ctx.company.id} members={members} />
      ) : (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Bạn không có quyền quản lý gói quyền chuyên môn của thành viên.
        </p>
      )}
    </div>
  );
}
