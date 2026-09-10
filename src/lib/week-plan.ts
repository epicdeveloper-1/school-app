export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

export type SubjectTarget = {
  id: string;
  subject: string;
  goal: string;
  done: boolean;
};

export type WeekPlan = {
  weekOf: string;
  focus: string;
  days: Record<DayKey, TaskItem[]>;
  subjects: SubjectTarget[];
};

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

export const STORAGE_KEY = "weekly-strategy-plan-v1";

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekOf: string): string {
  const start = new Date(`${weekOf}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

export function emptyDays(): Record<DayKey, TaskItem[]> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

export function createEmptyPlan(weekOf = formatWeekOf(startOfWeek())): WeekPlan {
  return {
    weekOf,
    focus: "",
    days: emptyDays(),
    subjects: [],
  };
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPlan(): WeekPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeekPlan;
    if (!parsed?.weekOf || !parsed?.days) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlan(plan: WeekPlan): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}
