import Link from "next/link";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getAppointmentList } from "@/lib/domain/appointment-service";
import { getCustomerList } from "@/lib/domain/customer-service";
import { getOrganizationTree } from "@/lib/domain/organization-service";
import { db } from "@/lib/db";
import { APPOINTMENT_STATUS_LABEL, formatDateTime } from "../work-labels";
import { CreateAppointmentForm } from "./create-appointment-form";

export const dynamic = "force-dynamic";

type ViewFilter = "today" | "upcoming" | "completed" | "no_show";

const VIEW_TABS: { view: ViewFilter | null; label: string }[] = [
  { view: null, label: "Tất cả" },
  { view: "today", label: "Hôm nay" },
  { view: "upcoming", label: "Sắp tới" },
  { view: "completed", label: "Đã hoàn thành" },
  { view: "no_show", label: "Không đến" },
];

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ view?: string; customerId?: string }>;
}) {
  const { code } = await params;
  const { view, customerId } = await searchParams;
  const ctx = await requireCompanyPageByCode(code, "appointment.view");

  const appointments = await getAppointmentList(
    ctx.actor.id,
    ctx.company.id,
    view ? { view: view as ViewFilter } : {},
  );

  const canCreate = ctx.permissions.has("appointment.create");

  const [customers, organizationUnits, companyMembers] = await Promise.all([
    canCreate ? getCustomerList(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
    canCreate ? getOrganizationTree(ctx.actor.id, ctx.company.id) : Promise.resolve([]),
    canCreate
      ? db.companyMembership.findMany({
          where: { companyId: ctx.company.id, status: "ACTIVE" },
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Lịch hẹn</h2>
      </div>

      <nav className="flex flex-wrap gap-4 border-b border-zinc-200 pb-2 text-sm">
        {VIEW_TABS.map((tab) => {
          const isActive = (view ?? null) === tab.view;
          const href = tab.view ? `/c/${code}/appointments?view=${tab.view}` : `/c/${code}/appointments`;
          return (
            <Link
              key={tab.label}
              href={href}
              className={isActive ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {canCreate ? (
        <CreateAppointmentForm
          companyId={ctx.company.id}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          organizationUnits={organizationUnits.map((u) => ({ id: u.id, name: u.name }))}
          companyMembers={companyMembers.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
          initialCustomerId={customerId}
        />
      ) : null}

      {appointments.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Chưa có lịch hẹn nào.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-4 py-2 font-medium">Giờ</th>
                <th className="px-4 py-2 font-medium">Tiêu đề</th>
                <th className="px-4 py-2 font-medium">Khách hàng</th>
                <th className="px-4 py-2 font-medium">Người phụ trách</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 text-zinc-700">{formatDateTime(appointment.startAt.toISOString())}</td>
                  <td className="px-4 py-2">
                    <Link href={`/c/${code}/appointments/${appointment.id}`} className="text-zinc-900 hover:underline">
                      {appointment.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{appointment.customer?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-700">{appointment.assignedUser?.displayName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
