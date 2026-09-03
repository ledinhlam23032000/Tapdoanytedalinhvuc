import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getCurrentPayrollProfile } from "@/lib/domain/payroll-service";
import { db } from "@/lib/db";
import { formatMoney } from "../../work-labels";
import { SetPayrollProfileForm } from "./set-payroll-profile-form";

export const dynamic = "force-dynamic";

export default async function PayrollProfilesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "payroll.manage");

  const members = await db.companyMembership.findMany({
    where: { companyId: ctx.company.id, status: "ACTIVE" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const profiles = await Promise.all(
    members.map((member) => getCurrentPayrollProfile(ctx.actor.id, ctx.company.id, member.userId)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Thiết lập lương nhân viên</h2>
        <p className="text-sm text-zinc-500">Lương cơ bản hiện hành của từng thành viên.</p>
      </div>

      {members.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có thành viên nào đang hoạt động.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Nhân viên</th>
                <th className="px-4 py-2 font-medium">Lương cơ bản hiện tại</th>
                <th className="px-4 py-2 font-medium">Thiết lập mới</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => {
                const profile = profiles[index];
                return (
                  <tr key={member.userId} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-700">{member.user.displayName}</td>
                    <td className="px-4 py-2 text-zinc-700">
                      {profile ? formatMoney(Number(profile.baseSalary)) : "Chưa thiết lập"}
                    </td>
                    <td className="px-4 py-2">
                      <SetPayrollProfileForm companyId={ctx.company.id} userId={member.userId} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
