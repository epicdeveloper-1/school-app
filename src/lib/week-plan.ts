import { readStorage, writeStorage } from "./storage";
import type { BoxTag } from "./box-tags";
import type { SubBox } from "./sub-boxes";

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
  /** @deprecated Prefer `tags` including `"optional"`. Kept for older saved plans. */
  optional?: boolean;
  tags?: BoxTag[];
  /** Estimated duration in minutes (e.g. 45, 90). */
  estimateMinutes?: number;
  /** Start clock as `HH:mm` (24h), set from a `(time range)` in the box text. */
  startTime?: string;
  /** End clock as `HH:mm` (24h). */
  endTime?: string;
};

export type SubjectTarget = {
  id: string;
  subject: string;
  goal: string;
  done: boolean;
};

export type DayMeta = {
  title: string;
  classes?: string;
  /** Fixed start clock as `HH:mm` (24h). Finish/pace use this instead of live "now". */
  fixedStart?: string;
  /** Break minutes added to both finish times. */
  breakMinutes?: number;
};

/** A day-board box shown again on another day, still the same source item. */
export type CarriedBoxRef = {
  kind: "event" | "cs" | "routine" | "task";
  sourceWeekOf: string;
  sourceDay: DayKey;
  /** Stable board row id of the original box. */
  id: string;
};

export type DeadlineItem = {
  label: string;
  detail: string;
};

export type WeekPlan = {
  weekOf: string;
  focus: string;
  tags: string[];
  flexNotes: string[];
  deadlines: DeadlineItem[];
  dayMeta: Record<DayKey, DayMeta>;
  days: Record<DayKey, TaskItem[]>;
  subjects: SubjectTarget[];
  /**
   * Estimated minutes for overlay boxes (calendar / CS 234 / routines)
   * keyed by box id. Day-task estimates live on TaskItem; overlays are
   * not stored in `days`.
   */
  overlayEstimates?: Record<string, number>;
  /**
   * Manual board box order per day (stable row ids). When absent, the board
   * uses the default tag / optional / done sort. After the user reorders,
   * this list is remembered for the week.
   */
  dayBoxOrder?: Partial<Record<DayKey, string[]>>;
  /**
   * Pointers to boxes that also appear on this day. Checking either copy
   * toggles the same source item (used to bring missed work onto today).
   */
  carriedBoxes?: Partial<Record<DayKey, CarriedBoxRef[]>>;
  /**
   * Reminder ids pinned onto this day's board ("Add to today"). Checking the
   * board box toggles the same reminder on the Reminders page.
   */
  pinnedReminders?: Partial<Record<DayKey, string[]>>;
  /**
   * Indented sub-boxes keyed by stable board row id. Hidden until expanded.
   */
  subboxes?: Record<string, SubBox[]>;
};

/** Stable week-plan key for a CS 234 checklist overlay estimate. */
export function cs234EstimateKey(itemId: string): string {
  return `cs234:${itemId}`;
}

export type PlansStore = {
  plans: Record<string, WeekPlan>;
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

/** Multi-week store. Older single-plan keys are migrated on load. */
export const STORAGE_KEY = "weekly-strategy-plans-v8";
const LEGACY_PLAN_KEYS = [
  "weekly-strategy-plan-v7",
  "weekly-strategy-plan-v6",
  "weekly-strategy-plan-v5",
  "weekly-strategy-plan-v4",
  "weekly-strategy-plan-v3",
  "weekly-strategy-plan-v2",
];

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export function emptyDayMeta(): Record<DayKey, DayMeta> {
  return {
    monday: { title: "" },
    tuesday: { title: "" },
    wednesday: { title: "" },
    thursday: { title: "" },
    friday: { title: "" },
    saturday: { title: "" },
    sunday: { title: "" },
  };
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function shiftWeek(weekOf: string, deltaWeeks: number): string {
  const d = new Date(`${weekOf}T12:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return formatWeekOf(d);
}

function emptyStore(): PlansStore {
  return { plans: {} };
}

function isWeekPlan(value: unknown): value is WeekPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as WeekPlan;
  return typeof v.weekOf === "string" && !!v.days;
}

/** In-memory cache so week switches don’t drop unsaved edits. */
let memoryStore: PlansStore | null = null;

export function peekPlan(weekOf: string): WeekPlan | null {
  return memoryStore?.plans[weekOf] ?? null;
}

export function cachePlan(plan: WeekPlan): void {
  if (!memoryStore) memoryStore = emptyStore();
  memoryStore.plans[plan.weekOf] = plan;
}

async function readStoreFromDisk(): Promise<PlansStore> {
  const raw = await readStorage(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PlansStore | WeekPlan;
      if (parsed && typeof parsed === "object" && "plans" in parsed) {
        return { plans: (parsed as PlansStore).plans ?? {} };
      }
      if (isWeekPlan(parsed)) {
        return { plans: { [parsed.weekOf]: parsed } };
      }
    } catch {
      /* migrate below */
    }
  }

  for (const key of LEGACY_PLAN_KEYS) {
    const legacy = await readStorage(key);
    if (!legacy) continue;
    try {
      const parsed = JSON.parse(legacy) as WeekPlan;
      if (isWeekPlan(parsed)) {
        const store = { plans: { [parsed.weekOf]: parsed } };
        await writeStorage(STORAGE_KEY, JSON.stringify(store));
        return store;
      }
    } catch {
      /* try next */
    }
  }

  return emptyStore();
}

export async function initPlansStore(): Promise<PlansStore> {
  if (typeof window === "undefined") return emptyStore();
  memoryStore = await readStoreFromDisk();
  return memoryStore;
}

/** Reload plans from disk after external edits (e.g. tag purge). */
export async function reloadPlansStoreFromDisk(): Promise<PlansStore> {
  memoryStore = null;
  return initPlansStore();
}

export async function loadPlan(weekOf?: string): Promise<WeekPlan | null> {
  if (typeof window === "undefined") return null;
  if (!memoryStore) await initPlansStore();
  const key = weekOf ?? formatWeekOf(startOfWeek());
  return peekPlan(key);
}

/** Upsert this week into the multi-week store and persist. */
export async function savePlan(plan: WeekPlan): Promise<void> {
  if (typeof window === "undefined") return;
  if (!memoryStore) await initPlansStore();
  cachePlan(plan);
  await writeStorage(STORAGE_KEY, JSON.stringify(memoryStore));
}
