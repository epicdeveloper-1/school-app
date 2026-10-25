import { isBlankProfile } from "./app-profile";
import { readStorage, writeStorage } from "./storage";
import type { BoxTag } from "./box-tags";
import { normalizeTaskTags } from "./box-tags";
import {
  DayKey,
  DAYS,
  createId,
  formatWeekOf,
  startOfWeek,
} from "./week-plan";
import { normalizeClockTime } from "./task-time";

export type RecurringTodo = {
  id: string;
  text: string;
  tags: BoxTag[];
  day: DayKey;
  /** Optional start time `HH:mm` (24h). */
  startTime?: string;
  /** Optional end time `HH:mm` (24h). */
  endTime?: string;
};

export type RecurringTodoBox = {
  id: string;
  text: string;
  tags: BoxTag[];
  done: boolean;
  todoId: string;
  startTime?: string;
  endTime?: string;
};

export type RecurringTodosStore = {
  todos: RecurringTodo[];
  /** `${todoId}:${weekOf}` → done */
  doneByWeek: Record<string, boolean>;
  seedVersion?: number;
};

export const RECURRING_TODOS_STORAGE_KEY = "recurring-todos-v1";
/** 2 = drop Vocal Techniques / Water Boys / Catch-up (calendar owns first two). */
export const RECURRING_TODOS_SEED_VERSION = 2;

const DAY_KEYS: DayKey[] = DAYS.map((d) => d.key);

const REMOVED_TODO_IDS = new Set([
  "rt:vocal-tech-wed",
  "rt:water-boys-thu",
]);

function shouldDropTodo(todo: RecurringTodo): boolean {
  if (REMOVED_TODO_IDS.has(todo.id)) return true;
  if (todo.id.startsWith("rt:catch-up:")) return true;
  if (/^Catch-up$/i.test(todo.text.trim())) return true;
  return false;
}

function normalizeOptionalTime(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return normalizeClockTime(raw) ?? undefined;
}

export function buildRecurringTodoSeed(): RecurringTodo[] {
  if (isBlankProfile()) return [];
  const optional = (text: string, day: DayKey, id: string): RecurringTodo => ({
    id,
    text,
    tags: normalizeTaskTags(["optional"]),
    day,
  });

  const todos: RecurringTodo[] = [
    {
      id: "rt:voice-thu",
      text: "Voice lesson",
      tags: normalizeTaskTags(["music"]),
      day: "thursday",
      startTime: "11:00",
      endTime: "11:45",
    },
  ];

  for (const day of ["friday", "saturday", "sunday"] as DayKey[]) {
    todos.push(optional("Job hours", day, `rt:job:${day}`));
  }

  return todos;
}

function normalizeTodo(value: unknown): RecurringTodo | null {
  if (!value || typeof value !== "object") return null;
  const v = value as RecurringTodo & { voiceLesson?: boolean };
  if (
    typeof v.id !== "string" ||
    typeof v.text !== "string" ||
    typeof v.day !== "string" ||
    !DAY_KEYS.includes(v.day as DayKey)
  ) {
    return null;
  }
  const startTime = normalizeOptionalTime(v.startTime);
  const endTime = normalizeOptionalTime(v.endTime);
  // Legacy voice lessons stored times in Settings; default if missing.
  const resolvedStart =
    startTime ?? (v.voiceLesson ? "11:00" : undefined);
  const resolvedEnd = endTime ?? (v.voiceLesson ? "11:45" : undefined);
  return {
    id: v.id,
    text: v.voiceLesson ? "Voice lesson" : v.text,
    tags: normalizeTaskTags(v.tags ?? []),
    day: v.day as DayKey,
    ...(resolvedStart ? { startTime: resolvedStart } : {}),
    ...(resolvedEnd ? { endTime: resolvedEnd } : {}),
  };
}

function migrateStore(store: RecurringTodosStore): RecurringTodosStore {
  const version = store.seedVersion ?? 1;
  let todos = store.todos;
  if (version < 2) {
    todos = todos.filter((t) => !shouldDropTodo(t));
  }
  return {
    todos,
    doneByWeek: store.doneByWeek ?? {},
    seedVersion: Math.max(version, RECURRING_TODOS_SEED_VERSION),
  };
}

let memoryStore: RecurringTodosStore | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeRecurringTodos(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emptyStore(): RecurringTodosStore {
  return {
    todos: [],
    doneByWeek: {},
    seedVersion: RECURRING_TODOS_SEED_VERSION,
  };
}

async function readStoreFromDisk(): Promise<RecurringTodosStore> {
  const raw = await readStorage(RECURRING_TODOS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RecurringTodosStore;
      if (parsed && Array.isArray(parsed.todos)) {
        return migrateStore({
          todos: parsed.todos
            .map(normalizeTodo)
            .filter((t): t is RecurringTodo => !!t),
          doneByWeek:
            parsed.doneByWeek && typeof parsed.doneByWeek === "object"
              ? parsed.doneByWeek
              : {},
          seedVersion: parsed.seedVersion ?? 1,
        });
      }
    } catch {
      /* seed */
    }
  }
  return {
    todos: buildRecurringTodoSeed(),
    doneByWeek: {},
    seedVersion: RECURRING_TODOS_SEED_VERSION,
  };
}

async function persist(): Promise<void> {
  if (!memoryStore) return;
  await writeStorage(RECURRING_TODOS_STORAGE_KEY, JSON.stringify(memoryStore));
}

export async function reloadRecurringTodosStoreFromDisk(): Promise<RecurringTodosStore> {
  memoryStore = null;
  return initRecurringTodosStore();
}

export async function initRecurringTodosStore(): Promise<RecurringTodosStore> {
  if (typeof window === "undefined") return emptyStore();
  if (memoryStore) return memoryStore;
  memoryStore = await readStoreFromDisk();
  if (
    (!memoryStore.todos || memoryStore.todos.length === 0) &&
    (memoryStore.seedVersion ?? 0) < 1
  ) {
    memoryStore.todos = buildRecurringTodoSeed();
    memoryStore.seedVersion = RECURRING_TODOS_SEED_VERSION;
  }
  await persist();
  return memoryStore;
}

export function peekRecurringTodos(): RecurringTodo[] {
  return memoryStore?.todos ? [...memoryStore.todos] : [];
}

export async function listRecurringTodos(): Promise<RecurringTodo[]> {
  if (typeof window === "undefined") return [];
  if (!memoryStore) await initRecurringTodosStore();
  return [...(memoryStore?.todos ?? [])];
}

export function overlayRecurringTodosForWeek(
  todos: readonly RecurringTodo[],
  weekOf: string,
  doneByWeek: Record<string, boolean> = memoryStore?.doneByWeek ?? {},
): Record<DayKey, RecurringTodoBox[]> {
  const result = Object.fromEntries(
    DAY_KEYS.map((k) => [k, [] as RecurringTodoBox[]]),
  ) as Record<DayKey, RecurringTodoBox[]>;

  for (const todo of todos) {
    const key = `${todo.id}:${weekOf}`;
    result[todo.day].push({
      id: `rtbox:${todo.id}:${weekOf}`,
      text: todo.text,
      tags: normalizeTaskTags(todo.tags),
      done: !!doneByWeek[key],
      todoId: todo.id,
      ...(todo.startTime ? { startTime: todo.startTime } : {}),
      ...(todo.endTime ? { endTime: todo.endTime } : {}),
    });
  }
  return result;
}

export async function toggleRecurringTodo(
  todoId: string,
  weekOf: string,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!memoryStore) await initRecurringTodosStore();
  if (!memoryStore) return false;
  const key = `${todoId}:${weekOf}`;
  const next = !memoryStore.doneByWeek[key];
  memoryStore.doneByWeek = { ...memoryStore.doneByWeek, [key]: next };
  await persist();
  notify();
  return next;
}

export async function saveRecurringTodo(
  todo: Omit<RecurringTodo, "id"> & { id?: string },
): Promise<RecurringTodo> {
  const startTime = normalizeOptionalTime(todo.startTime);
  const endTime = normalizeOptionalTime(todo.endTime);
  if (typeof window === "undefined") {
    return {
      ...todo,
      id: todo.id ?? createId(),
      tags: normalizeTaskTags(todo.tags),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    };
  }
  if (!memoryStore) await initRecurringTodosStore();
  if (!memoryStore) throw new Error("Recurring todos unavailable");

  const next: RecurringTodo = {
    id: todo.id ?? createId(),
    text: todo.text.trim() || "Untitled",
    tags: normalizeTaskTags(todo.tags ?? []),
    day: todo.day,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };

  const idx = memoryStore.todos.findIndex((t) => t.id === next.id);
  if (idx >= 0) {
    memoryStore.todos = memoryStore.todos.map((t) =>
      t.id === next.id ? next : t,
    );
  } else {
    memoryStore.todos = [...memoryStore.todos, next];
  }
  await persist();
  notify();
  return next;
}

export async function deleteRecurringTodo(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!memoryStore) await initRecurringTodosStore();
  if (!memoryStore) return;
  memoryStore.todos = memoryStore.todos.filter((t) => t.id !== id);
  await persist();
  notify();
}

/** Current week Monday — used by callers that need a default. */
export function currentWeekOf(): string {
  return formatWeekOf(startOfWeek());
}
