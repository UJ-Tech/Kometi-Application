// src/utils/date.ts
// Date utilities for Indian locale (IST = UTC+5:30)

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Format a date to readable Indian format: "28 May 2026" */
export function formatDateIN(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

/** Format date with time: "28 May 2026, 7:30 PM" */
export function formatDateTimeIN(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format as relative time: "2 days ago", "in 3 days", "Today" */
export function formatRelative(date: Date | string): string {
  const d     = new Date(date);
  const now   = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0)  return "Today";
  if (diffDays === 1)  return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0)    return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/** Days until/since a date (negative = past) */
export function diffInDays(date: Date | string): number {
  const d   = new Date(date);
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Add N days to a date */
export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Is a date past? */
export function isPast(date: Date | string): boolean {
  return new Date(date) < new Date();
}

/** Is today? */
export function isToday(date: Date | string): boolean {
  const d   = new Date(date);
  const now = new Date();
  return (
    d.getDate()     === now.getDate()     &&
    d.getMonth()    === now.getMonth()    &&
    d.getFullYear() === now.getFullYear()
  );
}

/** Get current date in YYYY-MM-DD format (IST aware) */
export function todayIST(): string {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toISOString().slice(0, 10);
}

/** Get month label: "May 2026" */
export function formatMonthYear(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    month: "long",
    year:  "numeric",
  });
}

/** Format short month: "May '26" */
export function formatShortMonth(date: Date | string): string {
  const d = new Date(date);
  const month = d.toLocaleString("en-IN", { month: "short" });
  const year  = d.getFullYear().toString().slice(-2);
  return `${month} '${year}`;
}

/** Generate due date sequence for committee schedule */
export function generateDueDates(
  startDate: Date,
  cycleDays: number,
  count: number,
): Date[] {
  return Array.from({ length: count }, (_, i) =>
    addDays(startDate, (i + 1) * cycleDays)
  );
}
