import type { BoxTag } from "./box-tags";
import { getBoxTags, normalizeTaskTags } from "./box-tags";
import {
  DUE_EVENTS_STORAGE_KEY,
  OTHER_COURSE,
  type DueEventsStore,
} from "./due-events";
import {
  RECURRING_TODOS_STORAGE_KEY,
  type RecurringTodosStore,
} from "./recurring-todos";
import {
  REMINDERS_STORAGE_KEY,
  reloadRemindersStoreFromDisk,
  type RemindersStore,
} from "./reminders";
import { readStorage, writeStorage } from "./storage";
import { reloadDueEventsStoreFromDisk } from "./due-events";
import { reloadRecurringTodosStoreFromDisk } from "./recurring-todos";
import {
  STORAGE_KEY,
  reloadPlansStoreFromDisk,
  type DayKey,
  type PlansStore,
  type TaskItem,
  type WeekPlan,
} from "./week-plan";

export const DATA_SYNC_EVENT = "weekly-strategy:data-synced";

export async function reloadAllAppDataStores(): Promise<void> {
  await reloadPlansStoreFromDisk();
  await reloadDueEventsStoreFromDisk();
  await reloadRecurringTodosStoreFromDisk();
  await reloadRemindersStoreFromDisk();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_SYNC_EVENT));
  }
}

function stripTag(tags: BoxTag[] | undefined, id: BoxTag): BoxTag[] {
  return normalizeTaskTags((tags ?? []).filter((t) => t !== id));
}

function replaceTagId(
  tags: BoxTag[] | undefined,
  from: BoxTag,
  to: BoxTag,
): BoxTag[] {
  const next = (tags ?? []).map((t) => (t === from ? to : t));
  return normalizeTaskTags(next);
}

function migratePlanTags(
  plan: WeekPlan,
  mutate: (tags: BoxTag[] | undefined) => BoxTag[],
): WeekPlan {
  const days = {} as Record<DayKey, TaskItem[]>;
  for (const [day, tasks] of Object.entries(plan.days) as [
    DayKey,
    TaskItem[],
  ][]) {
    days[day] = tasks.map((t) => ({
      ...t,
      tags: mutate(t.tags),
    }));
  }
  return { ...plan, days };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace legacy inline tag labels in task text after a rename. */
function retitleTaskText(text: string, oldLabel: string, newLabel: string): string {
  if (!oldLabel.trim() || oldLabel === newLabel) return text;
  const label = escapeRegExp(oldLabel.trim());
  let next = text.replace(
    new RegExp(`^${label}(\\s*\\|\\s*|\\s+)`, "i"),
    `${newLabel}$1`,
  );
  next = next.replace(new RegExp(`^${label}\\s*`, "i"), `${newLabel} `);
  return next;
}

export async function replaceTagLabelInAllData(
  oldLabel: string,
  newLabel: string,
): Promise<void> {
  if (!oldLabel.trim() || oldLabel.trim() === newLabel.trim()) return;

  const plansStore = await readJson<PlansStore>(STORAGE_KEY);
  if (plansStore?.plans) {
    const plans: Record<string, WeekPlan> = {};
    for (const [week, plan] of Object.entries(plansStore.plans)) {
      const days = {} as Record<DayKey, TaskItem[]>;
      for (const [day, tasks] of Object.entries(plan.days) as [
        DayKey,
        TaskItem[],
      ][]) {
        days[day] = tasks.map((t) => ({
          ...t,
          text: retitleTaskText(t.text, oldLabel, newLabel.trim()),
        }));
      }
      plans[week] = { ...plan, days };
    }
    await writeStorage(STORAGE_KEY, JSON.stringify({ plans }));
  }

  const dueStore = await readJson<DueEventsStore>(DUE_EVENTS_STORAGE_KEY);
  if (dueStore?.events) {
    const trimmedOld = oldLabel.trim();
    const trimmedNew = newLabel.trim();
    const events = dueStore.events.map((ev) =>
      ev.course === trimmedOld ? { ...ev, course: trimmedNew } : ev,
    );
    await writeStorage(
      DUE_EVENTS_STORAGE_KEY,
      JSON.stringify({ ...dueStore, events }),
    );
  }

  await reloadAllAppDataStores();
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Remove a tag id from every persisted store. */
export async function purgeTagFromAllData(tagId: BoxTag): Promise<void> {
  const courseLabel = getBoxTags().find((t) => t.id === tagId)?.label;

  const plansStore = await readJson<PlansStore>(STORAGE_KEY);
  if (plansStore?.plans) {
    const plans: Record<string, WeekPlan> = {};
    for (const [week, plan] of Object.entries(plansStore.plans)) {
      plans[week] = migratePlanTags(plan, (tags) => stripTag(tags, tagId));
    }
    await writeStorage(STORAGE_KEY, JSON.stringify({ plans }));
  }

  const dueStore = await readJson<DueEventsStore>(DUE_EVENTS_STORAGE_KEY);
  if (dueStore?.events) {
    const events = dueStore.events.map((ev) => ({
      ...ev,
      course:
        courseLabel && ev.course === courseLabel ? OTHER_COURSE : ev.course,
      rules: ev.rules?.map((r) => ({
        ...r,
        tags: stripTag(r.tags, tagId),
      })),
    }));
    await writeStorage(
      DUE_EVENTS_STORAGE_KEY,
      JSON.stringify({ ...dueStore, events }),
    );
  }

  const recurring = await readJson<RecurringTodosStore>(
    RECURRING_TODOS_STORAGE_KEY,
  );
  if (recurring?.todos) {
    const todos = recurring.todos.map((t) => ({
      ...t,
      tags: stripTag(t.tags, tagId),
    }));
    await writeStorage(
      RECURRING_TODOS_STORAGE_KEY,
      JSON.stringify({ ...recurring, todos }),
    );
  }

  const reminders = await readJson<RemindersStore>(REMINDERS_STORAGE_KEY);
  if (reminders?.reminders) {
    const next = reminders.reminders.map((r) => ({
      ...r,
      tags: stripTag(r.tags, tagId),
    }));
    await writeStorage(
      REMINDERS_STORAGE_KEY,
      JSON.stringify({ reminders: next }),
    );
  }

  await reloadAllAppDataStores();
}

/** Rename tag id everywhere it appears (e.g. after slug change). */
export async function renameTagIdInAllData(
  fromId: BoxTag,
  toId: BoxTag,
): Promise<void> {
  if (fromId === toId) return;

  const plansStore = await readJson<PlansStore>(STORAGE_KEY);
  if (plansStore?.plans) {
    const plans: Record<string, WeekPlan> = {};
    for (const [week, plan] of Object.entries(plansStore.plans)) {
      plans[week] = migratePlanTags(plan, (tags) =>
        replaceTagId(tags, fromId, toId),
      );
    }
    await writeStorage(STORAGE_KEY, JSON.stringify({ plans }));
  }

  const dueStore = await readJson<DueEventsStore>(DUE_EVENTS_STORAGE_KEY);
  if (dueStore?.events) {
    const events = dueStore.events.map((ev) => ({
      ...ev,
      rules: ev.rules?.map((r) => ({
        ...r,
        tags: replaceTagId(r.tags, fromId, toId),
      })),
    }));
    await writeStorage(
      DUE_EVENTS_STORAGE_KEY,
      JSON.stringify({ ...dueStore, events }),
    );
  }

  const recurring = await readJson<RecurringTodosStore>(
    RECURRING_TODOS_STORAGE_KEY,
  );
  if (recurring?.todos) {
    const todos = recurring.todos.map((t) => ({
      ...t,
      tags: replaceTagId(t.tags, fromId, toId),
    }));
    await writeStorage(
      RECURRING_TODOS_STORAGE_KEY,
      JSON.stringify({ ...recurring, todos }),
    );
  }

  const reminders = await readJson<RemindersStore>(REMINDERS_STORAGE_KEY);
  if (reminders?.reminders) {
    const next = reminders.reminders.map((r) => ({
      ...r,
      tags: replaceTagId(r.tags, fromId, toId),
    }));
    await writeStorage(
      REMINDERS_STORAGE_KEY,
      JSON.stringify({ reminders: next }),
    );
  }
}
