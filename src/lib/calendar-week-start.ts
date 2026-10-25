import { readStorage, writeStorage } from "./storage";
import { DAYS, type DayKey } from "./week-plan";

/** First column of the calendar month grid. Board weeks stay Monday-start. */
export const CALENDAR_WEEK_START_KEY = "calendar-week-start-v1";

export const DEFAULT_CALENDAR_WEEK_START: DayKey = "monday";

/** Sunday first, then Monday–Saturday. */
export const CALENDAR_WEEK_START_OPTIONS = [
  ...DAYS.filter((day) => day.key === "sunday"),
  ...DAYS.filter((day) => day.key !== "sunday"),
];

const JS_WEEKDAY: Record<DayKey, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const listeners = new Set<(day: DayKey) => void>();

export function isDayKey(value: string): value is DayKey {
  return DAYS.some((day) => day.key === value);
}

export function parseCalendarWeekStart(raw: string | null): DayKey {
  if (raw && isDayKey(raw)) return raw;
  return DEFAULT_CALENDAR_WEEK_START;
}

/**
 * First calendar-grid day on or before `date`.
 * Independent of `startOfWeek`, which stays Monday for board weeks.
 */
export function startOfCalendarWeek(date: Date, weekStartsOn: DayKey): Date {
  const d = new Date(date);
  const diff = (d.getDay() - JS_WEEKDAY[weekStartsOn] + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function calendarWeekdayHeaders(
  weekStartsOn: DayKey,
): { key: DayKey; short: string }[] {
  const start = DAYS.findIndex((day) => day.key === weekStartsOn);
  const offset = start < 0 ? 0 : start;
  return Array.from({ length: 7 }, (_, index) => DAYS[(offset + index) % 7]!);
}

export function subscribeCalendarWeekStart(
  listener: (day: DayKey) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadCalendarWeekStart(): Promise<DayKey> {
  const raw = await readStorage(CALENDAR_WEEK_START_KEY);
  return parseCalendarWeekStart(raw);
}

export async function saveCalendarWeekStart(day: DayKey): Promise<void> {
  await writeStorage(CALENDAR_WEEK_START_KEY, day);
  for (const listener of listeners) listener(day);
}
