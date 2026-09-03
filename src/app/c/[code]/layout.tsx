import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { logoutAction } from "@/lib/actions/auth-actions";
import { CompanyNav } from "./company-nav";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Hoạt động",
  SUSPENDED: "Tạm dừng",
  ARCHIVED: "Lưu trữ",
};

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "company.view");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← {ctx.ecosystem.name}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900">{ctx.company.name}</h1>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {STATUS_LABEL[ctx.company.status] ?? ctx.company.status}
            </span>
          </div>
        </div>
        <form action={logoutAction}>
          <button className="text-sm text-zinc-500 underline">Đăng xuất</button>
        </form>
      </header>
      <CompanyNav
        code={ctx.company.code}
        canManageMembers={ctx.permissions.has("company.members.view")}
        canViewWork={ctx.permissions.has("work.view")}
        canViewOrganization={ctx.permissions.has("organization.view")}
        canViewProjects={ctx.permissions.has("project.view")}
        canViewCustomers={ctx.permissions.has("customer.view")}
        canViewAppointments={ctx.permissions.has("appointment.view")}
        canViewSales={ctx.permissions.has("sales.view")}
        canViewFinance={ctx.permissions.has("finance.view")}
        canViewPayroll={ctx.permissions.has("payroll.view")}
        canViewInventory={ctx.permissions.has("inventory.view")}
      />
      {children}
    </div>
  );
}
