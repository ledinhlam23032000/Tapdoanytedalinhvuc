"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CompanyNav({
  code,
  canManageMembers,
  canViewWork,
  canViewOrganization,
  canViewProjects,
}: {
  code: string;
  canManageMembers: boolean;
  canViewWork: boolean;
  canViewOrganization: boolean;
  canViewProjects: boolean;
}) {
  const pathname = usePathname();
  const items = [
    { href: `/c/${code}`, label: "Tổng quan" },
    ...(canViewWork ? [{ href: `/c/${code}/today`, label: "Hôm nay" }] : []),
    ...(canViewWork ? [{ href: `/c/${code}/work`, label: "Công việc" }] : []),
    ...(canViewProjects ? [{ href: `/c/${code}/projects`, label: "Dự án" }] : []),
    ...(canViewOrganization ? [{ href: `/c/${code}/organization`, label: "Cơ cấu tổ chức" }] : []),
    ...(canManageMembers ? [{ href: `/c/${code}/members`, label: "Thành viên" }] : []),
  ];

  return (
    <nav className="flex gap-4 border-b border-zinc-200 pb-2 text-sm">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            pathname === item.href
              ? "font-medium text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
