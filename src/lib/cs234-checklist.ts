import { isBlankProfile } from "./app-profile";
import { readStorage, writeStorage } from "./storage";

export type Cs234ItemKind =
  | "module"
  | "exercise"
  | "quiz"
  | "assignment"
  | "la"
  | "study";

export type Cs234ChecklistItem = {
  id: string;
  kind: Cs234ItemKind;
  label: string;
  weeks: number[];
  dueNote?: string;
  done: boolean;
};

export type Cs234WeekInfo = {
  week: number;
  label: string;
  boardWeekOf: string;
};

export type Cs234ChecklistStore = {
  items: Cs234ChecklistItem[];
};

export const CS234_CHECKLIST_STORAGE_KEY = "cs234-checklist-v1";

/** Course weeks 1–12 (no reading week). */
export const CS234_WEEKS: Cs234WeekInfo[] = [
  { week: 1, label: "Wed Sep 9 – Sun Sep 13", boardWeekOf: "2026-09-07" },
  { week: 2, label: "Mon Sep 14 – Sun Sep 20", boardWeekOf: "2026-09-14" },
  { week: 3, label: "Mon Sep 21 – Sun Sep 27", boardWeekOf: "2026-09-21" },
  { week: 4, label: "Mon Sep 28 – Sun Oct 4", boardWeekOf: "2026-09-28" },
  { week: 5, label: "Mon Oct 5 – Sun Oct 11", boardWeekOf: "2026-10-05" },
  { week: 6, label: "Mon Oct 19 – Sun Oct 25", boardWeekOf: "2026-10-19" },
  { week: 7, label: "Mon Oct 26 – Sun Nov 1", boardWeekOf: "2026-10-26" },
  { week: 8, label: "Mon Nov 2 – Sun Nov 8", boardWeekOf: "2026-11-02" },
  { week: 9, label: "Mon Nov 9 – Sun Nov 15", boardWeekOf: "2026-11-09" },
  { week: 10, label: "Mon Nov 16 – Sun Nov 22", boardWeekOf: "2026-11-16" },
  { week: 11, label: "Mon Nov 23 – Sun Nov 29", boardWeekOf: "2026-11-23" },
  { week: 12, label: "Mon Nov 30 – Tue Dec 8", boardWeekOf: "2026-11-30" },
];

const BOARD_WEEK_TO_CS: Record<string, number> = Object.fromEntries(
  CS234_WEEKS.map((w) => [w.boardWeekOf, w.week]),
);

/**
 * Deduplicate seed rows that were listed with expanding week arrays —
 * keep the widest weeks[] + latest dueNote per id.
 */
export function normalizeCs234Seed(
  rows: Cs234ChecklistItem[],
): Cs234ChecklistItem[] {
  const byId = new Map<string, Cs234ChecklistItem>();
  for (const row of rows) {
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, { ...row, weeks: [...row.weeks] });
      continue;
    }
    const weeks = Array.from(new Set([...prev.weeks, ...row.weeks])).sort(
      (a, b) => a - b,
    );
    byId.set(row.id, {
      ...prev,
      weeks,
      dueNote: row.dueNote ?? prev.dueNote,
    });
  }
  return Array.from(byId.values());
}

/**
 * Refresh weeks / labels / dueNotes from the syllabus seed; keep done flags.
 */
export function syncCs234ItemsWithSeed(
  stored: Cs234ChecklistItem[],
): Cs234ChecklistItem[] {
  const seed = normalizeCs234Seed(buildCs234ChecklistSeed());
  const doneById = new Map(stored.map((i) => [i.id, i.done]));
  return seed.map((item) => ({
    ...item,
    done: doneById.get(item.id) ?? false,
  }));
}

function emptyStore(): Cs234ChecklistStore {
  return { items: [] };
}

function isItem(value: unknown): value is Cs234ChecklistItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Cs234ChecklistItem;
  return (
    typeof v.id === "string" &&
    typeof v.kind === "string" &&
    typeof v.label === "string" &&
    Array.isArray(v.weeks) &&
    typeof v.done === "boolean"
  );
}

let memoryStore: Cs234ChecklistStore | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to checklist mutations (toggles / init). */
export function subscribeCs234(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function readStoreFromDisk(): Promise<Cs234ChecklistStore> {
  const raw = await readStorage(CS234_CHECKLIST_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Cs234ChecklistStore;
      if (parsed && Array.isArray(parsed.items)) {
        const items = parsed.items.filter(isItem);
        if (items.length > 0) {
          return { items: syncCs234ItemsWithSeed(items) };
        }
      }
    } catch {
      /* seed below */
    }
  }
  return { items: normalizeCs234Seed(buildCs234ChecklistSeed()) };
}

async function persist(): Promise<void> {
  if (!memoryStore) return;
  await writeStorage(CS234_CHECKLIST_STORAGE_KEY, JSON.stringify(memoryStore));
}

export async function initCs234ChecklistStore(): Promise<Cs234ChecklistStore> {
  if (typeof window === "undefined") return emptyStore();
  if (isBlankProfile()) {
    memoryStore = emptyStore();
    return memoryStore;
  }
  if (memoryStore) return memoryStore;
  memoryStore = await readStoreFromDisk();
  await persist();
  notify();
  return memoryStore;
}

export function peekCs234Items(): Cs234ChecklistItem[] {
  return memoryStore?.items ? [...memoryStore.items] : [];
}

export async function listCs234Items(): Promise<Cs234ChecklistItem[]> {
  if (typeof window === "undefined") return [];
  if (!memoryStore) await initCs234ChecklistStore();
  return [...(memoryStore?.items ?? [])];
}

export function itemsForWeek(
  items: Cs234ChecklistItem[],
  week: number,
): Cs234ChecklistItem[] {
  return items.filter((i) => i.weeks.includes(week));
}

export function modulesForWeek(
  items: Cs234ChecklistItem[],
  week: number,
): Cs234ChecklistItem[] {
  return itemsForWeek(items, week).filter((i) => i.kind === "module");
}

export function lasForWeek(
  items: Cs234ChecklistItem[],
  week: number,
): Cs234ChecklistItem[] {
  return itemsForWeek(items, week).filter((i) => i.kind === "la");
}

/** Exercises, quizzes, assignments, study — Saturday board boxes. */
export function problemSolvingForWeek(
  items: Cs234ChecklistItem[],
  week: number,
): Cs234ChecklistItem[] {
  return itemsForWeek(items, week).filter(
    (i) =>
      i.kind === "exercise" ||
      i.kind === "quiz" ||
      i.kind === "assignment" ||
      i.kind === "study",
  );
}

/** Friday board: modules + learning activities (lecture content). */
export function lectureContentForWeek(
  items: Cs234ChecklistItem[],
  week: number,
): Cs234ChecklistItem[] {
  return itemsForWeek(items, week).filter(
    (i) => i.kind === "module" || i.kind === "la",
  );
}

export function csWeekNumberForBoardWeek(weekOf: string): number | null {
  return BOARD_WEEK_TO_CS[weekOf] ?? null;
}

export function weekInfo(week: number): Cs234WeekInfo | undefined {
  return CS234_WEEKS.find((w) => w.week === week);
}

function addDaysToDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function csWeekContainingDate(dateStr: string): number | null {
  for (const w of CS234_WEEKS) {
    const end = addDaysToDate(w.boardWeekOf, 6);
    if (dateStr >= w.boardWeekOf && dateStr <= end) return w.week;
  }
  return null;
}

function previousCsWeekNumber(week: number): number | null {
  const idx = CS234_WEEKS.findIndex((w) => w.week === week);
  if (idx <= 0) return null;
  return CS234_WEEKS[idx - 1]!.week;
}

function listedDueForItem(item: Cs234ChecklistItem): string | undefined {
  return cs234OfficialDues().find((d) => d.title === item.label)?.listedDue;
}

/**
 * Board / optional “due week” for CS work schedule (Thu–Fri only).
 * Official listed dates are unchanged; Mon–Wed dues are treated as due the
 * prior CS week so they can be finished on that week’s Thu/Fri.
 */
export function effectiveCsDueWeek(item: Cs234ChecklistItem): number | null {
  if (!item.dueNote) return null;
  // Suggested-timing exercises stay tied to the week they appear.
  if (item.dueNote === "suggested timing") return null;

  const listed = listedDueForItem(item);
  if (listed) {
    const calWeek = csWeekContainingDate(listed);
    if (calWeek != null) {
      // 0=Sun … 3=Wed — pull Mon/Tue/Wed back one CS week.
      const dow = new Date(`${listed}T12:00:00`).getDay();
      if (dow >= 1 && dow <= 3) {
        return previousCsWeekNumber(calWeek) ?? calWeek;
      }
      return calWeek;
    }
  }

  if (item.dueNote.startsWith("due week ")) {
    const dueWeek = Number(item.dueNote.replace("due week ", ""));
    return Number.isFinite(dueWeek) ? dueWeek : null;
  }
  // Reading week sits between CS weeks 5 and 6.
  if (item.dueNote === "due reading week") return 5;
  return null;
}

/**
 * Quizzes / assignments / LAs often appear in checklists before their due week.
 * Those early appearances are optional; once the (work) due week arrives or has
 * passed, they are required. Mon–Wed listed dues use the prior CS week.
 */
export function isCsItemOptionalInWeek(
  item: Cs234ChecklistItem,
  week: number,
): boolean {
  const dueWeek = effectiveCsDueWeek(item);
  if (dueWeek == null) return false;
  return week < dueWeek;
}

/** Due-note text for display in a specific course week. */
export function dueNoteForWeek(
  item: Cs234ChecklistItem,
  week: number,
): string | undefined {
  if (!item.dueNote) return undefined;
  const dueWeek = effectiveCsDueWeek(item);
  if (dueWeek != null) {
    if (dueWeek === week) return "due this week";
    return `due week ${dueWeek}`;
  }
  return item.dueNote;
}

export async function toggleCs234Item(id: string): Promise<Cs234ChecklistItem | null> {
  if (typeof window === "undefined") return null;
  if (!memoryStore) await initCs234ChecklistStore();
  if (!memoryStore) return null;
  const current = memoryStore.items.find((i) => i.id === id);
  if (!current) return null;
  const next = { ...current, done: !current.done };
  memoryStore.items = memoryStore.items.map((i) => (i.id === id ? next : i));
  await persist();
  notify();
  return next;
}

export async function setCs234ItemDone(
  id: string,
  done: boolean,
): Promise<Cs234ChecklistItem | null> {
  if (typeof window === "undefined") return null;
  if (!memoryStore) await initCs234ChecklistStore();
  if (!memoryStore) return null;
  const current = memoryStore.items.find((i) => i.id === id);
  if (!current) return null;
  const next = { ...current, done };
  memoryStore.items = memoryStore.items.map((i) => (i.id === id ? next : i));
  await persist();
  notify();
  return next;
}


const cs234Seed =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./personal/cs234-seed") as typeof import("./personal/cs234-seed"));

export function buildCs234ChecklistSeed(): Cs234ChecklistItem[] {
  if (!cs234Seed) return [];
  return cs234Seed.buildCs234ChecklistSeed();
}

export function isLegacyCs234DayTask(
  taskOrText: string | { text: string; tags?: string[]; optional?: boolean },
): boolean {
  if (!cs234Seed) return false;
  return cs234Seed.isLegacyCs234DayTask(taskOrText);
}

export function cs234OfficialDues(): Cs234OfficialDue[] {
  if (!cs234Seed) return [];
  return cs234Seed.cs234OfficialDues();
}

/** Official CS due dates (syllabus listed day) for calendar seed (store as day − 1). */
export type Cs234OfficialDue = {
  title: string;
  listedDue: string;
  detail?: string;
};

