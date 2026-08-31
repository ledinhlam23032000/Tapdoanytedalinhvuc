import { requireCompanyPageByCode } from "@/lib/authorization/company-context";
import { getMyTodayWork } from "@/lib/domain/work-service";
import { getMyAppointmentsToday } from "@/lib/domain/appointment-service";
import { TodayWorkList } from "./today-work-list";
import { TodayAppointmentList } from "./today-appointment-list";

export const dynamic = "force-dynamic";

export default async function TodayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireCompanyPageByCode(code, "work.view");
  const now = new Date();

  // mục CVII/CLXXXVI: Today hợp nhất Work + Appointment — Appointment vẫn là
  // permission riêng (appointment.view), không giả định actor luôn có.
  const canViewAppointments = ctx.permissions.has("appointment.view");
  const [items, appointments] = await Promise.all([
    getMyTodayWork(ctx.actor.id, ctx.company.id, now),
    canViewAppointments ? getMyAppointmentsToday(ctx.actor.id, ctx.company.id, now) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {canViewAppointments ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Lịch hẹn hôm nay</h2>
            <p className="text-sm text-zinc-500">Sắp xếp theo giờ.</p>
          </div>
          <TodayAppointmentList
            code={code}
            items={appointments.map((a) => ({
              id: a.id,
              title: a.title,
              startAt: a.startAt.toISOString(),
              status: a.status,
              customerName: a.customer?.name ?? null,
            }))}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Việc của tôi hôm nay</h2>
          <p className="text-sm text-zinc-500">Xếp theo mức độ khẩn cấp — quá hạn và ưu tiên khẩn cấp lên đầu.</p>
        </div>
        <TodayWorkList
          companyId={ctx.company.id}
          items={items.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority,
            dueAt: item.dueAt ? item.dueAt.toISOString() : null,
            projectName: item.project?.name ?? null,
            organizationUnitName: item.organizationUnit?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
