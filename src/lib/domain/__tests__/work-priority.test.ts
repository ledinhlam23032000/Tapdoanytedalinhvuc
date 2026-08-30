import { describe, expect, it } from "vitest";
import {
  workItemUrgencyTier,
  compareWorkItemUrgency,
  sortByUrgency,
  dateKeyInTimezone,
  summarizeUrgency,
  type WorkItemForScoring,
} from "@/lib/domain/work-priority";

// Deterministic Today ranking (Master Prompt mục XLIX/CXLII) — thuần logic,
// không DB, để chạy trong lane unit test.

const TZ = "Asia/Ho_Chi_Minh";
// "Hôm nay" cố định trong giờ VN để test không phụ thuộc múi giờ máy chạy CI.
const NOW = new Date("2026-08-30T04:00:00.000Z"); // 11:00 sáng giờ VN, 30/08/2026

function item(dueAt: string | null, priority: WorkItemForScoring["priority"]): WorkItemForScoring {
  return { dueAt: dueAt ? new Date(dueAt) : null, priority };
}

describe("dateKeyInTimezone", () => {
  it("tính đúng ngày theo múi giờ Company, không phải lịch UTC server", () => {
    // 23:30 giờ VN ngày 30/08 = 16:30 UTC ngày 30/08 — vẫn phải ra ngày 30/08 ở VN.
    const lateNight = new Date("2026-08-30T16:30:00.000Z");
    expect(dateKeyInTimezone(lateNight, TZ)).toBe("2026-08-30");
    // Ngay trước nửa đêm UTC vẫn đã là 31/08 ở giờ VN (UTC+7).
    const nearMidnightUtc = new Date("2026-08-30T17:30:00.000Z");
    expect(dateKeyInTimezone(nearMidnightUtc, TZ)).toBe("2026-08-31");
  });
});

describe("workItemUrgencyTier", () => {
  it("quá hạn + khẩn cấp = tier 0", () => {
    expect(workItemUrgencyTier(item("2026-08-29T04:00:00.000Z", "URGENT"), NOW, TZ)).toBe(0);
  });

  it("quá hạn (không khẩn cấp) = tier 1", () => {
    expect(workItemUrgencyTier(item("2026-08-29T04:00:00.000Z", "HIGH"), NOW, TZ)).toBe(1);
    expect(workItemUrgencyTier(item("2026-08-29T04:00:00.000Z", "NORMAL"), NOW, TZ)).toBe(1);
  });

  it("hôm nay + khẩn cấp = tier 2", () => {
    expect(workItemUrgencyTier(item("2026-08-30T10:00:00.000Z", "URGENT"), NOW, TZ)).toBe(2);
  });

  it("hôm nay (không khẩn cấp) = tier 3", () => {
    expect(workItemUrgencyTier(item("2026-08-30T10:00:00.000Z", "NORMAL"), NOW, TZ)).toBe(3);
  });

  it("chưa tới hạn nhưng ưu tiên cao/khẩn cấp = tier 4", () => {
    expect(workItemUrgencyTier(item("2026-09-05T04:00:00.000Z", "HIGH"), NOW, TZ)).toBe(4);
    expect(workItemUrgencyTier(item(null, "URGENT"), NOW, TZ)).toBe(4);
  });

  it("bình thường, không hạn hoặc còn lâu = tier 5", () => {
    expect(workItemUrgencyTier(item(null, "NORMAL"), NOW, TZ)).toBe(5);
    expect(workItemUrgencyTier(item("2026-09-05T04:00:00.000Z", "LOW"), NOW, TZ)).toBe(5);
  });
});

describe("compareWorkItemUrgency / sortByUrgency", () => {
  it("xếp đúng thứ tự: quá hạn+khẩn cấp trước, bình thường/không hạn cuối", () => {
    const overdueUrgent = item("2026-08-29T04:00:00.000Z", "URGENT");
    const overdueNormal = item("2026-08-28T04:00:00.000Z", "NORMAL");
    const dueTodayUrgent = item("2026-08-30T10:00:00.000Z", "URGENT");
    const dueTodayNormal = item("2026-08-30T10:00:00.000Z", "NORMAL");
    const upcomingHigh = item("2026-09-05T04:00:00.000Z", "HIGH");
    const normalNoDue = item(null, "NORMAL");

    const shuffled = [normalNoDue, dueTodayNormal, upcomingHigh, overdueNormal, dueTodayUrgent, overdueUrgent];
    const sorted = sortByUrgency(shuffled, NOW, TZ);

    expect(sorted).toEqual([overdueUrgent, overdueNormal, dueTodayUrgent, dueTodayNormal, upcomingHigh, normalNoDue]);
  });

  it("trong cùng tier, hạn sớm hơn đứng trước", () => {
    const dueFirst = item("2026-08-29T02:00:00.000Z", "NORMAL");
    const dueLater = item("2026-08-29T20:00:00.000Z", "NORMAL");
    const sorted = sortByUrgency([dueLater, dueFirst], NOW, TZ);
    expect(sorted).toEqual([dueFirst, dueLater]);
  });

  it("việc có hạn luôn đứng trước việc không hạn trong cùng tier", () => {
    const withDue = item("2026-09-05T04:00:00.000Z", "LOW");
    const withoutDue = item(null, "NORMAL");
    expect(compareWorkItemUrgency(withDue, withoutDue, NOW, TZ)).toBeLessThan(0);
  });
});

describe("summarizeUrgency", () => {
  it("đếm đúng số lượng theo nhóm quá hạn / ưu tiên-sắp tới / bình thường", () => {
    const items = [
      item("2026-08-29T04:00:00.000Z", "URGENT"), // overdue
      item("2026-08-30T10:00:00.000Z", "HIGH"), // due today, not urgent -> tier 3 -> priorityOrDueSoon
      item(null, "URGENT"), // tier 4 -> priorityOrDueSoon
      item(null, "NORMAL"), // tier 5 -> normal
    ];
    expect(summarizeUrgency(items, NOW, TZ)).toEqual({
      overdue: 1,
      priorityOrDueSoon: 2,
      normal: 1,
      total: 4,
    });
  });
});
