import { describe, expect, it } from "vitest";
import { appointmentsOverlap } from "@/lib/domain/appointment-conflict";

describe("appointmentsOverlap", () => {
  it("2 lịch hẹn có endAt rõ ràng, chồng lấn giữa chừng => overlap", () => {
    const a = { startAt: new Date("2026-09-01T09:00:00Z"), endAt: new Date("2026-09-01T10:00:00Z") };
    const b = { startAt: new Date("2026-09-01T09:30:00Z"), endAt: new Date("2026-09-01T10:30:00Z") };
    expect(appointmentsOverlap(a, b)).toBe(true);
  });

  it("2 lịch hẹn liền kề (a kết thúc đúng lúc b bắt đầu) không overlap", () => {
    const a = { startAt: new Date("2026-09-01T09:00:00Z"), endAt: new Date("2026-09-01T10:00:00Z") };
    const b = { startAt: new Date("2026-09-01T10:00:00Z"), endAt: new Date("2026-09-01T11:00:00Z") };
    expect(appointmentsOverlap(a, b)).toBe(false);
  });

  it("2 lịch hẹn cách xa nhau không overlap", () => {
    const a = { startAt: new Date("2026-09-01T09:00:00Z"), endAt: new Date("2026-09-01T10:00:00Z") };
    const b = { startAt: new Date("2026-09-01T14:00:00Z"), endAt: new Date("2026-09-01T15:00:00Z") };
    expect(appointmentsOverlap(a, b)).toBe(false);
  });

  it("thiếu endAt dùng thời lượng mặc định 30 phút để so sánh", () => {
    const a = { startAt: new Date("2026-09-01T09:00:00Z"), endAt: null };
    const bOverlap = { startAt: new Date("2026-09-01T09:15:00Z"), endAt: null };
    const bNoOverlap = { startAt: new Date("2026-09-01T09:45:00Z"), endAt: null };
    expect(appointmentsOverlap(a, bOverlap)).toBe(true);
    expect(appointmentsOverlap(a, bNoOverlap)).toBe(false);
  });

  it("có thể tuỳ chỉnh thời lượng mặc định", () => {
    const a = { startAt: new Date("2026-09-01T09:00:00Z"), endAt: null };
    const b = { startAt: new Date("2026-09-01T09:45:00Z"), endAt: null };
    expect(appointmentsOverlap(a, b, 30)).toBe(false);
    expect(appointmentsOverlap(a, b, 60)).toBe(true);
  });
});
