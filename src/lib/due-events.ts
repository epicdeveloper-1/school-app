import { readStorage, writeStorage } from "./storage";
import type { BoxTag } from "./box-tags";
import { boxTagMeta, getBoxTags, normalizeTaskTags } from "./box-tags";
import {
  DayKey,
  DAYS,
  createId,
  formatWeekOf,
  shiftWeek,
  startOfWeek,
} from "./week-plan";
import { normalizeClockTime } from "./task-time";
import {
  AMATH_MIDTERM_WEEK_OF,
  READING_WEEK_OF,
  isMath235ShortGap,
  termQuizWeekMondays,
} from "./strategy-data";

/** Course label on calendar events — matches a box-tag label, or `"Other"`. */
export type DueCourse = string;

export const OTHER_COURSE = "Other";

export type BoardPlacementRelative = "weekOf" | "weekPrior";

export type BoardPlacementRule = {
  id: string;
  relative: BoardPlacementRelative;
  day: DayKey;
  text: string;
  tags: BoxTag[];
  /** Optional start time `HH:mm` (24h), shown on every occurrence. */
  startTime?: string;
  /** Optional end time `HH:mm` (24h). */
  endTime?: string;
  /** Default duration for every occurrence of this box (minutes). */
  estimateMinutes?: number;
};

/** Extra date/time for a custom (non-weekly) series. */
export type CustomOccurrence = {
  date: string;
  /** Overrides series start time for this date when set. */
  startTime?: string;
  /** Overrides series end time for this date when set. */
  endTime?: string;
};

export type WeeklyRecurrence = {
  frequency: "weekly";
  interval?: number;
  /** Inclusive last occurrence date (YYYY-MM-DD). */
  until?: string;
};

export type CustomRecurrence = {
  frequency: "custom";
  /** Additional dates beyond the series master `date`. */
  occurrences: CustomOccurrence[];
};

export type EventRecurrence = WeeklyRecurrence | CustomRecurrence;

export type DueEvent = {
  id: string;
  title: string;
  detail: string;
  /** First occurrence (series master) or sole date. */
  date: string;
  /**
   * Inclusive last day of a multi-day span (YYYY-MM-DD).
   * When omitted or equal to `date`, the event is single-day.
   * For weekly/custom series, each occurrence keeps the same length as master.
   */
  endDate?: string;
  course: DueCourse;
  /** Optional start time `HH:mm` (24h). */
  startTime?: string;
  /** Optional end time `HH:mm` (24h). */
  endTime?: string;
  /**
   * When true, place a board box on the occurrence day using the event title
   * (and start/end times), tagged with the course.
   */
  appearOnBoard?: boolean;
  rules?: BoardPlacementRule[];
  recurrence?: EventRecurrence | null;
  /** Instance dates removed from a series (YYYY-MM-DD). */
  excludedDates?: string[];
  /** Append 1, 2, 3… to titles of kept series instances. */
  autoNumber?: boolean;
};

/** Expanded calendar occurrence (recurring masters yield many). */
export type DueEventInstance = DueEvent & {
  instanceDate: string;
  /** Inclusive end of this occurrence's span. */
  instanceEndDate: string;
  seriesId: string;
  /** 1-based ordinal when autoNumber is on. */
  occurrenceNumber?: number;
};

/** One continuous bar piece within a single Mon–Sun week row. */
export type MonthSpanSegment = {
  seriesId: string;
  title: string;
  course: DueCourse;
  instanceDate: string;
  instanceEndDate: string;
  weekIndex: number;
  /** 0–6 Monday-first column. */
  startCol: number;
  /** 0–6 inclusive. */
  endCol: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type EventBoardBox = {
  id: string;
  text: string;
  tags: BoxTag[];
  done: boolean;
  sourceEventId: string;
  sourceRuleId: string;
  /** Instance date of the event that produced this box. */
  instanceDate: string;
  startTime?: string;
  endTime?: string;
  /** Default duration from the placement rule (minutes). */
  estimateMinutes?: number;
};

export type DueEventsStore = {
  events: DueEvent[];
  /** 6 = lifestyle series use appearOnBoard + clock times. */
  seedVersion?: number;
  boxDone?: Record<string, boolean>;
};

export const DUE_EVENTS_STORAGE_KEY = "due-events-v1";
/** 6 = lifestyle series use appearOnBoard + clock times. */
export const DUE_EVENTS_SEED_VERSION = 6;

/** Course picker options from the tag registry (Optional excluded; Other last). */
export function listDueCourses(): DueCourse[] {
  const labels = getBoxTags()
    .filter((t) => t.id !== "optional")
    .map((t) => t.label)
    .filter((label) => label !== OTHER_COURSE);
  return [...labels, OTHER_COURSE];
}

/** Seafoam fallback for Other / unmapped courses (matches calendar default). */
const OTHER_COURSE_COLOR = "#1f9e8f";

/** Board tag for a calendar course label, if one exists (not Other). */
export function tagForDueCourse(course: DueCourse): BoxTag | undefined {
  if (!course || course === OTHER_COURSE) return undefined;
  const match = getBoxTags().find(
    (t) => t.id !== "optional" && t.label === course,
  );
  return match?.id;
}

export function dueCourseColor(course: DueCourse): string {
  const tag = tagForDueCourse(course);
  if (!tag) return OTHER_COURSE_COLOR;
  return boxTagMeta(tag).color;
}

const DAY_KEYS: DayKey[] = DAYS.map((d) => d.key);

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatWeekOf(d);
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Normalize an inclusive end date; returns undefined when single-day. */
function normalizeEndDate(
  start: string,
  end: string | undefined | null,
): string | undefined {
  if (typeof end !== "string" || !DATE_RE.test(end)) return undefined;
  if (end <= start) return undefined;
  return end;
}

function spanLengthDays(event: DueEvent): number {
  const end = normalizeEndDate(event.date, event.endDate);
  return end ? daysBetween(event.date, end) : 0;
}

function instanceEndFor(start: string, spanDays: number): string {
  return spanDays > 0 ? addDays(start, spanDays) : start;
}

export function eventCoversDate(
  instance: Pick<DueEventInstance, "instanceDate" | "instanceEndDate">,
  date: string,
): boolean {
  return instance.instanceDate <= date && date <= instance.instanceEndDate;
}

export function isMultiDayInstance(
  instance: Pick<DueEventInstance, "instanceDate" | "instanceEndDate">,
): boolean {
  return instance.instanceEndDate > instance.instanceDate;
}

function emptyStore(): DueEventsStore {
  return { events: [], seedVersion: DUE_EVENTS_SEED_VERSION, boxDone: {} };
}

function rule(
  id: string,
  relative: BoardPlacementRelative,
  day: DayKey,
  text: string,
  tags: BoxTag[],
): BoardPlacementRule {
  return {
    id,
    relative,
    day,
    text,
    tags: normalizeTaskTags(tags),
  };
}

/** Shared weekend + Mon study + Tue quiz pattern for weekly Tue quizzes. */
export function tueQuizRules(courseTag: BoxTag): BoardPlacementRule[] {
  return [
    rule("r:study-sat", "weekPrior", "saturday", "Study", [courseTag]),
    rule("r:study-sun", "weekPrior", "sunday", "Study", [courseTag]),
    rule("r:study-mon", "weekOf", "monday", "Study", [courseTag]),
    rule("r:quiz-tue", "weekOf", "tuesday", "Quiz", [courseTag]),
  ];
}

export function math235RulesForDate(quizDate: string): BoardPlacementRule[] {
  const rules: BoardPlacementRule[] = [
    rule("r:study-thu", "weekOf", "thursday", "Study", ["math235"]),
    rule("r:quiz-thu", "weekOf", "thursday", "Quiz", ["math235"]),
  ];
  if (isMath235ShortGap(quizDate)) {
    rules.unshift(
      rule("r:study-wed", "weekOf", "wednesday", "Study", ["math235"]),
    );
  } else {
    rules.push(
      rule("r:study-sat", "weekOf", "saturday", "Study", ["math235"]),
      rule("r:study-sun", "weekOf", "sunday", "Study", [
        "math235",
        "optional",
      ]),
    );
  }
  return rules;
}

export function midtermRules(): BoardPlacementRule[] {
  return [
    rule("r:study-sat", "weekPrior", "saturday", "Midterm Study", [
      "amath250",
    ]),
    rule("r:study-sun", "weekPrior", "sunday", "Midterm Study", ["amath250"]),
    rule("r:study-mon", "weekOf", "monday", "Midterm Study", ["amath250"]),
  ];
}

export function lastTermQuizTuesday(): string {
  const weeks = termQuizWeekMondays();
  const last = weeks[weeks.length - 1] ?? "2026-11-30";
  return addDays(last, 1);
}

function weekOfFromDate(date: string): string {
  return formatWeekOf(startOfWeek(new Date(`${date}T12:00:00`)));
}

function dayKeyFromDate(date: string): DayKey {
  const d = new Date(`${date}T12:00:00`);
  const jsDay = d.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAY_KEYS[idx];
}

function normalizeOptionalTime(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return normalizeClockTime(raw) ?? undefined;
}

function normalizeExcludedDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !DATE_RE.test(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out.sort();
}

export function mergeExcludedDates(
  existing: string[] | undefined,
  extra: string[],
): string[] {
  return normalizeExcludedDates([...(existing ?? []), ...extra]);
}

/** Tuesday of reading week (weekly Tue quizzes skip by default). */
export function readingWeekQuizTuesday(): string {
  return addDays(READING_WEEK_OF, 1);
}

/** Tuesday of AMATH midterm week. */
export function amathMidtermQuizTuesday(): string {
  return addDays(AMATH_MIDTERM_WEEK_OF, 1);
}

/** Personal course seeds live in a module the blank build does not import. */
const dueOwner =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./personal/due-owner") as typeof import("./personal/due-owner"));

export function buildCs234DueEvents(): DueEvent[] {
  if (!dueOwner) return [];
  return dueOwner.buildCs234DueEvents();
}

/** Syllabus seed — official dues + board placement rules. */
export function buildOfficialDueEventSeed(): DueEvent[] {
  if (!dueOwner) return [];
  return dueOwner.buildOfficialDueEventSeed();
}

export function expandEventInstances(
  events: readonly DueEvent[],
): DueEventInstance[] {
  const out: DueEventInstance[] = [];
  for (const event of events) {
    const excluded = new Set(normalizeExcludedDates(event.excludedDates));
    const spanDays = spanLengthDays(event);
    const endDate = normalizeEndDate(event.date, event.endDate);
    const recurrence = event.recurrence;

    if (!recurrence) {
      if (!excluded.has(event.date)) {
        const instEnd = instanceEndFor(event.date, spanDays);
        const base: DueEventInstance = {
          ...event,
          instanceDate: event.date,
          instanceEndDate: instEnd,
          seriesId: event.id,
        };
        if (endDate) base.endDate = endDate;
        else delete base.endDate;
        out.push(base);
      }
      continue;
    }

    if (recurrence.frequency === "custom") {
      const slots = collectCustomSlots(event, recurrence);
      const masterTitle = event.title;
      let ordinal = 0;
      for (const slot of slots) {
        if (excluded.has(slot.date)) continue;
        ordinal += 1;
        const numbered = event.autoNumber
          ? {
              title: `${masterTitle} ${ordinal}`,
              occurrenceNumber: ordinal,
            }
          : {};
        const instEnd = instanceEndFor(slot.date, spanDays);
        const base: DueEventInstance = {
          ...event,
          ...numbered,
          date: slot.date,
          instanceDate: slot.date,
          instanceEndDate: instEnd,
          seriesId: event.id,
        };
        // Per-slot times override the series defaults when provided.
        if (slot.startTime) base.startTime = slot.startTime;
        if (slot.endTime) base.endTime = slot.endTime;
        if (spanDays > 0) base.endDate = instEnd;
        else delete base.endDate;
        out.push(base);
      }
      continue;
    }

    if (recurrence.frequency !== "weekly") continue;

    const interval = Math.max(1, recurrence.interval ?? 1);
    const until = recurrence.until ?? event.date;
    const masterTitle = event.title;
    let cursor = event.date;
    let guard = 0;
    let ordinal = 0;
    while (cursor <= until && guard < 80) {
      guard += 1;
      if (!excluded.has(cursor)) {
        ordinal += 1;
        const numbered = event.autoNumber
          ? {
              title: `${masterTitle} ${ordinal}`,
              occurrenceNumber: ordinal,
            }
          : {};
        const instEnd = instanceEndFor(cursor, spanDays);
        const base: DueEventInstance = {
          ...event,
          ...numbered,
          date: cursor,
          instanceDate: cursor,
          instanceEndDate: instEnd,
          seriesId: event.id,
        };
        if (spanDays > 0) base.endDate = instEnd;
        else delete base.endDate;
        out.push(base);
      }
      cursor = addDays(cursor, 7 * interval);
    }
  }
  return out.sort((a, b) =>
    a.instanceDate === b.instanceDate
      ? a.title.localeCompare(b.title)
      : a.instanceDate.localeCompare(b.instanceDate),
  );
}

/** Master date plus custom extras, sorted chronologically (stable within a day). */
function collectCustomSlots(
  event: DueEvent,
  recurrence: CustomRecurrence,
): CustomOccurrence[] {
  const masterStart = normalizeOptionalTime(event.startTime);
  const masterEnd = normalizeOptionalTime(event.endTime);
  const master: CustomOccurrence = {
    date: event.date,
    ...(masterStart ? { startTime: masterStart } : {}),
    ...(masterEnd ? { endTime: masterEnd } : {}),
  };
  const extras = normalizeCustomOccurrences(recurrence.occurrences).filter(
    (o) => o.date !== event.date,
  );
  return [master, ...extras].sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.date.localeCompare(b.date),
  );
}

function normalizeCustomOccurrences(raw: unknown): CustomOccurrence[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomOccurrence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as CustomOccurrence;
    if (typeof o.date !== "string" || !DATE_RE.test(o.date)) continue;
    // One slot per date; later entries win.
    const startTime = normalizeOptionalTime(o.startTime);
    const endTime = normalizeOptionalTime(o.endTime);
    const key = o.date;
    if (seen.has(key)) {
      const idx = out.findIndex((x) => x.date === key);
      if (idx >= 0) {
        out[idx] = {
          date: o.date,
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
        };
      }
      continue;
    }
    seen.add(key);
    out.push({
      date: o.date,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeEstimateMinutes(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return undefined;
  }
  return Math.round(raw);
}

function normalizeRule(raw: unknown): BoardPlacementRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as BoardPlacementRule;
  if (
    typeof r.id !== "string" ||
    (r.relative !== "weekOf" && r.relative !== "weekPrior") ||
    typeof r.day !== "string" ||
    !DAY_KEYS.includes(r.day as DayKey) ||
    typeof r.text !== "string"
  ) {
    return null;
  }
  const estimateMinutes = normalizeEstimateMinutes(r.estimateMinutes);
  const startTime = normalizeOptionalTime(r.startTime);
  const endTime = normalizeOptionalTime(r.endTime);
  return {
    id: r.id,
    relative: r.relative,
    day: r.day as DayKey,
    text: r.text,
    tags: normalizeTaskTags(r.tags ?? []),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(estimateMinutes ? { estimateMinutes } : {}),
  };
}

function normalizeRecurrence(raw: unknown): EventRecurrence | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as EventRecurrence;
  if (r.frequency === "weekly") {
    return {
      frequency: "weekly",
      interval: typeof r.interval === "number" ? r.interval : 1,
      until: typeof r.until === "string" ? r.until : undefined,
    };
  }
  if (r.frequency === "custom") {
    const occurrences = normalizeCustomOccurrences(
      (r as CustomRecurrence).occurrences,
    );
    return {
      frequency: "custom",
      occurrences,
    };
  }
  return undefined;
}

function normalizeDueEvent(value: unknown): DueEvent | null {
  if (!value || typeof value !== "object") return null;
  const v = value as DueEvent;
  if (
    typeof v.id !== "string" ||
    typeof v.title !== "string" ||
    typeof v.detail !== "string" ||
    typeof v.date !== "string" ||
    typeof v.course !== "string"
  ) {
    return null;
  }
  const rules = Array.isArray(v.rules)
    ? v.rules.map(normalizeRule).filter((r): r is BoardPlacementRule => !!r)
    : undefined;
  const recurrence = normalizeRecurrence(v.recurrence);
  const excludedDates = normalizeExcludedDates(v.excludedDates);
  const endDate = normalizeEndDate(v.date, v.endDate);
  const startTime = normalizeOptionalTime(v.startTime);
  const endTime = normalizeOptionalTime(v.endTime);
  return {
    id: v.id,
    title: v.title,
    detail: v.detail,
    date: v.date,
    course: v.course as DueCourse,
    ...(endDate ? { endDate } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(v.appearOnBoard ? { appearOnBoard: true } : {}),
    ...(rules ? { rules } : {}),
    ...(recurrence !== undefined ? { recurrence } : {}),
    ...(excludedDates.length > 0 ? { excludedDates } : {}),
    ...(v.autoNumber ? { autoNumber: true } : {}),
  };
}

export function sortEvents(events: DueEvent[]): DueEvent[] {
  return [...events].sort((a, b) =>
    a.date === b.date
      ? a.title.localeCompare(b.title)
      : a.date.localeCompare(b.date),
  );
}

export function attachDefaultRules(event: DueEvent): DueEvent {
  if (event.rules && event.rules.length > 0) return event;

  if (event.id === "math-237:quiz-series") {
    return { ...event, rules: tueQuizRules("math237") };
  }
  if (event.id === "amath-250:quiz-series") {
    return { ...event, rules: tueQuizRules("amath250") };
  }
  if (event.id.startsWith("math-235:quiz:")) {
    return { ...event, rules: math235RulesForDate(event.date) };
  }
  if (event.id.startsWith("amath-250:midterm:")) {
    return { ...event, rules: midtermRules() };
  }
  return event;
}

function migrateStore(store: DueEventsStore): DueEventsStore {
  if (!dueOwner) return store;
  return dueOwner.migrateOwnerDueStore(store);
}

let memoryStore: DueEventsStore | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeDueEvents(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function readStoreFromDisk(): Promise<DueEventsStore> {
  const raw = await readStorage(DUE_EVENTS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DueEventsStore;
      if (parsed && Array.isArray(parsed.events)) {
        const events = parsed.events
          .map(normalizeDueEvent)
          .filter((e): e is DueEvent => !!e);
        return migrateStore({
          events,
          seedVersion: parsed.seedVersion,
          boxDone:
            parsed.boxDone && typeof parsed.boxDone === "object"
              ? parsed.boxDone
              : {},
        });
      }
    } catch {
      /* seed below */
    }
  }
  return {
    events: buildOfficialDueEventSeed(),
    seedVersion: DUE_EVENTS_SEED_VERSION,
    boxDone: {},
  };
}

async function persist(): Promise<void> {
  if (!memoryStore) return;
  await writeStorage(DUE_EVENTS_STORAGE_KEY, JSON.stringify(memoryStore));
}

export async function initDueEventsStore(): Promise<DueEventsStore> {
  if (typeof window === "undefined") return emptyStore();
  if (memoryStore) return memoryStore;

  memoryStore = await readStoreFromDisk();
  await persist();
  return memoryStore;
}

export async function reloadDueEventsStoreFromDisk(): Promise<DueEventsStore> {
  memoryStore = null;
  return initDueEventsStore();
}

export function peekDueEvents(): DueEvent[] {
  return memoryStore?.events ?? [];
}

export function peekBoxDone(): Record<string, boolean> {
  return memoryStore?.boxDone ?? {};
}

export async function listDueEvents(): Promise<DueEvent[]> {
  if (typeof window === "undefined") return [];
  if (!memoryStore) await initDueEventsStore();
  return sortEvents([...(memoryStore?.events ?? [])]);
}

export function eventsForDate(
  events: readonly DueEvent[],
  date: string,
): DueEventInstance[] {
  return expandEventInstances(events)
    .filter((e) => eventCoversDate(e, date))
    .sort((a, b) => {
      if (a.instanceDate !== b.instanceDate) {
        return a.instanceDate.localeCompare(b.instanceDate);
      }
      return a.title.localeCompare(b.title);
    });
}

export function eventsForWeek(
  events: readonly DueEvent[],
  weekOf: string,
): DueEventInstance[] {
  const end = addDays(weekOf, 6);
  return expandEventInstances(events)
    .filter((e) => e.instanceDate <= end && e.instanceEndDate >= weekOf)
    .sort((a, b) =>
      a.instanceDate === b.instanceDate
        ? a.title.localeCompare(b.title)
        : a.instanceDate.localeCompare(b.instanceDate),
    );
}

/**
 * Layout multi-day events as continuous bars across Mon–Sun week rows.
 * Single-day instances are omitted (rendered as day-cell dots instead).
 */
export function layoutMonthSpanSegments(
  events: readonly DueEvent[],
  cells: readonly { date: string }[],
): MonthSpanSegment[] {
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7).map((c) => c.date));
  }

  const multi = expandEventInstances(events).filter(isMultiDayInstance);
  const segments: MonthSpanSegment[] = [];

  weeks.forEach((weekDates, weekIndex) => {
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    if (!weekStart || !weekEnd) return;

    type Raw = {
      seriesId: string;
      title: string;
      course: DueCourse;
      instanceDate: string;
      instanceEndDate: string;
      startCol: number;
      endCol: number;
      continuesBefore: boolean;
      continuesAfter: boolean;
    };

    const raws: Raw[] = [];
    for (const inst of multi) {
      if (inst.instanceEndDate < weekStart || inst.instanceDate > weekEnd) {
        continue;
      }
      const startCol = Math.max(
        0,
        weekDates.findIndex((d) => d >= inst.instanceDate),
      );
      let endCol = -1;
      for (let c = weekDates.length - 1; c >= 0; c--) {
        if (weekDates[c]! <= inst.instanceEndDate) {
          endCol = c;
          break;
        }
      }
      if (endCol < startCol) continue;
      raws.push({
        seriesId: inst.seriesId,
        title: inst.title,
        course: inst.course,
        instanceDate: inst.instanceDate,
        instanceEndDate: inst.instanceEndDate,
        startCol,
        endCol,
        continuesBefore: inst.instanceDate < weekStart,
        continuesAfter: inst.instanceEndDate > weekEnd,
      });
    }

    raws.sort((a, b) =>
      a.startCol !== b.startCol
        ? a.startCol - b.startCol
        : b.endCol - a.endCol || a.title.localeCompare(b.title),
    );

    const laneEnds: number[] = [];
    for (const raw of raws) {
      let lane = laneEnds.findIndex((end) => end < raw.startCol);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(raw.endCol);
      } else {
        laneEnds[lane] = raw.endCol;
      }
      segments.push({ ...raw, weekIndex, lane });
    }
  });

  return segments;
}

function dateForDayInWeek(weekOf: string, day: DayKey): string {
  const idx = DAY_KEYS.indexOf(day);
  return addDays(weekOf, idx);
}

/**
 * Board-rule clock times are opt-in per rule. Event start/end apply only to
 * the appearOnBoard box — not Study / prep rules linked to the same event.
 */
function boxClockTimes(
  rule: BoardPlacementRule,
): { startTime?: string; endTime?: string } {
  const startTime = normalizeOptionalTime(rule.startTime);
  const endTime = normalizeOptionalTime(rule.endTime);
  return {
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

/**
 * Board overlays from event placement rules for a Monday-start board week.
 * weekPrior rules on next week's events land on this week's matching day.
 * Events with appearOnBoard also place a titled box on the occurrence day.
 */
export function overlayBoxesForWeek(
  events: readonly DueEvent[],
  weekOf: string,
  boxDone: Record<string, boolean> = peekBoxDone(),
): Record<DayKey, EventBoardBox[]> {
  const result = Object.fromEntries(
    DAY_KEYS.map((k) => [k, [] as EventBoardBox[]]),
  ) as Record<DayKey, EventBoardBox[]>;

  const instances = expandEventInstances(events);
  const nextWeek = shiftWeek(weekOf, 1);

  for (const inst of instances) {
    const eventWeek = weekOfFromDate(inst.instanceDate);
    const rules = inst.rules ?? [];
    for (const r of rules) {
      let targetWeek: string | null = null;
      if (r.relative === "weekOf" && eventWeek === weekOf) {
        targetWeek = weekOf;
      } else if (r.relative === "weekPrior" && eventWeek === nextWeek) {
        targetWeek = weekOf;
      }
      if (!targetWeek) continue;

      const boxId = `evbox:${inst.seriesId}:${r.id}:${weekOf}`;
      const estimateMinutes = normalizeEstimateMinutes(r.estimateMinutes);
      const clock = boxClockTimes(r);
      result[r.day].push({
        id: boxId,
        text: r.text,
        tags: normalizeTaskTags(r.tags),
        done: !!boxDone[boxId],
        sourceEventId: inst.seriesId,
        sourceRuleId: r.id,
        instanceDate: inst.instanceDate,
        ...clock,
        ...(estimateMinutes ? { estimateMinutes } : {}),
      });
    }

    if (inst.appearOnBoard && eventWeek === weekOf) {
      const day = dayKeyFromDate(inst.instanceDate);
      const boxId = `evbox:${inst.seriesId}:appear:${inst.instanceDate}`;
      const courseTag = tagForDueCourse(inst.course);
      result[day].push({
        id: boxId,
        text: inst.title,
        tags: courseTag ? normalizeTaskTags([courseTag]) : [],
        done: !!boxDone[boxId],
        sourceEventId: inst.seriesId,
        sourceRuleId: "appear",
        instanceDate: inst.instanceDate,
        ...(inst.startTime ? { startTime: inst.startTime } : {}),
        ...(inst.endTime ? { endTime: inst.endTime } : {}),
      });
    }
  }

  for (const day of DAY_KEYS) {
    result[day].sort((a, b) => a.text.localeCompare(b.text));
  }
  return result;
}

export async function toggleEventBox(boxId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!memoryStore) await initDueEventsStore();
  if (!memoryStore) return false;
  const next = !memoryStore.boxDone?.[boxId];
  memoryStore.boxDone = { ...(memoryStore.boxDone ?? {}), [boxId]: next };
  await persist();
  notify();
  return next;
}

export async function saveDueEvent(
  event: Omit<DueEvent, "id"> & { id?: string },
): Promise<DueEvent> {
  if (typeof window === "undefined") {
    return { ...event, id: event.id ?? createId() };
  }
  if (!memoryStore) await initDueEventsStore();
  if (!memoryStore) throw new Error("Due events store unavailable");

  const rules = (event.rules ?? [])
    .map(normalizeRule)
    .filter((r): r is BoardPlacementRule => !!r);
  const recurrence = normalizeRecurrence(event.recurrence) ?? null;
  const excludedDates = normalizeExcludedDates(event.excludedDates);
  const endDate = normalizeEndDate(event.date, event.endDate);
  const startTime = normalizeOptionalTime(event.startTime);
  const endTime = normalizeOptionalTime(event.endTime);

  const next: DueEvent = {
    id: event.id ?? createId(),
    title: event.title.trim() || "Untitled",
    detail: event.detail.trim(),
    date: event.date,
    course: event.course,
    rules,
    recurrence: recurrence || null,
    ...(endDate ? { endDate } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(event.appearOnBoard ? { appearOnBoard: true } : {}),
    ...(excludedDates.length > 0 ? { excludedDates } : {}),
    ...(event.autoNumber ? { autoNumber: true } : {}),
  };

  const idx = memoryStore.events.findIndex((e) => e.id === next.id);
  if (idx >= 0) {
    memoryStore.events[idx] = next;
  } else {
    memoryStore.events.push(next);
  }
  await persist();
  notify();
  return next;
}

export async function excludeEventOccurrence(
  id: string,
  date: string,
): Promise<DueEvent | null> {
  if (typeof window === "undefined") return null;
  if (!memoryStore) await initDueEventsStore();
  if (!memoryStore) return null;
  const idx = memoryStore.events.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const event = memoryStore.events[idx];

  // Custom extras are dropped from the list; master / weekly use excludedDates.
  if (
    event.recurrence?.frequency === "custom" &&
    date !== event.date &&
    event.recurrence.occurrences.some((o) => o.date === date)
  ) {
    const occurrences = normalizeCustomOccurrences(
      event.recurrence.occurrences,
    ).filter((o) => o.date !== date);
    const next: DueEvent = {
      ...event,
      recurrence: { frequency: "custom", occurrences },
    };
    memoryStore.events[idx] = next;
    await persist();
    notify();
    return next;
  }

  const excludedDates = mergeExcludedDates(event.excludedDates, [date]);
  const next: DueEvent = { ...event, excludedDates };
  memoryStore.events[idx] = next;
  await persist();
  notify();
  return next;
}

export async function restoreEventOccurrence(
  id: string,
  date: string,
): Promise<DueEvent | null> {
  if (typeof window === "undefined") return null;
  if (!memoryStore) await initDueEventsStore();
  if (!memoryStore) return null;
  const idx = memoryStore.events.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const event = memoryStore.events[idx];
  const excludedDates = normalizeExcludedDates(event.excludedDates).filter(
    (d) => d !== date,
  );
  const next: DueEvent = { ...event };
  if (excludedDates.length > 0) {
    next.excludedDates = excludedDates;
  } else {
    delete next.excludedDates;
  }
  memoryStore.events[idx] = next;
  await persist();
  notify();
  return next;
}

export async function deleteDueEvent(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!memoryStore) await initDueEventsStore();
  if (!memoryStore) return;
  memoryStore.events = memoryStore.events.filter((e) => e.id !== id);
  await persist();
  notify();
}

export function findEventById(
  events: readonly DueEvent[],
  id: string,
): DueEvent | undefined {
  return events.find((e) => e.id === id);
}

export function calendarHrefForEvent(
  eventId: string,
  instanceDate: string,
): string {
  const params = new URLSearchParams({
    event: eventId,
    date: instanceDate,
  });
  return `/calendar?${params.toString()}`;
}

/** @deprecated helper kept for call sites that need a concrete day under a rule */
export function boardBoxDate(weekOf: string, day: DayKey): string {
  return dateForDayInWeek(weekOf, day);
}

export function monthKeyFromDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12, 0, 0);
  return monthKeyFromDate(d);
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1, 12, 0, 0);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Mon-start calendar cells for a YYYY-MM month (includes leading/trailing days). */
export function monthGridDays(monthKey: string): {
  date: string;
  inMonth: boolean;
}[] {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1, 12, 0, 0);
  const gridStart = startOfWeek(first);
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const date = formatWeekOf(d);
    cells.push({
      date,
      inMonth: d.getMonth() === m - 1,
    });
  }
  const lastWeek = cells.slice(35);
  if (lastWeek.every((c) => !c.inMonth)) {
    return cells.slice(0, 35);
  }
  return cells;
}

export function todayDateString(): string {
  return formatWeekOf(new Date());
}
