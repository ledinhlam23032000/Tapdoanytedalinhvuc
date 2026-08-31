// Kiểm tra trùng lịch hẹn — hàm thuần, không DB (mục LII: "chỉ kiểm tra
// overlap đơn giản theo assignedUserId, không xây engine tối ưu tài
// nguyên"). endAt có thể null (chưa nhập giờ kết thúc) — dùng thời lượng
// mặc định chỉ để so sánh, KHÔNG lưu vào DB.

export type AppointmentTimeRange = {
  startAt: Date;
  endAt: Date | null;
};

export function appointmentsOverlap(
  a: AppointmentTimeRange,
  b: AppointmentTimeRange,
  defaultDurationMinutes = 30,
): boolean {
  const aEnd = a.endAt ?? new Date(a.startAt.getTime() + defaultDurationMinutes * 60_000);
  const bEnd = b.endAt ?? new Date(b.startAt.getTime() + defaultDurationMinutes * 60_000);
  return a.startAt < bEnd && b.startAt < aEnd;
}
