// Deterministic Today ranking (Master Prompt Phần 4 mục XLIX/CXLII) — thuần,
// không phụ thuộc AI/DB, dễ unit test. AI (Phần 8) chỉ giải thích/re-rank
// thêm sau này, KHÔNG thay thế logic này (mục L).

export type WorkItemPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type WorkItemForScoring = {
  dueAt: Date | null;
  priority: WorkItemPriority;
};

/** "Hôm nay" theo múi giờ Company/User, không phải lịch UTC của server (mục CLXXXVII). */
export function dateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date); // "YYYY-MM-DD"
}

function isOverdue(item: WorkItemForScoring, now: Date, timezone: string): boolean {
  if (!item.dueAt) return false;
  return dateKeyInTimezone(item.dueAt, timezone) < dateKeyInTimezone(now, timezone);
}

function isDueToday(item: WorkItemForScoring, now: Date, timezone: string): boolean {
  if (!item.dueAt) return false;
  return dateKeyInTimezone(item.dueAt, timezone) === dateKeyInTimezone(now, timezone);
}

/** 0 = khẩn cấp nhất. Tier thấp hơn luôn đứng trước tier cao hơn. */
export function workItemUrgencyTier(item: WorkItemForScoring, now: Date, timezone: string): number {
  const urgent = item.priority === "URGENT";
  const highOrAbove = urgent || item.priority === "HIGH";

  if (isOverdue(item, now, timezone) && urgent) return 0;
  if (isOverdue(item, now, timezone)) return 1;
  if (isDueToday(item, now, timezone) && urgent) return 2;
  if (isDueToday(item, now, timezone)) return 3;
  if (highOrAbove) return 4; // sắp tới nhưng ưu tiên cao/khẩn
  return 5; // bình thường
}

export function compareWorkItemUrgency<T extends WorkItemForScoring>(
  a: T,
  b: T,
  now: Date,
  timezone: string,
): number {
  const tierDiff = workItemUrgencyTier(a, now, timezone) - workItemUrgencyTier(b, now, timezone);
  if (tierDiff !== 0) return tierDiff;
  if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return 0;
}

export function sortByUrgency<T extends WorkItemForScoring>(items: T[], now: Date, timezone: string): T[] {
  return [...items].sort((a, b) => compareWorkItemUrgency(a, b, now, timezone));
}

export function summarizeUrgency<T extends WorkItemForScoring>(
  items: T[],
  now: Date,
  timezone: string,
): { overdue: number; priorityOrDueSoon: number; normal: number; total: number } {
  let overdue = 0;
  let priorityOrDueSoon = 0;
  let normal = 0;
  for (const item of items) {
    const tier = workItemUrgencyTier(item, now, timezone);
    if (tier <= 1) overdue += 1;
    else if (tier <= 4) priorityOrDueSoon += 1;
    else normal += 1;
  }
  return { overdue, priorityOrDueSoon, normal, total: items.length };
}
