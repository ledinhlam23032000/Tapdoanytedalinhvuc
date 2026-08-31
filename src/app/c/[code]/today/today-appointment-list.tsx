import Link from "next/link";
import { APPOINTMENT_STATUS_LABEL } from "../work-labels";

type TodayAppointment = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  customerName: string | null;
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

// mục CVII/CLXXXVI — Today hợp nhất Work + Appointment, KHÔNG cần mở CRM.
export function TodayAppointmentList({ code, items }: { code: string; items: TodayAppointment[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
        Hôm nay chưa có lịch hẹn.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/c/${code}/appointments/${item.id}`}
            className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-4 hover:border-zinc-400"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">{formatTime(item.startAt)}</span>
                <span className="text-zinc-700">{item.title}</span>
              </div>
              {item.customerName ? <p className="mt-1 text-xs text-zinc-500">Khách: {item.customerName}</p> : null}
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {APPOINTMENT_STATUS_LABEL[item.status] ?? item.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
