"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CompanyNav({
  code,
  canManageMembers,
  canViewWork,
  canViewOrganization,
  canViewProjects,
  canViewCustomers,
  canViewAppointments,
  canViewSales,
  canViewFinance,
  canViewPayroll,
  canViewInventory,
}: {
  code: string;
  canManageMembers: boolean;
  canViewWork: boolean;
  canViewOrganization: boolean;
  canViewProjects: boolean;
  canViewCustomers: boolean;
  canViewAppointments: boolean;
  canViewSales: boolean;
  canViewFinance: boolean;
  canViewPayroll: boolean;
  canViewInventory: boolean;
}) {
  const pathname = usePathname();
  // mục CXCVII: giữ "navigation budget" — Lead gộp vào trang Khách hàng
  // (tab), Catalog gộp vào trang Kinh doanh, không thêm mục nav riêng cho
  // từng entity Phần 5. Phần 6: Commission gộp vào trang Lương (tab/link),
  // không thêm mục nav riêng — cùng nguyên tắc.
  const items = [
    { href: `/c/${code}`, label: "Tổng quan" },
    ...(canViewWork ? [{ href: `/c/${code}/today`, label: "Hôm nay" }] : []),
    ...(canViewCustomers ? [{ href: `/c/${code}/customers`, label: "Khách hàng" }] : []),
    ...(canViewAppointments ? [{ href: `/c/${code}/appointments`, label: "Lịch hẹn" }] : []),
    ...(canViewSales ? [{ href: `/c/${code}/sales`, label: "Kinh doanh" }] : []),
    ...(canViewFinance ? [{ href: `/c/${code}/finance`, label: "Tài chính" }] : []),
    ...(canViewPayroll ? [{ href: `/c/${code}/payroll`, label: "Lương" }] : []),
    ...(canViewInventory ? [{ href: `/c/${code}/inventory`, label: "Tồn kho" }] : []),
    ...(canViewWork ? [{ href: `/c/${code}/work`, label: "Công việc" }] : []),
    ...(canViewProjects ? [{ href: `/c/${code}/projects`, label: "Dự án" }] : []),
    ...(canViewOrganization ? [{ href: `/c/${code}/organization`, label: "Cơ cấu tổ chức" }] : []),
    ...(canManageMembers ? [{ href: `/c/${code}/members`, label: "Thành viên" }] : []),
  ];

  return (
    <nav className="flex flex-wrap gap-4 border-b border-zinc-200 pb-2 text-sm">
      {items.map((item) => {
        const isActive = item.href === `/c/${code}` ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
