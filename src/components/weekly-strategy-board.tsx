"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BoxTagPicker, TaskTagPrefixes } from "@/components/box-tag-picker";
import { BoxContextMenu, DismissBoxMenu } from "@/components/box-context-menu";
import {
  DropIndicator,
  ReorderRow,
  reorderIds,
} from "@/components/reorder-list";
import {
  DayTimingSummary,
  TaskEstimateInput,
} from "@/components/day-timing";
import { TaskRichText } from "@/components/task-rich-text";
import {
  BoxTag,
  compareBoardBoxes,
  migrateTaskTags,
  normalizeTaskTags,
  taskBodyText,
} from "@/lib/box-tags";
import { handleTagChipKey } from "@/lib/tag-chip-key";
import { DATA_SYNC_EVENT } from "@/lib/tag-data-sync";
import type { TagChipUndoState } from "@/lib/tag-chip-key";
import { handleTimeChipKey } from "@/lib/time-chip-key";
import type { TimeChipUndoState } from "@/lib/time-chip-key";
import { applyLinkAtSelection } from "@/lib/task-links";
import {
  detachBoardTime,
  formatTimeRange,
  parseClockTime,
  type BoardTimeRange,
} from "@/lib/task-time";
import {
  DAYS,
  CarriedBoxRef,
  DayKey,
  DayMeta,
  TaskItem,
  WeekPlan,
  cachePlan,
  createId,
  cs234EstimateKey,
  emptyDayMeta,
  formatWeekLabel,
  formatWeekOf,
  initPlansStore,
  loadPlan,
  peekPlan,
  savePlan,
  shiftWeek,
  startOfWeek,
} from "@/lib/week-plan";
import {
  buildWeekPlan,
  isLegacyAcademicDayTask,
} from "@/lib/strategy-data";
import {
  DueEvent,
  DueEventInstance,
  EventBoardBox,
  boardBoxDate,
  calendarHrefForEvent,
  dueCourseColor,
  eventsForWeek,
  initDueEventsStore,
  listDueEvents,
  overlayBoxesForWeek,
  peekBoxDone,
  peekDueEvents,
  saveDueEvent,
  subscribeDueEvents,
  todayDateString,
  toggleEventBox,
} from "@/lib/due-events";
import {
  RecurringTodo,
  RecurringTodoBox,
  initRecurringTodosStore,
  listRecurringTodos,
  overlayRecurringTodosForWeek,
  peekRecurringTodos,
  saveRecurringTodo,
  subscribeRecurringTodos,
  toggleRecurringTodo,
} from "@/lib/recurring-todos";
import {
  Reminder,
  ReminderBoardBox,
  initRemindersStore,
  listReminders,
  normalizePinnedReminders,
  peekReminders,
  reminderBoxesForDay,
  reminderEstimateKey,
  subscribeReminders,
  toggleReminder,
  updateReminder,
} from "@/lib/reminders";
import { WeeklyRoutinesPanel } from "@/components/weekly-routines-panel";
import { isBlankProfile } from "@/lib/app-profile";
import {
  CS234_WEEKS,
  Cs234ChecklistItem,
  csWeekNumberForBoardWeek,
  dueNoteForWeek,
  initCs234ChecklistStore,
  isCsItemOptionalInWeek,
  isLegacyCs234DayTask,
  listCs234Items,
  peekCs234Items,
  lectureContentForWeek,
  problemSolvingForWeek,
  subscribeCs234,
  toggleCs234Item,
} from "@/lib/cs234-checklist";

const TERM_BOARD_START = CS234_WEEKS[0]?.boardWeekOf ?? "2026-09-07";

function csBoardTags(
  item: Cs234ChecklistItem,
  csWeek: number | null,
): BoxTag[] {
  if (csWeek != null && isCsItemOptionalInWeek(item, csWeek)) {
    return ["cs234", "optional"];
  }
  return ["cs234"];
}

type LoadState = "loading" | "ready" | "error";

function emptyDraftTags(): Record<DayKey, BoxTag[]> {
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

function emptyDraftTimes(): Record<DayKey, BoardTimeRange | null> {
  return {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  };
}

function timeFromClock(
  startTime?: string,
  endTime?: string,
): BoardTimeRange | null {
  if (!startTime) return null;
  return endTime ? { startTime, endTime } : { startTime };
}

function clockFields(time: BoardTimeRange): {
  startTime: string;
  endTime?: string;
} {
  return time.endTime
    ? { startTime: time.startTime, endTime: time.endTime }
    : { startTime: time.startTime };
}

/** Prefer a range still typed in the text; otherwise keep the space-converted chip. */
function resolveBoxTime(
  text: string,
  chip: BoardTimeRange | null,
): { text: string; time: BoardTimeRange | null } {
  const detached = detachBoardTime(text);
  if (detached.time) return { text: detached.text, time: detached.time };
  return { text: text.trim(), time: chip };
}

function EditingTimeChip({
  time,
  onEdit,
}: {
  time: BoardTimeRange | null;
  onEdit: () => void;
}) {
  if (!time) return null;
  const label = formatTimeRange(time.startTime, time.endTime);
  if (!label) return null;
  return (
    <button
      type="button"
      title="Edit time"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onEdit}
      className="shrink-0 pt-1 text-xs text-muted-foreground hover:text-foreground"
    >
      ({label})
    </button>
  );
}

function isMealRelatedTask(text: string): boolean {
  return /\b(meals?|dinner|brunch|lunch)\b/i.test(text);
}

/** Matches day-task Remove width so overlay `time` controls share one column. */
function RemoveSlotSpacer() {
  return (
    <span className="invisible text-xs select-none" aria-hidden>
      Remove
    </span>
  );
}

type OverlayRef = { text: string; tags: BoxTag[] };

function isDuplicateOfOverlay(task: TaskItem, overlays: OverlayRef[]): boolean {
  const body = taskBodyText(task).trim().toLowerCase();
  if (!body) return false;
  const taskTags = new Set(
    normalizeTaskTags(task.tags).filter((t) => t !== "optional"),
  );
  return overlays.some((o) => {
    if (o.text.trim().toLowerCase() !== body) return false;
    const oTags = normalizeTaskTags(o.tags).filter((t) => t !== "optional");
    if (oTags.length === 0 && taskTags.size === 0) return true;
    return oTags.some((t) => taskTags.has(t));
  });
}

type CarryPointer = {
  sourceWeekOf: string;
  sourceDay: DayKey;
};

type DayBoardRow =
  | { kind: "event"; item: EventBoardBox; index: number; carry?: CarryPointer }
  | { kind: "cs"; item: Cs234ChecklistItem; index: number; carry?: CarryPointer }
  | {
      kind: "routine";
      item: RecurringTodoBox;
      index: number;
      carry?: CarryPointer;
    }
  | {
      kind: "reminder";
      item: ReminderBoardBox;
      index: number;
      carry?: CarryPointer;
    }
  | { kind: "task"; item: TaskItem; index: number; carry?: CarryPointer };

function boardRowId(row: DayBoardRow): string {
  switch (row.kind) {
    case "event":
      return row.item.id;
    case "cs":
      return cs234EstimateKey(row.item.id);
    case "routine":
      return row.item.id;
    case "reminder":
      return row.item.id;
    case "task":
      return row.item.id;
  }
}

function boardRowLabel(row: DayBoardRow): string {
  switch (row.kind) {
    case "event":
      return row.item.text;
    case "cs":
      return row.item.label;
    case "routine":
      return row.item.text;
    case "reminder":
      return row.item.text;
    case "task":
      return taskBodyText(row.item);
  }
}

function boxActionState(row: DayBoardRow): {
  canTime: boolean;
  canTags: boolean;
  time: BoardTimeRange | null;
  tags: BoxTag[];
  scopeNote?: string;
} {
  if (row.kind === "task") {
    return {
      canTime: true,
      canTags: true,
      time: timeFromClock(row.item.startTime, row.item.endTime),
      tags: normalizeTaskTags(row.item.tags),
    };
  }
  if (row.kind === "routine") {
    return {
      canTime: true,
      canTags: true,
      time: timeFromClock(row.item.startTime, row.item.endTime),
      tags: normalizeTaskTags(row.item.tags),
    };
  }
  if (row.kind === "reminder") {
    return {
      canTime: false,
      canTags: true,
      time: null,
      tags: normalizeTaskTags(row.item.tags),
    };
  }
  if (row.kind === "event") {
    return {
      canTime: true,
      canTags: row.item.sourceRuleId !== "appear",
      time: timeFromClock(row.item.startTime, row.item.endTime),
      tags: normalizeTaskTags(row.item.tags),
      scopeNote: "Saves on the calendar box for every week.",
    };
  }
  return { canTime: false, canTags: false, time: null, tags: [] };
}

function rowSortKey(
  row: DayBoardRow,
  csWeek: number | null = null,
): {
  done: boolean;
  tags: BoxTag[];
  text: string;
  index: number;
  startMinutes: number | null;
} {
  switch (row.kind) {
    case "event":
      return {
        done: row.item.done,
        tags: row.item.tags,
        text: row.item.text,
        index: row.index,
        startMinutes: row.item.startTime
          ? parseClockTime(row.item.startTime)
          : null,
      };
    case "cs":
      return {
        done: row.item.done,
        tags: csBoardTags(row.item, csWeek),
        text: row.item.label,
        index: row.index,
        startMinutes: null,
      };
    case "routine":
      return {
        done: row.item.done,
        tags: row.item.tags,
        text: row.item.text,
        index: row.index,
        startMinutes: row.item.startTime
          ? parseClockTime(row.item.startTime)
          : null,
      };
    case "reminder":
      return {
        done: row.item.done,
        tags: normalizeTaskTags(row.item.tags),
        text: row.item.text,
        index: row.index,
        startMinutes: null,
      };
    case "task":
      return {
        done: row.item.done,
        tags: normalizeTaskTags(row.item.tags),
        text: taskBodyText(row.item),
        index: row.index,
        startMinutes: row.item.startTime
          ? parseClockTime(row.item.startTime)
          : null,
      };
  }
}

function formatMissedDateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function dayKeyForDate(date: string): DayKey {
  const jsDay = new Date(`${date}T12:00:00`).getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAYS[idx]!.key;
}

function carryFromNote(row: DayBoardRow): ReactNode {
  if (!row.carry) return null;
  const date = boardBoxDate(row.carry.sourceWeekOf, row.carry.sourceDay);
  return (
    <span className="ml-1.5 text-xs text-muted-foreground">
      (from {formatMissedDateLabel(date)})
    </span>
  );
}

const CARRY_KINDS = new Set<CarriedBoxRef["kind"]>([
  "event",
  "cs",
  "routine",
  "task",
]);

function normalizeCarriedBoxes(
  raw: WeekPlan["carriedBoxes"],
): WeekPlan["carriedBoxes"] {
  if (!raw || typeof raw !== "object") return undefined;
  const next: NonNullable<WeekPlan["carriedBoxes"]> = {};
  for (const day of DAYS) {
    const list = raw[day.key];
    if (!Array.isArray(list)) continue;
    const refs: CarriedBoxRef[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const ref = item as CarriedBoxRef;
      if (!CARRY_KINDS.has(ref.kind)) continue;
      if (typeof ref.sourceWeekOf !== "string" || !ref.sourceWeekOf) continue;
      if (!DAYS.some((d) => d.key === ref.sourceDay)) continue;
      if (typeof ref.id !== "string" || !ref.id) continue;
      refs.push({
        kind: ref.kind,
        sourceWeekOf: ref.sourceWeekOf,
        sourceDay: ref.sourceDay,
        id: ref.id,
      });
    }
    if (refs.length > 0) next[day.key] = refs;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function isOptionalBoardRow(
  row: DayBoardRow,
  csWeek: number | null = null,
): boolean {
  return rowSortKey(row, csWeek).tags.includes("optional");
}

/** Keep remembered ids; insert new boxes where default sort places them. */
function applyDayBoxOrder(
  rows: DayBoardRow[],
  order: readonly string[] | undefined,
): DayBoardRow[] {
  if (!order?.length) return rows;
  const byId = new Map(rows.map((row) => [boardRowId(row), row]));
  const result: DayBoardRow[] = [];
  const used = new Set<string>();
  for (const id of order) {
    const row = byId.get(id);
    if (!row || used.has(id)) continue;
    result.push(row);
    used.add(id);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = boardRowId(row);
    if (used.has(id)) continue;
    let insertAt = result.length;
    for (let j = i - 1; j >= 0; j--) {
      const prevId = boardRowId(rows[j]);
      const pos = result.findIndex((r) => boardRowId(r) === prevId);
      if (pos >= 0) {
        insertAt = pos + 1;
        break;
      }
      if (j === 0) insertAt = 0;
    }
    if (i === 0) insertAt = 0;
    result.splice(insertAt, 0, row);
    used.add(id);
  }
  return result;
}

function normalizeDayBoxOrder(
  raw: WeekPlan["dayBoxOrder"],
): WeekPlan["dayBoxOrder"] {
  if (!raw || typeof raw !== "object") return undefined;
  const next: Partial<Record<DayKey, string[]>> = {};
  for (const day of DAYS) {
    const list = raw[day.key];
    if (!Array.isArray(list)) continue;
    const ids = list.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    if (ids.length > 0) next[day.key] = ids;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function handleTaskLinkKey(
  e: KeyboardEvent<HTMLInputElement>,
  value: string,
  onChange: (next: string) => void,
  onBeforePrompt?: () => void,
  onAfterPrompt?: () => void,
): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return false;
  e.preventDefault();
  const input = e.currentTarget;
  onBeforePrompt?.();
  let applied: ReturnType<typeof applyLinkAtSelection> = null;
  try {
    applied = applyLinkAtSelection(
      value,
      input.selectionStart ?? 0,
      input.selectionEnd ?? 0,
    );
  } finally {
    onAfterPrompt?.();
  }
  if (!applied) return true;
  onChange(applied.value);
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(applied.selectionStart, applied.selectionEnd);
  });
  return true;
}

type BoardRowLiProps = {
  rowId: string;
  label: string;
  isMoving: boolean;
  dragTaskId: string | null;
  dragHeight: number;
  dropIndicator: DropIndicator | null;
  orderedIds: string[];
  setDragTaskId: (id: string | null) => void;
  setDragHeight: (height: number) => void;
  setDropIndicator: Dispatch<SetStateAction<DropIndicator | null>>;
  onReorder: (fromId: string, toId: string, edge: "before" | "after") => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLLIElement>) => void;
  children: ReactNode;
};

function BoardRowLi({
  rowId,
  label,
  isMoving,
  dragTaskId,
  dragHeight,
  dropIndicator,
  orderedIds,
  setDragTaskId,
  setDragHeight,
  setDropIndicator,
  onReorder,
  onContextMenu,
  children,
}: BoardRowLiProps) {
  return (
    <ReorderRow
      rowId={rowId}
      label={label}
      isMoving={isMoving}
      dragId={dragTaskId}
      dragHeight={dragHeight}
      dropIndicator={dropIndicator}
      orderedIds={orderedIds}
      setDragId={setDragTaskId}
      setDragHeight={setDragHeight}
      setDropIndicator={setDropIndicator}
      onReorder={onReorder}
      onContextMenu={onContextMenu}
      className="rounded-lg px-1 py-0.5 group"
      draggingClassName="rounded-lg border-2 border-ink/70 bg-transparent px-1 py-0.5 opacity-35 group"
    >
      <div className="flex min-w-0 items-start gap-2">{children}</div>
    </ReorderRow>
  );
}

function normalizeOverlayEstimates(
  raw: WeekPlan["overlayEstimates"],
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const next: Record<string, number> = {};
  for (const [id, mins] of Object.entries(raw)) {
    if (typeof mins === "number" && Number.isFinite(mins) && mins > 0) {
      next[id] = Math.round(mins);
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizePlan(plan: WeekPlan): WeekPlan {
  const days = { ...plan.days };
  for (const day of DAYS) {
    days[day.key] = (days[day.key] ?? [])
      .filter((t) => !isMealRelatedTask(t.text))
      .map(migrateTaskTags);
  }
  const baseMeta = plan.dayMeta ?? emptyDayMeta();
  const dayMeta = { ...emptyDayMeta(), ...baseMeta } as Record<DayKey, DayMeta>;
  for (const day of DAYS) {
    dayMeta[day.key] = {
      title: "",
      fixedStart: dayMeta[day.key]?.fixedStart,
      breakMinutes: dayMeta[day.key]?.breakMinutes,
    };
  }
  const overlayEstimates = normalizeOverlayEstimates(plan.overlayEstimates);
  const dayBoxOrder = normalizeDayBoxOrder(plan.dayBoxOrder);
  const carriedBoxes = normalizeCarriedBoxes(plan.carriedBoxes);
  const pinnedReminders = normalizePinnedReminders(plan.pinnedReminders);
  // Drop legacy week-type fields from older saved plans.
  const {
    weekType: _weekType,
    jobHoursHint: _jobHoursHint,
    ...rest
  } = plan as WeekPlan & {
    weekType?: string;
    jobHoursHint?: string;
  };
  return {
    ...rest,
    tags: rest.tags ?? [],
    flexNotes: rest.flexNotes ?? [],
    focus:
      rest.focus ??
      (process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
        ? ""
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("@/lib/personal/labels").personalFocusFallback()),
    days,
    dayMeta,
    overlayEstimates,
    dayBoxOrder,
    carriedBoxes,
    pinnedReminders,
  };
}

export function WeeklyStrategyBoard() {
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [dueEvents, setDueEvents] = useState<DueEvent[]>([]);
  const [boxDone, setBoxDone] = useState<Record<string, boolean>>({});
  const [recurringTodos, setRecurringTodos] = useState<RecurringTodo[]>([]);
  const [routineTick, setRoutineTick] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [cs234Items, setCs234Items] = useState<Cs234ChecklistItem[]>([]);
  /** Bumped when a past-week plan is edited from Missed so that list re-reads storage. */
  const [planRevision, setPlanRevision] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [drafts, setDrafts] = useState<Record<DayKey, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  });
  const [draftTags, setDraftTags] =
    useState<Record<DayKey, BoxTag[]>>(emptyDraftTags);
  const [draftTimes, setDraftTimes] =
    useState<Record<DayKey, BoardTimeRange | null>>(emptyDraftTimes);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingTask, setEditingTask] = useState<{
    day: DayKey;
    id: string;
    value: string;
    tags: BoxTag[];
    source: "task" | "routine";
    todoId?: string;
    sourceWeekOf?: string;
    sourceDay?: DayKey;
    time: BoardTimeRange | null;
  } | null>(null);
  const editingTaskRef = useRef(editingTask);
  editingTaskRef.current = editingTask;
  const suppressEditBlurRef = useRef(false);
  const tagChipUndoRef = useRef<TagChipUndoState | null>(null);
  const timeChipUndoRef = useRef<TimeChipUndoState | null>(null);
  const [moveDay, setMoveDay] = useState<DayKey | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState(0);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );
  const [boxMenu, setBoxMenu] = useState<{
    x: number;
    y: number;
    viewWeek: string;
    viewDay: DayKey;
    rowId: string;
  } | null>(null);
  const closeBoxMenu = useCallback(() => setBoxMenu(null), []);

  const weekDues = useMemo(
    () => (plan ? eventsForWeek(dueEvents, plan.weekOf) : []),
    [dueEvents, plan],
  );

  const [thisWeekOpen, setThisWeekOpen] = useState(false);
  const [missedOpen, setMissedOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const currentWeek = formatWeekOf(startOfWeek());

        await initPlansStore();
        if (cancelled) return;

        await initDueEventsStore();
        if (cancelled) return;
        const dues = await listDueEvents();
        if (cancelled) return;
        setDueEvents(dues);
        setBoxDone(peekBoxDone());

        await initRecurringTodosStore();
        if (cancelled) return;
        const routines = await listRecurringTodos();
        if (cancelled) return;
        setRecurringTodos(routines);

        await initRemindersStore();
        if (cancelled) return;
        setReminders(await listReminders());

        if (!isBlankProfile()) {
          await initCs234ChecklistStore();
          if (cancelled) return;
          const csItems = await listCs234Items();
          if (cancelled) return;
          setCs234Items(csItems);
        }

        const stored = await loadPlan(currentWeek);
        if (cancelled) return;

        if (stored) {
          setPlan(normalizePlan(stored));
        } else {
          setPlan(normalizePlan(buildWeekPlan(currentWeek)));
        }
        setLoadState("ready");
      } catch {
        if (cancelled) return;
        setPlan(normalizePlan(buildWeekPlan()));
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeCs234(() => {
      setCs234Items(peekCs234Items());
    });
  }, []);

  useEffect(() => {
    return subscribeDueEvents(() => {
      setDueEvents(peekDueEvents());
      setBoxDone(peekBoxDone());
    });
  }, []);

  useEffect(() => {
    return subscribeRecurringTodos(() => {
      setRecurringTodos(peekRecurringTodos());
      setRoutineTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeReminders(() => {
      setReminders(peekReminders());
    });
  }, []);

  const planWeekRef = useRef<string | null>(null);
  planWeekRef.current = plan?.weekOf ?? null;

  useEffect(() => {
    async function onDataSynced() {
      const week = planWeekRef.current ?? formatWeekOf(startOfWeek());
      const stored = await loadPlan(week);
      if (stored) setPlan(normalizePlan(stored));
      setDueEvents(await listDueEvents());
      setRecurringTodos(await listRecurringTodos());
      setReminders(await listReminders());
      setBoxDone(peekBoxDone());
    }
    window.addEventListener(DATA_SYNC_EVENT, onDataSynced);
    return () => window.removeEventListener(DATA_SYNC_EVENT, onDataSynced);
  }, []);

  useEffect(() => {
    if (!plan || loadState !== "ready") return;
    cachePlan(plan);
    void savePlan(plan);
    setSavedFlash(true);
    const t = window.setTimeout(() => setSavedFlash(false), 1200);
    return () => window.clearTimeout(t);
  }, [plan, loadState]);

  function updatePlan(updater: (prev: WeekPlan) => WeekPlan) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      cachePlan(next);
      return next;
    });
  }

  function patchWeekPlan(
    targetWeek: string,
    updater: (prev: WeekPlan) => WeekPlan,
  ) {
    if (targetWeek === plan?.weekOf) {
      updatePlan(updater);
      return;
    }
    const current = normalizePlan(
      peekPlan(targetWeek) ?? buildWeekPlan(targetWeek),
    );
    const next = normalizePlan(updater(current));
    cachePlan(next);
    void savePlan(next);
    setPlanRevision((n) => n + 1);
  }

  function goToWeek(weekOf: string) {
    setEditingTask(null);
    editingTaskRef.current = null;
    setMoveDay(null);
    setDragTaskId(null);
    setDragHeight(0);
    setDropIndicator(null);
    setBoxMenu(null);
    setPlan((prev) => {
      if (prev) cachePlan(prev);
      const stored = peekPlan(weekOf);
      return normalizePlan(stored ?? buildWeekPlan(weekOf));
    });
  }

  function reorderBox(
    day: DayKey,
    fromId: string,
    toId: string,
    edge: "before" | "after",
  ) {
    const currentIds = sortedDayRows(day).map(boardRowId);
    const next = reorderIds(currentIds, fromId, toId, edge);
    if (!next) return;
    updatePlan((prev) => ({
      ...prev,
      dayBoxOrder: {
        ...prev.dayBoxOrder,
        [day]: next,
      },
    }));
  }

  function removeTask(day: DayKey, id: string) {
    updatePlan((prev) => {
      const dayOrder = prev.dayBoxOrder?.[day]?.filter((x) => x !== id);
      const dayBoxOrder = { ...prev.dayBoxOrder };
      if (dayOrder && dayOrder.length > 0) dayBoxOrder[day] = dayOrder;
      else delete dayBoxOrder[day];
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: prev.days[day].filter((t) => t.id !== id),
        },
        dayBoxOrder:
          Object.keys(dayBoxOrder).length > 0 ? dayBoxOrder : undefined,
      };
    });
    setEditingTask((cur) => (cur?.day === day && cur.id === id ? null : cur));
  }

  function addTask(day: DayKey) {
    const resolved = resolveBoxTime(drafts[day], draftTimes[day]);
    const text = resolved.text.trim();
    const tags = normalizeTaskTags(draftTags[day]);
    const time = resolved.time;
    if ((!text && tags.length === 0 && !time) || !plan) return;
    const item: TaskItem = {
      id: createId(),
      text,
      done: false,
      tags,
      ...(time ? clockFields(time) : {}),
    };
    updatePlan((prev) => ({
      ...prev,
      days: { ...prev.days, [day]: [...prev.days[day], item] },
    }));
    setDrafts((d) => ({ ...d, [day]: "" }));
    setDraftTags((d) => ({ ...d, [day]: [] }));
    setDraftTimes((d) => ({ ...d, [day]: null }));
    timeChipUndoRef.current = null;
  }

  function toggleTask(day: DayKey, id: string, targetWeek = plan?.weekOf) {
    if (!targetWeek) return;
    patchWeekPlan(targetWeek, (prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: prev.days[day].map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        ),
      },
    }));
  }

  function setTaskEstimate(
    day: DayKey,
    id: string,
    estimateMinutes: number | undefined,
    targetWeek = plan?.weekOf,
  ) {
    if (!targetWeek) return;
    patchWeekPlan(targetWeek, (prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: prev.days[day].map((t) =>
          t.id === id
            ? {
                ...t,
                estimateMinutes:
                  estimateMinutes && estimateMinutes > 0
                    ? estimateMinutes
                    : undefined,
              }
            : t,
        ),
      },
    }));
  }

  function setOverlayEstimate(
    boxId: string,
    estimateMinutes: number | undefined,
    targetWeek = plan?.weekOf,
  ) {
    if (!targetWeek) return;
    patchWeekPlan(targetWeek, (prev) => {
      const next = { ...(prev.overlayEstimates ?? {}) };
      if (estimateMinutes && estimateMinutes > 0) {
        next[boxId] = estimateMinutes;
      } else {
        delete next[boxId];
      }
      return {
        ...prev,
        overlayEstimates: Object.keys(next).length > 0 ? next : undefined,
      };
    });
  }

  function updateDayTiming(
    day: DayKey,
    patch: Pick<DayMeta, "fixedStart" | "breakMinutes">,
  ) {
    updatePlan((prev) => {
      const current = prev.dayMeta?.[day] ?? { title: "" };
      const nextMeta: DayMeta = { ...current };
      if ("fixedStart" in patch) {
        if (patch.fixedStart) nextMeta.fixedStart = patch.fixedStart;
        else delete nextMeta.fixedStart;
      }
      if ("breakMinutes" in patch) {
        if (patch.breakMinutes && patch.breakMinutes > 0) {
          nextMeta.breakMinutes = patch.breakMinutes;
        } else {
          delete nextMeta.breakMinutes;
        }
      }
      return {
        ...prev,
        dayMeta: {
          ...(prev.dayMeta ?? emptyDayMeta()),
          [day]: nextMeta,
        },
      };
    });
  }

  function beginEditTask(
    day: DayKey,
    task: TaskItem,
    carry?: CarryPointer,
  ) {
    const next = {
      day,
      id: task.id,
      value: taskBodyText(task),
      tags: normalizeTaskTags(task.tags),
      source: "task" as const,
      time: timeFromClock(task.startTime, task.endTime),
      ...(carry
        ? { sourceWeekOf: carry.sourceWeekOf, sourceDay: carry.sourceDay }
        : {}),
    };
    editingTaskRef.current = next;
    setEditingTask(next);
  }

  function beginEditRoutine(day: DayKey, item: RecurringTodoBox) {
    const next = {
      day,
      id: item.id,
      value: item.text,
      tags: normalizeTaskTags(item.tags),
      source: "routine" as const,
      todoId: item.todoId,
      time: timeFromClock(item.startTime, item.endTime),
    };
    editingTaskRef.current = next;
    setEditingTask(next);
  }

  function commitEditTask() {
    if (suppressEditBlurRef.current) return;
    const cur = editingTaskRef.current;
    if (!cur) return;
    editingTaskRef.current = null;
    setEditingTask(null);
    const resolved = resolveBoxTime(cur.value, cur.time);
    const text = resolved.text.trim();
    const tags = normalizeTaskTags(cur.tags);
    const time = resolved.time;
    if (!text && tags.length === 0 && !time) return;

    if (cur.source === "routine" && cur.todoId) {
      const existing = recurringTodos.find((t) => t.id === cur.todoId);
      void saveRecurringTodo({
        id: cur.todoId,
        text: text || "Untitled",
        tags,
        day: existing?.day ?? cur.day,
        ...(time ? clockFields(time) : {}),
      });
      return;
    }

    if (!plan) return;
    const writeWeek = cur.sourceWeekOf ?? plan.weekOf;
    const writeDay = cur.sourceDay ?? cur.day;
    patchWeekPlan(writeWeek, (prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [writeDay]: prev.days[writeDay].map((t) => {
          if (t.id !== cur.id) return t;
          const next: TaskItem = {
            ...t,
            text,
            tags,
            optional: undefined,
          };
          if (time) {
            next.startTime = time.startTime;
            if (time.endTime) next.endTime = time.endTime;
            else delete next.endTime;
          } else {
            delete next.startTime;
            delete next.endTime;
          }
          return next;
        }),
      },
    }));
  }

  function cancelEditTask() {
    editingTaskRef.current = null;
    setEditingTask(null);
  }

  function setEditingTags(tags: BoxTag[]) {
    setEditingTask((cur) => {
      if (!cur) return cur;
      const next = { ...cur, tags: normalizeTaskTags(tags) };
      editingTaskRef.current = next;
      return next;
    });
  }

  function editStoredTime() {
    timeChipUndoRef.current = null;
    tagChipUndoRef.current = null;
    setEditingTask((cur) => {
      if (!cur?.time) return cur;
      const label = formatTimeRange(cur.time.startTime, cur.time.endTime);
      if (!label) return cur;
      const chunk = `(${label})`;
      const value = cur.value.trim()
        ? `${cur.value.trimEnd()} ${chunk}`
        : chunk;
      const next = { ...cur, value, time: null };
      editingTaskRef.current = next;
      return next;
    });
  }

  if (loadState === "loading" || !plan) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          <div className="h-10 w-56 animate-pulse rounded-md bg-secondary/80" />
          <div className="h-28 animate-pulse rounded-2xl bg-secondary/60" />
          <div className="grid gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl bg-secondary/50"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const weekOf = plan.weekOf;
  const csWeek = csWeekNumberForBoardWeek(weekOf);

  const planForWeek = (targetWeekOf: string): WeekPlan => {
    void planRevision;
    if (plan.weekOf === targetWeekOf) return plan;
    return normalizePlan(peekPlan(targetWeekOf) ?? buildWeekPlan(targetWeekOf));
  };

  const eventBoxesForWeek = (targetWeekOf: string, dayKey: DayKey) =>
    overlayBoxesForWeek(dueEvents, targetWeekOf, boxDone)[dayKey] ?? [];

  const routineBoxesForWeek = (targetWeekOf: string, dayKey: DayKey) => {
    void routineTick;
    return (
      overlayRecurringTodosForWeek(recurringTodos, targetWeekOf)[dayKey] ?? []
    );
  };

  const csOverlayForWeek = (targetWeekOf: string, dayKey: DayKey) => {
    const weekCs = csWeekNumberForBoardWeek(targetWeekOf);
    if (weekCs == null) return [] as Cs234ChecklistItem[];
    if (dayKey === "friday") return lectureContentForWeek(cs234Items, weekCs);
    if (dayKey === "saturday")
      return problemSolvingForWeek(cs234Items, weekCs);
    return [];
  };

  const visibleDayTasksForWeek = (
    targetWeekOf: string,
    weekPlan: WeekPlan,
    dayKey: DayKey,
  ): TaskItem[] => {
    const eventBoxes = eventBoxesForWeek(targetWeekOf, dayKey);
    const routineBoxes = routineBoxesForWeek(targetWeekOf, dayKey);
    const csOverlay = csOverlayForWeek(targetWeekOf, dayKey);
    const overlays: OverlayRef[] = [
      ...eventBoxes.map((i) => ({ text: i.text, tags: i.tags })),
      ...routineBoxes.map((i) => ({ text: i.text, tags: i.tags })),
      ...csOverlay.map((i) => ({
        text: i.label,
        tags: ["cs234"] as BoxTag[],
      })),
    ];
    const raw = weekPlan.days[dayKey] ?? [];
    return raw.filter((t) => {
      if (isLegacyCs234DayTask(t) || isLegacyAcademicDayTask(t)) return false;
      if (isDuplicateOfOverlay(t, overlays)) return false;
      return true;
    });
  };

  const defaultDayRowsForWeek = (
    targetWeekOf: string,
    weekPlan: WeekPlan,
    dayKey: DayKey,
  ): DayBoardRow[] => {
    const weekCs = csWeekNumberForBoardWeek(targetWeekOf);
    const rows: DayBoardRow[] = [];
    let index = 0;
    for (const item of eventBoxesForWeek(targetWeekOf, dayKey)) {
      rows.push({ kind: "event", item, index: index++ });
    }
    for (const item of csOverlayForWeek(targetWeekOf, dayKey)) {
      rows.push({ kind: "cs", item, index: index++ });
    }
    for (const item of routineBoxesForWeek(targetWeekOf, dayKey)) {
      rows.push({ kind: "routine", item, index: index++ });
    }
    for (const item of reminderBoxesForDay(reminders, weekPlan, dayKey)) {
      rows.push({ kind: "reminder", item, index: index++ });
    }
    for (const item of visibleDayTasksForWeek(targetWeekOf, weekPlan, dayKey)) {
      rows.push({ kind: "task", item, index: index++ });
    }
    return rows.sort((a, b) =>
      compareBoardBoxes(rowSortKey(a, weekCs), rowSortKey(b, weekCs)),
    );
  };

  const sortedDayRowsForWeek = (
    targetWeekOf: string,
    weekPlan: WeekPlan,
    dayKey: DayKey,
  ): DayBoardRow[] =>
    applyDayBoxOrder(
      defaultDayRowsForWeek(targetWeekOf, weekPlan, dayKey),
      weekPlan.dayBoxOrder?.[dayKey],
    );

  const resolveCarriedRows = (dayKey: DayKey): DayBoardRow[] => {
    const refs = plan.carriedBoxes?.[dayKey] ?? [];
    const rows: DayBoardRow[] = [];
    for (const ref of refs) {
      const sourcePlan = planForWeek(ref.sourceWeekOf);
      const source = defaultDayRowsForWeek(
        ref.sourceWeekOf,
        sourcePlan,
        ref.sourceDay,
      ).find((row) => row.kind === ref.kind && boardRowId(row) === ref.id);
      if (!source) continue;
      rows.push({
        ...source,
        carry: {
          sourceWeekOf: ref.sourceWeekOf,
          sourceDay: ref.sourceDay,
        },
      });
    }
    return rows;
  };

  const sortedDayRows = (dayKey: DayKey): DayBoardRow[] => {
    const weekCs = csWeekNumberForBoardWeek(weekOf);
    const native = defaultDayRowsForWeek(weekOf, plan, dayKey);
    const seen = new Set(native.map(boardRowId));
    const extra = resolveCarriedRows(dayKey).filter((row) => {
      const id = boardRowId(row);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const defaults = [...native, ...extra].sort((a, b) =>
      compareBoardBoxes(rowSortKey(a, weekCs), rowSortKey(b, weekCs)),
    );
    return applyDayBoxOrder(defaults, plan.dayBoxOrder?.[dayKey]);
  };

  const totalTasks = DAYS.reduce(
    (n, d) => n + sortedDayRows(d.key).length,
    0,
  );
  const doneTasks = DAYS.reduce(
    (n, d) =>
      n +
      sortedDayRows(d.key).filter((row) => rowSortKey(row, csWeek).done)
        .length,
    0,
  );

  const today = todayDateString();
  const latestMissedWeek = formatWeekOf(
    startOfWeek(new Date(`${today}T12:00:00`)),
  );
  const missedBoxes: {
    key: string;
    weekOf: string;
    day: DayKey;
    date: string;
    dateLabel: string;
    row: DayBoardRow;
    csWeek: number | null;
  }[] = [];
  const seenCsMissed = new Set<string>();
  for (
    let scanWeek = TERM_BOARD_START;
    scanWeek <= latestMissedWeek;
    scanWeek = shiftWeek(scanWeek, 1)
  ) {
    const weekPlan = planForWeek(scanWeek);
    const weekCs = csWeekNumberForBoardWeek(scanWeek);
    for (const day of DAYS) {
      const date = boardBoxDate(scanWeek, day.key);
      if (date >= today) continue;
      for (const row of sortedDayRowsForWeek(scanWeek, weekPlan, day.key)) {
        if (row.kind === "reminder") continue;
        if (rowSortKey(row, weekCs).done || isOptionalBoardRow(row, weekCs))
          continue;
        // CS checklist items are shared across weeks — only list once.
        if (row.kind === "cs") {
          if (seenCsMissed.has(row.item.id)) continue;
          seenCsMissed.add(row.item.id);
        }
        missedBoxes.push({
          key: `${scanWeek}:${date}:${boardRowId(row)}`,
          weekOf: scanWeek,
          day: day.key,
          date,
          dateLabel: formatMissedDateLabel(date),
          row,
          csWeek: weekCs,
        });
      }
    }
  }
  missedBoxes.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return compareBoardBoxes(
      rowSortKey(a.row, a.csWeek),
      rowSortKey(b.row, b.csWeek),
    );
  });

  function toggleMissedBox(
    missedWeekOf: string,
    day: DayKey,
    row: DayBoardRow,
  ) {
    switch (row.kind) {
      case "event":
        void toggleEventBox(row.item.id);
        break;
      case "cs":
        void toggleCs234Item(row.item.id);
        break;
      case "routine":
        void toggleRecurringTodo(row.item.todoId, missedWeekOf);
        break;
      case "reminder":
        void toggleReminder(row.item.reminderId);
        break;
      case "task":
        toggleTask(day, row.item.id, missedWeekOf);
        break;
    }
  }

  const todayWeek = formatWeekOf(startOfWeek(new Date(`${today}T12:00:00`)));
  const todayDay = dayKeyForDate(today);

  function sameCarry(
    ref: CarriedBoxRef,
    row: DayBoardRow,
    sourceWeekOf: string,
    sourceDay: DayKey,
  ) {
    return (
      ref.kind === row.kind &&
      ref.id === boardRowId(row) &&
      ref.sourceWeekOf === sourceWeekOf &&
      ref.sourceDay === sourceDay
    );
  }

  function missedBoxOnToday(entry: {
    weekOf: string;
    day: DayKey;
    row: DayBoardRow;
  }): boolean {
    const id = boardRowId(entry.row);
    if (!plan) return false;
    const todayPlan = todayWeek === weekOf ? plan : planForWeek(todayWeek);
    const carried = todayPlan.carriedBoxes?.[todayDay] ?? [];
    if (
      carried.some((ref) =>
        sameCarry(ref, entry.row, entry.weekOf, entry.day),
      )
    ) {
      return true;
    }
    return defaultDayRowsForWeek(todayWeek, todayPlan, todayDay).some(
      (row) => row.kind === entry.row.kind && boardRowId(row) === id,
    );
  }

  function isMissedBoxCarriedToToday(entry: {
    weekOf: string;
    day: DayKey;
    row: DayBoardRow;
  }): boolean {
    if (!plan) return false;
    const todayPlan = todayWeek === weekOf ? plan : planForWeek(todayWeek);
    const carried = todayPlan.carriedBoxes?.[todayDay] ?? [];
    return carried.some((ref) =>
      sameCarry(ref, entry.row, entry.weekOf, entry.day),
    );
  }

  function addMissedBoxToToday(entry: {
    weekOf: string;
    day: DayKey;
    row: DayBoardRow;
  }) {
    if (entry.row.kind === "reminder") return;
    if (missedBoxOnToday(entry)) return;
    const ref: CarriedBoxRef = {
      kind: entry.row.kind,
      sourceWeekOf: entry.weekOf,
      sourceDay: entry.day,
      id: boardRowId(entry.row),
    };
    patchWeekPlan(todayWeek, (prev) => {
      const list = prev.carriedBoxes?.[todayDay] ?? [];
      if (list.some((item) => sameCarry(item, entry.row, entry.weekOf, entry.day))) {
        return prev;
      }
      return {
        ...prev,
        carriedBoxes: {
          ...prev.carriedBoxes,
          [todayDay]: [...list, ref],
        },
      };
    });
  }

  function removeMissedBoxFromToday(entry: {
    weekOf: string;
    day: DayKey;
    row: DayBoardRow;
  }) {
    if (entry.row.kind === "reminder") return;
    if (!isMissedBoxCarriedToToday(entry)) return;
    patchWeekPlan(todayWeek, (prev) => {
      const list = (prev.carriedBoxes?.[todayDay] ?? []).filter(
        (ref) => !sameCarry(ref, entry.row, entry.weekOf, entry.day),
      );
      const carriedBoxes = { ...(prev.carriedBoxes ?? {}) };
      if (list.length > 0) carriedBoxes[todayDay] = list;
      else delete carriedBoxes[todayDay];
      return {
        ...prev,
        carriedBoxes:
          Object.keys(carriedBoxes).length > 0 ? carriedBoxes : undefined,
      };
    });
  }

  function toggleMissedBoxOnToday(entry: {
    weekOf: string;
    day: DayKey;
    row: DayBoardRow;
  }) {
    if (isMissedBoxCarriedToToday(entry)) {
      removeMissedBoxFromToday(entry);
    } else {
      addMissedBoxToToday(entry);
    }
  }

  function removeCarry(day: DayKey, row: DayBoardRow) {
    const pointer = row.carry;
    if (!pointer) return;
    updatePlan((prev) => {
      const list = (prev.carriedBoxes?.[day] ?? []).filter(
        (ref) => !sameCarry(ref, row, pointer.sourceWeekOf, pointer.sourceDay),
      );
      const carriedBoxes = { ...(prev.carriedBoxes ?? {}) };
      if (list.length > 0) carriedBoxes[day] = list;
      else delete carriedBoxes[day];
      return {
        ...prev,
        carriedBoxes:
          Object.keys(carriedBoxes).length > 0 ? carriedBoxes : undefined,
      };
    });
  }

  function estimateMinutesFor(
    row: DayBoardRow,
    explicitWeek?: string,
  ): number | undefined {
    if (!plan) return undefined;
    if (row.kind === "task") return row.item.estimateMinutes;
    const boxId =
      row.kind === "cs"
        ? cs234EstimateKey(row.item.id)
        : row.kind === "reminder"
          ? reminderEstimateKey(row.item.reminderId)
          : row.item.id;
    const sourceWeek = row.carry?.sourceWeekOf ?? explicitWeek ?? weekOf;
    const estimates =
      (sourceWeek === weekOf ? plan : planForWeek(sourceWeek)).overlayEstimates ??
      {};
    if (row.kind === "event") return estimates[boxId] ?? row.item.estimateMinutes;
    return estimates[boxId];
  }

  function setRowEstimate(
    row: DayBoardRow,
    day: DayKey,
    minutes: number | undefined,
    explicitWeek?: string,
  ) {
    const writeWeek = row.carry?.sourceWeekOf ?? explicitWeek ?? weekOf;
    const writeDay = row.carry?.sourceDay ?? day;
    if (row.kind === "task") {
      setTaskEstimate(writeDay, row.item.id, minutes, writeWeek);
      return;
    }
    const boxId =
      row.kind === "cs"
        ? cs234EstimateKey(row.item.id)
        : row.kind === "reminder"
          ? reminderEstimateKey(row.item.reminderId)
          : row.item.id;
    if (row.kind === "event") {
      const seriesDefault =
        row.item.estimateMinutes && row.item.estimateMinutes > 0
          ? row.item.estimateMinutes
          : undefined;
      const next = minutes && minutes > 0 ? minutes : undefined;
      // Same as the calendar duration stays linked, so a later calendar
      // change updates this week. A different time is kept for this week.
      setOverlayEstimate(
        boxId,
        next === seriesDefault ? undefined : next,
        writeWeek,
      );
      return;
    }
    setOverlayEstimate(boxId, minutes, writeWeek);
  }

  function mirrorEditing(
    id: string,
    patch: { tags?: BoxTag[]; time?: BoardTimeRange | null },
  ) {
    setEditingTask((cur) => {
      if (!cur || cur.id !== id) return cur;
      const value =
        patch.time !== undefined ? detachBoardTime(cur.value).text : cur.value;
      const next = { ...cur, ...patch, value };
      editingTaskRef.current = next;
      return next;
    });
  }

  function updateEventBox(
    item: EventBoardBox,
    patch: { time?: BoardTimeRange | null; tags?: BoxTag[] },
  ) {
    const event = peekDueEvents().find((entry) => entry.id === item.sourceEventId);
    if (!event) return;
    if (item.sourceRuleId === "appear") {
      if (patch.time === undefined) return;
      void saveDueEvent({
        ...event,
        startTime: patch.time?.startTime,
        endTime: patch.time?.endTime,
      });
      return;
    }
    const rules = (event.rules ?? []).map((rule) => {
      if (rule.id !== item.sourceRuleId) return rule;
      const next = { ...rule };
      if (patch.tags) next.tags = normalizeTaskTags(patch.tags);
      if (patch.time !== undefined) {
        if (patch.time) {
          next.startTime = patch.time.startTime;
          if (patch.time.endTime) next.endTime = patch.time.endTime;
          else delete next.endTime;
        } else {
          delete next.startTime;
          delete next.endTime;
        }
      }
      return next;
    });
    void saveDueEvent({ ...event, rules });
  }

  function setRowTime(
    row: DayBoardRow,
    day: DayKey,
    time: BoardTimeRange | null,
    explicitWeek?: string,
  ) {
    if (row.kind === "task") {
      const writeDay = row.carry?.sourceDay ?? day;
      const writeWeek = row.carry?.sourceWeekOf ?? explicitWeek ?? weekOf;
      patchWeekPlan(writeWeek, (prev) => ({
        ...prev,
        days: {
          ...prev.days,
          [writeDay]: prev.days[writeDay].map((task) => {
            if (task.id !== row.item.id) return task;
            const next: TaskItem = { ...task };
            if (time) {
              next.startTime = time.startTime;
              if (time.endTime) next.endTime = time.endTime;
              else delete next.endTime;
            } else {
              delete next.startTime;
              delete next.endTime;
            }
            return next;
          }),
        },
      }));
      mirrorEditing(row.item.id, { time });
      return;
    }
    if (row.kind === "routine") {
      const existing = recurringTodos.find((todo) => todo.id === row.item.todoId);
      if (!existing) return;
      void saveRecurringTodo({
        id: existing.id,
        text: existing.text,
        tags: existing.tags,
        day: existing.day,
        ...(time ? clockFields(time) : {}),
      });
      mirrorEditing(row.item.id, { time });
      return;
    }
    if (row.kind === "event") updateEventBox(row.item, { time });
  }

  function setRowTags(
    row: DayBoardRow,
    day: DayKey,
    tags: BoxTag[],
    explicitWeek?: string,
  ) {
    const nextTags = normalizeTaskTags(tags);
    if (row.kind === "task") {
      const writeDay = row.carry?.sourceDay ?? day;
      const writeWeek = row.carry?.sourceWeekOf ?? explicitWeek ?? weekOf;
      patchWeekPlan(writeWeek, (prev) => ({
        ...prev,
        days: {
          ...prev.days,
          [writeDay]: prev.days[writeDay].map((task) =>
            task.id === row.item.id
              ? { ...task, tags: nextTags, optional: undefined }
              : task,
          ),
        },
      }));
      mirrorEditing(row.item.id, { tags: nextTags });
      return;
    }
    if (row.kind === "routine") {
      const existing = recurringTodos.find(
        (todo) => todo.id === row.item.todoId,
      );
      if (!existing) return;
      void saveRecurringTodo({
        id: existing.id,
        text: existing.text,
        tags: nextTags,
        day: existing.day,
        ...(existing.startTime ? { startTime: existing.startTime } : {}),
        ...(existing.endTime ? { endTime: existing.endTime } : {}),
      });
      mirrorEditing(row.item.id, { tags: nextTags });
      return;
    }
    if (row.kind === "reminder") {
      void updateReminder(row.item.reminderId, { tags: nextTags });
      return;
    }
    if (row.kind === "event" && row.item.sourceRuleId !== "appear") {
      updateEventBox(row.item, { tags: nextTags });
    }
  }

  function openBoxMenu(
    event: ReactMouseEvent,
    day: DayKey,
    row: DayBoardRow,
    viewWeek?: string,
  ) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      return;
    }
    event.preventDefault();
    setBoxMenu({
      x: event.clientX,
      y: event.clientY,
      viewWeek: row.carry?.sourceWeekOf ?? viewWeek ?? weekOf,
      viewDay: row.carry?.sourceDay ?? day,
      rowId: boardRowId(row),
    });
  }

  function toggleBoardRow(day: DayKey, row: DayBoardRow) {
    switch (row.kind) {
      case "event":
        void toggleEventBox(row.item.id);
        break;
      case "cs":
        void toggleCs234Item(row.item.id);
        break;
      case "routine":
        void toggleRecurringTodo(
          row.item.todoId,
          row.carry?.sourceWeekOf ?? weekOf,
        );
        break;
      case "reminder":
        void toggleReminder(row.item.reminderId);
        break;
      case "task":
        toggleTask(
          row.carry?.sourceDay ?? day,
          row.item.id,
          row.carry?.sourceWeekOf ?? weekOf,
        );
        break;
    }
  }

  function removeReminderPin(day: DayKey, reminderId: string) {
    updatePlan((prev) => {
      const list = (prev.pinnedReminders?.[day] ?? []).filter(
        (id) => id !== reminderId,
      );
      const pinnedReminders = { ...(prev.pinnedReminders ?? {}) };
      if (list.length > 0) pinnedReminders[day] = list;
      else delete pinnedReminders[day];
      return {
        ...prev,
        pinnedReminders:
          Object.keys(pinnedReminders).length > 0 ? pinnedReminders : undefined,
      };
    });
  }

  const menuRow = (() => {
    if (!boxMenu) return null;
    const rows =
      boxMenu.viewWeek === weekOf
        ? sortedDayRows(boxMenu.viewDay)
        : sortedDayRowsForWeek(
            boxMenu.viewWeek,
            planForWeek(boxMenu.viewWeek),
            boxMenu.viewDay,
          );
    return (
      rows.find((row) => boardRowId(row) === boxMenu.rowId && !row.carry) ??
      rows.find((row) => boardRowId(row) === boxMenu.rowId) ??
      null
    );
  })();
  const menuActions = menuRow ? boxActionState(menuRow) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      {loadState === "error" && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not read saved data. Loaded your strategy seed for this week.
        </p>
      )}

      <section className="mb-10 animate-rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium tracking-wide text-seafoam uppercase">
              {process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
                ? `Week of ${formatWeekLabel(plan.weekOf)}`
                : // eslint-disable-next-line @typescript-eslint/no-require-imports
                  require("@/lib/personal/labels").personalWeekEyebrow(
                    formatWeekLabel(plan.weekOf),
                  )}
            </p>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your strategy board
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Finish the boxes → you’re on track. Saved on this device — edit
              freely.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs transition-opacity ${savedFlash ? "opacity-100" : "opacity-0"}`}
              aria-live="polite"
            >
              Saved
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToWeek(shiftWeek(plan.weekOf, -1))}
              aria-label="Previous week"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToWeek(formatWeekOf(startOfWeek()))}
            >
              This week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToWeek(shiftWeek(plan.weekOf, 1))}
              aria-label="Next week"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="mt-4 h-px w-full origin-left bg-gradient-to-r from-seafoam via-glow/70 to-transparent animate-draw-line" />

        {plan.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {plan.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border/80 bg-white/70 px-2.5 py-1 text-xs font-medium text-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 text-sm text-muted-foreground">
          {totalTasks === 0
            ? "No priorities yet — add your first task below."
            : `${doneTasks} of ${totalTasks} boxes done`}
        </p>
      </section>

      <section className="mb-10 animate-rise-delay-1">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <button
            type="button"
            onClick={() => setThisWeekOpen((v) => !v)}
            aria-expanded={thisWeekOpen}
            className="flex items-center gap-2 text-left"
          >
            <ChevronDown
              className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                thisWeekOpen ? "" : "-rotate-90"
              }`}
              aria-hidden
            />
            <h3 className="font-heading text-2xl font-semibold text-ink">
              This week
            </h3>
            {!thisWeekOpen && weekDues.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {weekDues.length}
              </span>
            ) : null}
          </button>
          <Link
            href="/calendar"
            className="text-sm font-medium text-seafoam hover:underline"
          >
            Open calendar
          </Link>
        </div>
        {thisWeekOpen ? (
          weekDues.length === 0 ? (
            <p className="rounded-xl border border-border/70 bg-white/65 px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm">
              No dues this week. Add or edit dates in the calendar.
            </p>
          ) : (
            <ul className="space-y-2">
              {weekDues.map((d: DueEventInstance) => {
                const dayLabel = new Date(
                  `${d.instanceDate}T12:00:00`,
                ).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <li key={`${d.seriesId}:${d.instanceDate}`}>
                    <Link
                      href={calendarHrefForEvent(d.seriesId, d.instanceDate)}
                      className="block rounded-xl border border-border/70 bg-white/65 px-4 py-3 backdrop-blur-sm transition-colors hover:border-seafoam/50"
                    >
                      <p
                        className="text-xs font-semibold tracking-wider uppercase"
                        style={{ color: dueCourseColor(d.course) }}
                      >
                        {d.course} · {dayLabel}
                        {d.recurrence?.frequency === "custom"
                          ? " · custom"
                          : d.recurrence
                            ? " · weekly"
                            : ""}
                      </p>
                      <p className="font-medium text-ink">{d.title}</p>
                      {d.startTime ? (
                        <p className="text-sm text-muted-foreground">
                          {formatTimeRange(d.startTime, d.endTime)}
                        </p>
                      ) : null}
                      {d.detail ? (
                        <p className="text-sm text-muted-foreground">
                          {d.detail}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </section>

      <section className="mb-12 animate-rise-delay-2">
        <h3 className="mb-4 font-heading text-2xl font-semibold text-ink">
          Daily checklist
        </h3>
        <div className="grid gap-4">
          {DAYS.map((day) => {
            const dayRows = sortedDayRows(day.key);
            const meta = plan.dayMeta?.[day.key];
            const timingTasks: TaskItem[] = dayRows.map((row) => ({
              id: boardRowId(row),
              text: boardRowLabel(row),
              done: rowSortKey(row, csWeek).done,
              estimateMinutes: estimateMinutesFor(row),
            }));
            const isMoving = moveDay === day.key;
            const orderedIds = dayRows.map(boardRowId);
            const doneCount = dayRows.filter((row) =>
              rowSortKey(row, csWeek).done,
            ).length;
            const totalCount = dayRows.length;
            const hasAny = totalCount > 0;
            return (
              <div
                key={day.key}
                className="relative z-0 flex min-w-0 flex-col rounded-2xl border border-border/70 bg-white/65 p-4 backdrop-blur-sm transition-colors hover:border-seafoam/40 has-[[aria-expanded=true]]:z-50"
              >
                <div className="mb-3 flex items-start gap-2">
                  <h4 className="min-w-0 flex-1 font-heading text-lg font-semibold text-ink">
                    {day.label}
                  </h4>
                  <div className="flex shrink-0 items-center gap-2">
                    <DayTimingSummary
                      tasks={timingTasks}
                      fixedStart={meta?.fixedStart}
                      breakMinutes={meta?.breakMinutes}
                      onFixedStartChange={(value) =>
                        updateDayTiming(day.key, { fixedStart: value })
                      }
                      onBreakMinutesChange={(value) =>
                        updateDayTiming(day.key, { breakMinutes: value })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {doneCount}/{totalCount}
                    </span>
                    {totalCount > 1 && (
                      <Button
                        type="button"
                        variant={isMoving ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => {
                          setMoveDay((cur) =>
                            cur === day.key ? null : day.key,
                          );
                          setDragTaskId(null);
                          setDragHeight(0);
                          setDropIndicator(null);
                        }}
                        aria-pressed={isMoving}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Move className="size-3.5" />
                        {isMoving ? "Done" : "Move"}
                      </Button>
                    )}
                  </div>
                </div>

                {!hasAny ? (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Empty day — keep it light or add one priority.
                  </p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {dayRows.map((row) => {
                      const rowId = boardRowId(row);
                      const rowLabel = boardRowLabel(row);
                      const rowShell = {
                        rowId,
                        label: rowLabel,
                        isMoving,
                        dragTaskId,
                        dragHeight,
                        dropIndicator,
                        orderedIds,
                        setDragTaskId,
                        setDragHeight,
                        setDropIndicator,
                        onReorder: (
                          fromId: string,
                          toId: string,
                          edge: "before" | "after",
                        ) => reorderBox(day.key, fromId, toId, edge),
                        onContextMenu: (event: ReactMouseEvent<HTMLLIElement>) =>
                          openBoxMenu(event, day.key, row),
                      };

                      if (row.kind === "event") {
                        const item = row.item;
                        const timeNote =
                          item.startTime != null
                            ? formatTimeRange(item.startTime, item.endTime)
                            : null;
                        return (
                          <BoardRowLi key={rowId} {...rowShell}>
                            <Checkbox
                              checked={item.done}
                              onCheckedChange={() =>
                                toggleBoardRow(day.key, row)
                              }
                              className="mt-0.5"
                              aria-label={`Mark ${item.text} complete`}
                            />
                            <Link
                              href={calendarHrefForEvent(
                                item.sourceEventId,
                                item.instanceDate,
                              )}
                              className={`min-w-0 flex-1 text-sm leading-snug outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 ${
                                item.done ? "line-through" : ""
                              }`}
                            >
                              <TaskTagPrefixes
                                tags={item.tags}
                                dimmed={item.done}
                                separator={Boolean(item.text)}
                              />
                              <span
                                className={
                                  item.done
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                                }
                              >
                                {item.text}
                                {timeNote ? (
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    ({timeNote})
                                  </span>
                                ) : null}
                                {carryFromNote(row)}
                              </span>
                            </Link>
                            <TaskEstimateInput
                              minutes={estimateMinutesFor(row)}
                              dimmed={item.done}
                              onChange={(minutes) =>
                                setRowEstimate(row, day.key, minutes)
                              }
                            />
                            {row.carry ? (
                              <button
                                type="button"
                                onClick={() => removeCarry(day.key, row)}
                                title="Remove from today"
                                className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                              >
                                Remove
                              </button>
                            ) : (
                              <RemoveSlotSpacer />
                            )}
                          </BoardRowLi>
                        );
                      }

                      if (row.kind === "cs") {
                        const item = row.item;
                        const noteWeek = row.carry
                          ? csWeekNumberForBoardWeek(row.carry.sourceWeekOf)
                          : csWeek;
                        const note =
                          noteWeek != null
                            ? dueNoteForWeek(item, noteWeek)
                            : item.dueNote;
                        const label =
                          process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
                            ? item.label
                            : // eslint-disable-next-line @typescript-eslint/no-require-imports
                              `${require("@/lib/personal/labels").personalCsBoardPrefix()} | ${item.label}`;
                        const tags = csBoardTags(item, noteWeek);
                        return (
                          <BoardRowLi key={rowId} {...rowShell}>
                            <Checkbox
                              checked={item.done}
                              onCheckedChange={() =>
                                toggleBoardRow(day.key, row)
                              }
                              className="mt-0.5"
                              aria-label={`Mark ${label} complete`}
                            />
                            <span
                              className={`min-w-0 flex-1 text-sm leading-snug ${
                                item.done ? "line-through" : ""
                              }`}
                            >
                              <TaskTagPrefixes
                                tags={tags}
                                dimmed={item.done}
                              />
                              <span
                                className={
                                  item.done
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                                }
                              >
                                {item.label}
                                {note ? (
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    ({note})
                                  </span>
                                ) : null}
                                {carryFromNote(row)}
                              </span>
                            </span>
                            <TaskEstimateInput
                              minutes={estimateMinutesFor(row)}
                              dimmed={item.done}
                              onChange={(minutes) =>
                                setRowEstimate(row, day.key, minutes)
                              }
                            />
                            {row.carry ? (
                              <button
                                type="button"
                                onClick={() => removeCarry(day.key, row)}
                                title="Remove from today"
                                className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                              >
                                Remove
                              </button>
                            ) : (
                              <RemoveSlotSpacer />
                            )}
                          </BoardRowLi>
                        );
                      }

                      if (row.kind === "reminder") {
                        const item = row.item;
                        return (
                          <BoardRowLi key={rowId} {...rowShell}>
                            <Checkbox
                              checked={item.done}
                              onCheckedChange={() =>
                                toggleBoardRow(day.key, row)
                              }
                              className="mt-0.5"
                              aria-label={`Mark ${item.text} complete`}
                            />
                            <span
                              className={`min-w-0 flex-1 text-sm leading-snug ${
                                item.done ? "line-through" : ""
                              }`}
                            >
                              <TaskTagPrefixes
                                tags={item.tags}
                                dimmed={item.done}
                                separator={Boolean(item.text)}
                              />
                              <span
                                className={
                                  item.done
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                                }
                              >
                                {item.text}
                              </span>
                            </span>
                            <TaskEstimateInput
                              minutes={estimateMinutesFor(row)}
                              dimmed={item.done}
                              onChange={(minutes) =>
                                setRowEstimate(row, day.key, minutes)
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removeReminderPin(day.key, item.reminderId)
                              }
                              title="Remove from today"
                              className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                            >
                              Remove
                            </button>
                          </BoardRowLi>
                        );
                      }

                      if (row.kind === "routine") {
                        const item = row.item;
                        const timeNote =
                          item.startTime != null
                            ? formatTimeRange(item.startTime, item.endTime)
                            : null;
                        const editable = item.tags.includes("optional");
                        const isEditing =
                          editingTask?.day === day.key &&
                          editingTask.id === item.id &&
                          editingTask.source === "routine";
                        const timeSubtitle = timeNote ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({timeNote})
                          </span>
                        ) : null;
                        return (
                          <BoardRowLi key={rowId} {...rowShell}>
                            <Checkbox
                              checked={item.done}
                              onCheckedChange={() =>
                                toggleBoardRow(day.key, row)
                              }
                              className="mt-0.5"
                              aria-label={`Mark ${item.text} complete`}
                            />
                            {isEditing ? (
                              <div
                                className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 gap-y-1"
                                onBlur={(e) => {
                                  if (
                                    !e.currentTarget.contains(
                                      e.relatedTarget as Node,
                                    )
                                  ) {
                                    commitEditTask();
                                  }
                                }}
                              >
                                {editingTask.tags.length > 0 && (
                                  <span className="shrink-0 pt-1 text-sm leading-snug">
                                    <TaskTagPrefixes
                                      tags={editingTask.tags}
                                      separator={false}
                                    />
                                  </span>
                                )}
                                <Input
                                  autoFocus
                                  value={editingTask.value}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    tagChipUndoRef.current = null;
                                    timeChipUndoRef.current = null;
                                    setEditingTask((cur) => {
                                      if (!cur) return cur;
                                      const next = { ...cur, value };
                                      editingTaskRef.current = next;
                                      return next;
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (
                                      handleTimeChipKey(e, {
                                        key: `edit:${editingTask.id}`,
                                        value: editingTask.value,
                                        time: editingTask.time,
                                        undoRef: timeChipUndoRef,
                                        onChange: ({ value, time }) => {
                                          tagChipUndoRef.current = null;
                                          setEditingTask((cur) => {
                                            if (!cur) return cur;
                                            const next = { ...cur, value, time };
                                            editingTaskRef.current = next;
                                            return next;
                                          });
                                        },
                                      })
                                    ) {
                                      return;
                                    }
                                    if (
                                      handleTagChipKey(e, {
                                        key: `edit:${editingTask.id}`,
                                        value: editingTask.value,
                                        tags: editingTask.tags,
                                        undoRef: tagChipUndoRef,
                                        onChange: ({ value, tags }) => {
                                          timeChipUndoRef.current = null;
                                          setEditingTask((cur) => {
                                            if (!cur) return cur;
                                            const next = { ...cur, value, tags };
                                            editingTaskRef.current = next;
                                            return next;
                                          });
                                        },
                                      })
                                    ) {
                                      return;
                                    }
                                    if (
                                      handleTaskLinkKey(
                                        e,
                                        editingTask.value,
                                        (value) => {
                                          setEditingTask((cur) => {
                                            if (!cur) return cur;
                                            const next = { ...cur, value };
                                            editingTaskRef.current = next;
                                            return next;
                                          });
                                        },
                                        () => {
                                          suppressEditBlurRef.current = true;
                                        },
                                        () => {
                                          suppressEditBlurRef.current = false;
                                        },
                                      )
                                    ) {
                                      return;
                                    }
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitEditTask();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEditTask();
                                    }
                                  }}
                                  aria-label="Edit box text"
                                  className="h-7 min-w-0 flex-1 basis-28 bg-white/90 text-sm"
                                />
                                <EditingTimeChip
                                  time={editingTask.time}
                                  onEdit={editStoredTime}
                                />
                                <BoxTagPicker
                                  tags={editingTask.tags}
                                  onChange={(tags) => {
                                    tagChipUndoRef.current = null;
                                    timeChipUndoRef.current = null;
                                    setEditingTags(tags);
                                  }}
                                />
                              </div>
                            ) : editable ? (
                              <button
                                type="button"
                                onClick={() =>
                                  beginEditRoutine(day.key, item)
                                }
                                className={`min-w-0 flex-1 break-words rounded-sm text-left text-sm leading-snug outline-none hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring/50 ${
                                  item.done ? "line-through" : ""
                                }`}
                              >
                                <TaskTagPrefixes
                                  tags={item.tags}
                                  dimmed={item.done}
                                  separator={Boolean(item.text)}
                                />
                                <TaskRichText
                                  text={item.text}
                                  dimmed={item.done}
                                />
                                {timeSubtitle}
                                {carryFromNote(row)}
                              </button>
                            ) : (
                              <span
                                className={`min-w-0 flex-1 text-sm leading-snug ${
                                  item.done ? "line-through" : ""
                                }`}
                              >
                                <TaskTagPrefixes
                                  tags={item.tags}
                                  dimmed={item.done}
                                  separator={Boolean(item.text)}
                                />
                                <TaskRichText
                                  text={item.text}
                                  dimmed={item.done}
                                />
                                {timeSubtitle}
                                {carryFromNote(row)}
                              </span>
                            )}
                            <TaskEstimateInput
                              minutes={estimateMinutesFor(row)}
                              dimmed={item.done}
                              onChange={(minutes) =>
                                setRowEstimate(row, day.key, minutes)
                              }
                            />
                            {row.carry ? (
                              <button
                                type="button"
                                onClick={() => removeCarry(day.key, row)}
                                title="Remove from today"
                                className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                              >
                                Remove
                              </button>
                            ) : (
                              <RemoveSlotSpacer />
                            )}
                          </BoardRowLi>
                        );
                      }

                      const task = row.item;
                      return (
                        <BoardRowLi key={rowId} {...rowShell}>
                          <Checkbox
                            checked={task.done}
                            onCheckedChange={() =>
                              toggleBoardRow(day.key, row)
                            }
                            className="mt-0.5"
                            aria-label={`Mark ${taskBodyText(task)} complete`}
                          />
                          {editingTask?.day === day.key &&
                          editingTask.id === task.id &&
                          editingTask.source === "task" ? (
                              <div
                              className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 gap-y-1"
                              onBlur={(e) => {
                                if (
                                  !e.currentTarget.contains(
                                    e.relatedTarget as Node,
                                  )
                                ) {
                                  commitEditTask();
                                }
                              }}
                            >
                              {editingTask.tags.length > 0 && (
                                <span className="shrink-0 pt-1 text-sm leading-snug">
                                  <TaskTagPrefixes
                                    tags={editingTask.tags}
                                    separator={false}
                                  />
                                </span>
                              )}
                              <Input
                                autoFocus
                                value={editingTask.value}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  tagChipUndoRef.current = null;
                                  timeChipUndoRef.current = null;
                                  setEditingTask((cur) => {
                                    if (!cur) return cur;
                                    const next = { ...cur, value };
                                    editingTaskRef.current = next;
                                    return next;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    handleTimeChipKey(e, {
                                      key: `edit:${editingTask.id}`,
                                      value: editingTask.value,
                                      time: editingTask.time,
                                      undoRef: timeChipUndoRef,
                                      onChange: ({ value, time }) => {
                                        tagChipUndoRef.current = null;
                                        setEditingTask((cur) => {
                                          if (!cur) return cur;
                                          const next = { ...cur, value, time };
                                          editingTaskRef.current = next;
                                          return next;
                                        });
                                      },
                                    })
                                  ) {
                                    return;
                                  }
                                  if (
                                    handleTagChipKey(e, {
                                      key: `edit:${editingTask.id}`,
                                      value: editingTask.value,
                                      tags: editingTask.tags,
                                      undoRef: tagChipUndoRef,
                                      onChange: ({ value, tags }) => {
                                        timeChipUndoRef.current = null;
                                        setEditingTask((cur) => {
                                          if (!cur) return cur;
                                          const next = { ...cur, value, tags };
                                          editingTaskRef.current = next;
                                          return next;
                                        });
                                      },
                                    })
                                  ) {
                                    return;
                                  }
                                  if (
                                    handleTaskLinkKey(
                                      e,
                                      editingTask.value,
                                      (value) => {
                                        setEditingTask((cur) => {
                                          if (!cur) return cur;
                                          const next = { ...cur, value };
                                          editingTaskRef.current = next;
                                          return next;
                                        });
                                      },
                                      () => {
                                        suppressEditBlurRef.current = true;
                                      },
                                      () => {
                                        suppressEditBlurRef.current = false;
                                      },
                                    )
                                  ) {
                                    return;
                                  }
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitEditTask();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEditTask();
                                  }
                                }}
                                aria-label="Edit box text"
                                className="h-7 min-w-0 flex-1 basis-28 bg-white/90 text-sm"
                              />
                              <EditingTimeChip
                                time={editingTask.time}
                                onEdit={editStoredTime}
                              />
                              <BoxTagPicker
                                tags={editingTask.tags}
                                onChange={(tags) => {
                                  tagChipUndoRef.current = null;
                                  timeChipUndoRef.current = null;
                                  setEditingTags(tags);
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                beginEditTask(day.key, task, row.carry)
                              }
                              className={`min-w-0 flex-1 break-words rounded-sm text-left text-sm leading-snug outline-none hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring/50 ${
                                task.done ? "line-through" : ""
                              }`}
                            >
                              <TaskTagPrefixes
                                tags={task.tags}
                                dimmed={task.done}
                                separator={Boolean(taskBodyText(task))}
                              />
                              <TaskRichText
                                text={taskBodyText(task)}
                                dimmed={task.done}
                              />
                              {task.startTime ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  ({formatTimeRange(task.startTime, task.endTime)})
                                </span>
                              ) : null}
                              {carryFromNote(row)}
                            </button>
                          )}
                          <TaskEstimateInput
                            minutes={estimateMinutesFor(row)}
                            dimmed={task.done}
                            onChange={(minutes) =>
                              setRowEstimate(row, day.key, minutes)
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              row.carry
                                ? removeCarry(day.key, row)
                                : removeTask(day.key, task.id)
                            }
                            title={row.carry ? "Remove from today" : undefined}
                            className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                          >
                            Remove
                          </button>
                        </BoardRowLi>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2">
                  {draftTags[day.key].length > 0 && (
                    <span className="hidden shrink-0 text-sm leading-snug sm:inline">
                      <TaskTagPrefixes
                        tags={draftTags[day.key]}
                        separator={false}
                      />
                    </span>
                  )}
                  <Input
                    value={drafts[day.key]}
                    onChange={(e) => {
                      tagChipUndoRef.current = null;
                      timeChipUndoRef.current = null;
                      setDrafts((d) => ({ ...d, [day.key]: e.target.value }));
                    }}
                    onKeyDown={(e) => {
                      if (
                        handleTimeChipKey(e, {
                          key: `draft:${day.key}`,
                          value: drafts[day.key],
                          time: draftTimes[day.key],
                          undoRef: timeChipUndoRef,
                          onChange: ({ value, time }) => {
                            tagChipUndoRef.current = null;
                            setDrafts((d) => ({ ...d, [day.key]: value }));
                            setDraftTimes((d) => ({ ...d, [day.key]: time }));
                          },
                        })
                      ) {
                        return;
                      }
                      if (
                        handleTagChipKey(e, {
                          key: `draft:${day.key}`,
                          value: drafts[day.key],
                          tags: draftTags[day.key],
                          undoRef: tagChipUndoRef,
                          onChange: ({ value, tags }) => {
                            timeChipUndoRef.current = null;
                            setDrafts((d) => ({ ...d, [day.key]: value }));
                            setDraftTags((d) => ({ ...d, [day.key]: tags }));
                          },
                        })
                      ) {
                        return;
                      }
                      if (
                        handleTaskLinkKey(e, drafts[day.key], (value) =>
                          setDrafts((d) => ({ ...d, [day.key]: value })),
                        )
                      ) {
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTask(day.key);
                      }
                    }}
                    placeholder="Add box"
                    className="h-8 min-w-0 flex-1 basis-28 bg-white/80"
                  />
                  {draftTimes[day.key] ? (
                    <button
                      type="button"
                      title="Edit time"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const time = draftTimes[day.key];
                        if (!time) return;
                        const label = formatTimeRange(
                          time.startTime,
                          time.endTime,
                        );
                        if (!label) return;
                        const chunk = `(${label})`;
                        setDrafts((d) => {
                          const current = d[day.key].trim();
                          return {
                            ...d,
                            [day.key]: current
                              ? `${current} ${chunk}`
                              : chunk,
                          };
                        });
                        setDraftTimes((d) => ({ ...d, [day.key]: null }));
                        timeChipUndoRef.current = null;
                      }}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      (
                      {formatTimeRange(
                        draftTimes[day.key]!.startTime,
                        draftTimes[day.key]!.endTime,
                      )}
                      )
                    </button>
                  ) : null}
                  <BoxTagPicker
                    tags={draftTags[day.key]}
                    onChange={(tags) => {
                      tagChipUndoRef.current = null;
                      setDraftTags((d) => ({ ...d, [day.key]: tags }));
                    }}
                  />
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => addTask(day.key)}
                    aria-label={`Add priority for ${day.label}`}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10 animate-rise-delay-2">
        <button
          type="button"
          onClick={() => setMissedOpen((v) => !v)}
          aria-expanded={missedOpen}
          className="mb-4 flex items-center gap-2 text-left"
        >
          <ChevronDown
            className={`size-5 shrink-0 text-muted-foreground transition-transform ${
              missedOpen ? "" : "-rotate-90"
            }`}
            aria-hidden
          />
          <h3 className="font-heading text-2xl font-semibold text-ink">
            Missed
          </h3>
          {!missedOpen && missedBoxes.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {missedBoxes.length}
            </span>
          ) : null}
        </button>
        {missedOpen ? (
          missedBoxes.length === 0 ? (
            <p className="rounded-xl border border-border/70 bg-white/65 px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm">
              No missed boxes from past days or weeks.
            </p>
          ) : (
            <ul className="space-y-2">
              {missedBoxes.map(({ key, weekOf: missedWeek, day, dateLabel, row, csWeek: missedCsWeek }) => {
                const tags = rowSortKey(row, missedCsWeek).tags;
                const label = boardRowLabel(row);
                const timeNote =
                  (row.kind === "event" ||
                    row.kind === "routine" ||
                    row.kind === "task") &&
                  row.item.startTime
                    ? formatTimeRange(row.item.startTime, row.item.endTime)
                    : null;
                const csNote =
                  row.kind === "cs" && missedCsWeek != null
                    ? dueNoteForWeek(row.item, missedCsWeek)
                    : row.kind === "cs"
                      ? row.item.dueNote
                      : null;
                return (
                  <li
                    key={key}
                    onContextMenu={(event) =>
                      openBoxMenu(event, day, row, missedWeek)
                    }
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-white/65 px-4 py-3 backdrop-blur-sm"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() =>
                        toggleMissedBox(missedWeek, day, row)
                      }
                      className="mt-0.5"
                      aria-label={`Mark ${label} complete`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {dateLabel}
                      </p>
                      <p className="text-sm leading-snug text-foreground">
                        <TaskTagPrefixes tags={tags} separator={Boolean(label)} />
                        <span>{label}</span>
                        {timeNote ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({timeNote})
                          </span>
                        ) : null}
                        {csNote ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({csNote})
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {(() => {
                      const entry = { weekOf: missedWeek, day, row };
                      const carried = isMissedBoxCarriedToToday(entry);
                      const onToday = missedBoxOnToday(entry);
                      if (onToday && !carried) {
                        return (
                          <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                            On today
                          </span>
                        );
                      }
                      return (
                        <Button
                          type="button"
                          variant={carried ? "secondary" : "outline"}
                          size="sm"
                          className="shrink-0"
                          aria-pressed={carried}
                          onClick={() => toggleMissedBoxOnToday(entry)}
                        >
                          {carried ? "On today" : "Add to today"}
                        </Button>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </section>

      <section className="mt-10">
        <WeeklyRoutinesPanel />
      </section>
      {boxMenu && !menuRow ? (
        <DismissBoxMenu onDismiss={closeBoxMenu} />
      ) : null}
      {boxMenu && menuRow && menuActions ? (
        <BoxContextMenu
          key={`${boxMenu.viewWeek}:${boxMenu.viewDay}:${boxMenu.rowId}:${boxMenu.x}:${boxMenu.y}`}
          x={boxMenu.x}
          y={boxMenu.y}
          minutes={estimateMinutesFor(menuRow, boxMenu.viewWeek)}
          time={menuActions.time}
          tags={menuActions.tags}
          canTime={menuActions.canTime}
          canTags={menuActions.canTags}
          scopeNote={menuActions.scopeNote}
          onDuration={(minutes) =>
            setRowEstimate(
              menuRow,
              boxMenu.viewDay,
              minutes,
              boxMenu.viewWeek,
            )
          }
          onTime={(time) =>
            setRowTime(menuRow, boxMenu.viewDay, time, boxMenu.viewWeek)
          }
          onTags={(tags) =>
            setRowTags(menuRow, boxMenu.viewDay, tags, boxMenu.viewWeek)
          }
          onClose={closeBoxMenu}
        />
      ) : null}
    </div>
  );
}
