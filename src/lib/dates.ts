// All "day" logic (streaks, daily quests, limits) uses Bangladesh time so a
// student's day resets at local midnight, not UTC midnight.
const TZ = "Asia/Dhaka";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD in Asia/Dhaka */
export function dayKey(date = new Date()): string {
  return fmt.format(date);
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Monday of the current Dhaka week, as YYYY-MM-DD */
export function weekStartKey(date = new Date()): string {
  const today = dayKey(date);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  return addDays(today, -sinceMonday);
}

/** Start of a Dhaka day as a UTC Date (Dhaka is UTC+6, no DST) */
export function dayStartUtc(day: string): Date {
  return new Date(`${day}T00:00:00+06:00`);
}
