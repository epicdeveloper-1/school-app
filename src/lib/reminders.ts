import type { BoxTag } from "./box-tags";
import { normalizeTaskTags } from "./box-tags";
import { readStorage, writeStorage } from "./storage";
import {
  DayKey,
  DAYS,
  WeekPlan,
  cachePlan,
  createId,
  formatWeekOf,
  initPlansStore,
  peekPlan,
  savePlan,
  startOfWeek,
  STORAGE_KEY,
} from "./week-plan";
import { buildWeekPlan } from "./strategy-data";

/** Same event as tag-data-sync — kept local to avoid a circular import. */
const DATA_SYNC_EVENT = "weekly-strategy:data-synced";

export type Reminder = {
  id: string;
  text: string;
  done: boolean;
  tags: BoxTag[];
  createdAt: number;
  completedAt?: number;
};

export type ReminderBoardBox = {
  id: string;
  text: string;
  tags: BoxTag[];
  done: boolean;
  reminderId: string;
};

export type RemindersStore = {
  reminders: Reminder[];
};

export const REMINDERS_STORAGE_KEY = "weekly-strategy-reminders-v1";

let memoryStore: RemindersStore | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeReminders(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emptyStore(): RemindersStore {
  return { reminders: [] };
}

function normalizeReminder(value: unknown): Reminder | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Reminder;
  if (typeof v.id !== "string" || typeof v.text !== "string") return null;
  const createdAt =
    typeof v.createdAt === "number" && Number.isFinite(v.createdAt)
      ? v.createdAt
      : Date.now();
  const completedAt =
    typeof v.completedAt === "number" && Number.isFinite(v.completedAt)
      ? v.completedAt
      : undefined;
  return {
    id: v.id,
    text: v.text,
    done: !!v.done,
    tags: normalizeTaskTags(v.tags ?? []),
    createdAt,
    ...(completedAt != null ? { completedAt } : {}),
  };
}

async function readStoreFromDisk(): Promise<RemindersStore> {
  const raw = await readStorage(REMINDERS_STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as RemindersStore;
    if (!parsed || !Array.isArray(parsed.reminders)) return emptyStore();
    return {
      reminders: parsed.reminders
        .map(normalizeReminder)
        .filter((r): r is Reminder => !!r),
    };
  } catch {
    return emptyStore();
  }
}

async function persist(): Promise<void> {
  if (!memoryStore) return;
  await writeStorage(REMINDERS_STORAGE_KEY, JSON.stringify(memoryStore));
}

export async function reloadRemindersStoreFromDisk(): Promise<RemindersStore> {
  memoryStore = null;
  return initRemindersStore();
}

export async function initRemindersStore(): Promise<RemindersStore> {
  if (typeof window === "undefined") return emptyStore();
  if (memoryStore) return memoryStore;
  memoryStore = await readStoreFromDisk();
  return memoryStore;
}

export function peekReminders(): Reminder[] {
  return memoryStore?.reminders ? [...memoryStore.reminders] : [];
}

export function peekReminder(id: string): Reminder | null {
  return memoryStore?.reminders.find((r) => r.id === id) ?? null;
}

export async function listReminders(): Promise<Reminder[]> {
  if (typeof window === "undefined") return [];
  if (!memoryStore) await initRemindersStore();
  return [...(memoryStore?.reminders ?? [])];
}

export function reminderEstimateKey(reminderId: string): string {
  return `reminder:${reminderId}`;
}

export function reminderBoardBoxId(reminderId: string): string {
  return `reminder-box:${reminderId}`;
}

function dayKeyForDate(date: string): DayKey {
  const jsDay = new Date(`${date}T12:00:00`).getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAYS[idx]!.key;
}

export function todayBoardTarget(): { weekOf: string; day: DayKey } {
  const today = formatWeekOf(new Date());
  return {
    weekOf: formatWeekOf(startOfWeek(new Date(`${today}T12:00:00`))),
    day: dayKeyForDate(today),
  };
}

function normalizePinnedReminders(
  raw: WeekPlan["pinnedReminders"],
): WeekPlan["pinnedReminders"] {
  if (!raw || typeof raw !== "object") return undefined;
  const next: NonNullable<WeekPlan["pinnedReminders"]> = {};
  for (const day of DAYS) {
    const list = raw[day.key];
    if (!Array.isArray(list)) continue;
    const ids = [
      ...new Set(
        list.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      ),
    ];
    if (ids.length > 0) next[day.key] = ids;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function ensurePlan(weekOf: string): WeekPlan {
  const stored = peekPlan(weekOf);
  if (stored) return stored;
  const seeded = buildWeekPlan(weekOf);
  cachePlan(seeded);
  return seeded;
}

export function isReminderPinnedOnDay(
  plan: WeekPlan | null | undefined,
  day: DayKey,
  reminderId: string,
): boolean {
  return (plan?.pinnedReminders?.[day] ?? []).includes(reminderId);
}

export function isReminderPinnedToday(reminderId: string): boolean {
  const { weekOf, day } = todayBoardTarget();
  const plan = peekPlan(weekOf);
  return isReminderPinnedOnDay(plan, day, reminderId);
}

export async function pinReminderToToday(reminderId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  await initRemindersStore();
  if (!peekReminder(reminderId)) return false;
  await initPlansStore();
  const { weekOf, day } = todayBoardTarget();
  const plan = ensurePlan(weekOf);
  const list = plan.pinnedReminders?.[day] ?? [];
  if (list.includes(reminderId)) return false;
  const next: WeekPlan = {
    ...plan,
    pinnedReminders: {
      ...plan.pinnedReminders,
      [day]: [...list, reminderId],
    },
  };
  await savePlan(next);
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
  notify();
  return true;
}

export async function unpinReminderFromDay(
  weekOf: string,
  day: DayKey,
  reminderId: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  await initPlansStore();
  const plan = peekPlan(weekOf) ?? ensurePlan(weekOf);
  const list = (plan.pinnedReminders?.[day] ?? []).filter(
    (id) => id !== reminderId,
  );
  const pinnedReminders = { ...(plan.pinnedReminders ?? {}) };
  if (list.length > 0) pinnedReminders[day] = list;
  else delete pinnedReminders[day];
  await savePlan({
    ...plan,
    pinnedReminders:
      Object.keys(pinnedReminders).length > 0 ? pinnedReminders : undefined,
  });
  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
  notify();
}

export async function unpinReminderFromToday(
  reminderId: string,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isReminderPinnedToday(reminderId)) return false;
  const { weekOf, day } = todayBoardTarget();
  await unpinReminderFromDay(weekOf, day, reminderId);
  return true;
}

/** Pin to today if not pinned; unpin if already pinned. */
export async function toggleReminderPinnedToday(
  reminderId: string,
): Promise<boolean> {
  if (isReminderPinnedToday(reminderId)) {
    await unpinReminderFromToday(reminderId);
    return false;
  }
  await pinReminderToToday(reminderId);
  return true;
}

export function reminderBoxesForDay(
  reminders: readonly Reminder[],
  plan: WeekPlan | null | undefined,
  day: DayKey,
): ReminderBoardBox[] {
  const ids = plan?.pinnedReminders?.[day] ?? [];
  const byId = new Map(reminders.map((r) => [r.id, r]));
  const boxes: ReminderBoardBox[] = [];
  for (const id of ids) {
    const reminder = byId.get(id);
    if (!reminder) continue;
    boxes.push({
      id: reminderBoardBoxId(reminder.id),
      text: reminder.text,
      tags: normalizeTaskTags(reminder.tags),
      done: reminder.done,
      reminderId: reminder.id,
    });
  }
  return boxes;
}

export async function addReminder(input: {
  text: string;
  tags?: BoxTag[];
}): Promise<Reminder> {
  const text = input.text.trim();
  const tags = normalizeTaskTags(input.tags ?? []);
  if (typeof window === "undefined") {
    return {
      id: createId(),
      text: text || "Untitled",
      done: false,
      tags,
      createdAt: Date.now(),
    };
  }
  if (!memoryStore) await initRemindersStore();
  if (!memoryStore) throw new Error("Reminders unavailable");
  const next: Reminder = {
    id: createId(),
    text: text || "Untitled",
    done: false,
    tags,
    createdAt: Date.now(),
  };
  memoryStore.reminders = [next, ...memoryStore.reminders];
  await persist();
  notify();
  return next;
}

export async function updateReminder(
  id: string,
  patch: { text?: string; tags?: BoxTag[] },
): Promise<Reminder | null> {
  if (typeof window === "undefined") return null;
  if (!memoryStore) await initRemindersStore();
  if (!memoryStore) return null;
  const idx = memoryStore.reminders.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const cur = memoryStore.reminders[idx]!;
  const next: Reminder = {
    ...cur,
    ...(patch.text !== undefined
      ? { text: patch.text.trim() || "Untitled" }
      : {}),
    ...(patch.tags !== undefined
      ? { tags: normalizeTaskTags(patch.tags) }
      : {}),
  };
  memoryStore.reminders = memoryStore.reminders.map((r) =>
    r.id === id ? next : r,
  );
  await persist();
  notify();
  return next;
}

export async function toggleReminder(id: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!memoryStore) await initRemindersStore();
  if (!memoryStore) return false;
  const cur = memoryStore.reminders.find((r) => r.id === id);
  if (!cur) return false;
  const done = !cur.done;
  memoryStore.reminders = memoryStore.reminders.map((r) =>
    r.id === id
      ? {
          ...r,
          done,
          ...(done
            ? { completedAt: Date.now() }
            : { completedAt: undefined }),
        }
      : r,
  );
  await persist();
  notify();
  return done;
}

export async function deleteReminder(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!memoryStore) await initRemindersStore();
  if (!memoryStore) return;
  memoryStore.reminders = memoryStore.reminders.filter((r) => r.id !== id);
  await persist();

  await initPlansStore();
  const raw = await readStorage(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { plans?: Record<string, WeekPlan> };
      if (parsed?.plans) {
        let changed = false;
        const plans: Record<string, WeekPlan> = {};
        for (const [week, plan] of Object.entries(parsed.plans)) {
          const pinned = plan.pinnedReminders;
          if (!pinned) {
            plans[week] = plan;
            continue;
          }
          const nextPinned: NonNullable<WeekPlan["pinnedReminders"]> = {};
          for (const day of DAYS) {
            const list = (pinned[day.key] ?? []).filter((x) => x !== id);
            if (list.length > 0) nextPinned[day.key] = list;
            if (list.length !== (pinned[day.key] ?? []).length) changed = true;
          }
          plans[week] = {
            ...plan,
            pinnedReminders:
              Object.keys(nextPinned).length > 0 ? nextPinned : undefined,
          };
          cachePlan(plans[week]!);
        }
        if (changed) {
          await writeStorage(STORAGE_KEY, JSON.stringify({ plans }));
        }
      }
    } catch {
      /* ignore */
    }
  }

  window.dispatchEvent(new Event(DATA_SYNC_EVENT));
  notify();
}

/** Strip a tag id from every reminder (used by settings purge). */
export async function mapReminderTags(
  mutate: (tags: BoxTag[]) => BoxTag[],
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!memoryStore) await initRemindersStore();
  if (!memoryStore) return;
  memoryStore.reminders = memoryStore.reminders.map((r) => ({
    ...r,
    tags: mutate(r.tags),
  }));
  await persist();
  notify();
}

export { normalizePinnedReminders };
