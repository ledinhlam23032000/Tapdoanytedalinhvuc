import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getAppointmentDetail } from "@/lib/domain/appointment-service";
import { formatDateTime } from "../../work-labels";
import { AppointmentActions } from "./appointment-actions";
import { RescheduleAppointmentForm } from "./reschedule-appointment-form";

export const dynamic = "force-dynamic";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ code: string; appointmentId: string }>;
}) {
  const { code, appointmentId } = await params;
  const ctx = await requireCompanyPageByCode(code, "appointment.view");

  let appointment;
  try {
    appointment = await getAppointmentDetail(ctx.actor.id, ctx.company.id, appointmentId);
  } catch {
    notFound();
  }
  if (!appointment) notFound();

  const canReschedule = appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{appointment.title}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>Bắt đầu: {formatDateTime(appointment.startAt.toISOString())}</span>
            {appointment.endAt ? <span>Kết thúc: {formatDateTime(appointment.endAt.toISOString())}</span> : null}
            {appointment.type ? <span>Loại: {appointment.type}</span> : null}
            {appointment.location ? <span>Địa điểm: {appointment.location}</span> : null}
          </div>
        </div>
        <AppointmentActions companyId={ctx.company.id} appointmentId={appointment.id} status={appointment.status} />
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-500">Khách hàng</dt>
            <dd className="text-zinc-900">
              {appointment.customer ? (
                <Link href={`/c/${code}/customers/${appointment.customer.id}`} className="hover:underline">
                  {appointment.customer.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-500">Người phụ trách</dt>
            <dd className="text-zinc-900">{appointment.assignedUser?.displayName ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-500">Đơn vị</dt>
            <dd className="text-zinc-900">{appointment.organizationUnit?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-500">Người tạo</dt>
            <dd className="text-zinc-900">{appointment.createdBy.displayName}</dd>
          </div>
        </dl>
        {appointment.note ? (
          <p className="mt-3 whitespace-pre-wrap border-t border-zinc-100 pt-3 text-sm text-zinc-700">
            {appointment.note}
          </p>
        ) : null}
      </div>

      {canReschedule ? (
        <RescheduleAppointmentForm companyId={ctx.company.id} appointmentId={appointment.id} />
      ) : null}
    </div>
  );
}
