"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  List,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BoxTagPicker, TaskTagPrefixes } from "@/components/box-tag-picker";
import { useTags } from "@/components/tags-provider";
import { BoxTag, normalizeTaskTags } from "@/lib/box-tags";
import {
  DEFAULT_CALENDAR_WEEK_START,
  calendarWeekdayHeaders,
  loadCalendarWeekStart,
  subscribeCalendarWeekStart,
} from "@/lib/calendar-week-start";
import { DAYS, DayKey, createId } from "@/lib/week-plan";
import {
  BoardPlacementRelative,
  BoardPlacementRule,
  DueCourse,
  DueEvent,
  DueEventInstance,
  OTHER_COURSE,
  CalendarCourseUndo,
  applyCalendarCourseFromSpace,
  deleteDueEvent,
  dueCourseColor,
  eventCoversDate,
  excludeEventOccurrence,
  expandEventInstances,
  findEventById,
  formatMonthLabel,
  initDueEventsStore,
  isMultiDayInstance,
  layoutMonthSpanSegments,
  listDueCourses,
  listDueEvents,
  monthGridDays,
  monthKeyFromDate,
  restoreEventOccurrence,
  saveDueEvent,
  shiftMonth,
  tagForDueCourse,
  todayDateString,
} from "@/lib/due-events";
import {
  endTimePreservingDuration,
  formatTimeRange,
  formatDuration,
  parseDuration,
} from "@/lib/task-time";

type DraftOccurrence = {
  /** Client-only key for list editing. */
  key: string;
  date: string;
  startTime: string;
  endTime: string;
};

type Draft = {
  id?: string;
  title: string;
  detail: string;
  date: string;
  endDate: string;
  course: DueCourse;
  startTime: string;
  endTime: string;
  appearOnBoard: boolean;
  weekly: boolean;
  custom: boolean;
  until: string;
  autoNumber: boolean;
  excludedDates: string[];
  /** Extra dates for a custom series (beyond the master date). */
  customOccurrences: DraftOccurrence[];
  /** Occurrence date when opened from a day cell / deep link. */
  instanceDate?: string;
  rules: BoardPlacementRule[];
};

function emptyDraft(date: string): Draft {
  return {
    title: "",
    detail: "",
    date,
    endDate: "",
    course: OTHER_COURSE,
    startTime: "",
    endTime: "",
    appearOnBoard: false,
    weekly: false,
    custom: false,
    until: "",
    autoNumber: false,
    excludedDates: [],
    customOccurrences: [],
    rules: [],
  };
}

function draftFromEvent(event: DueEvent, instanceDate?: string): Draft {
  const custom =
    event.recurrence?.frequency === "custom"
      ? event.recurrence.occurrences.map((o) => ({
          key: createId(),
          date: o.date,
          startTime: o.startTime ?? "",
          endTime: o.endTime ?? "",
        }))
      : [];
  return {
    id: event.id,
    title: event.title,
    detail: event.detail,
    date: event.date,
    endDate: event.endDate ?? "",
    course: event.course,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    appearOnBoard: !!event.appearOnBoard,
    weekly: event.recurrence?.frequency === "weekly",
    custom: event.recurrence?.frequency === "custom",
    until:
      event.recurrence?.frequency === "weekly"
        ? (event.recurrence.until ?? "")
        : "",
    autoNumber: !!event.autoNumber,
    excludedDates: [...(event.excludedDates ?? [])],
    customOccurrences: custom,
    instanceDate,
    rules: [...(event.rules ?? [])],
  };
}

function draftPayload(draft: Draft, asNew: boolean) {
  const recurrence = draft.weekly
    ? {
        frequency: "weekly" as const,
        until: draft.until || undefined,
      }
    : draft.custom
      ? {
          frequency: "custom" as const,
          occurrences: draft.customOccurrences
            .filter((o) => o.date && o.date !== draft.date)
            .map((o) => ({
              date: o.date,
              ...(o.startTime ? { startTime: o.startTime } : {}),
              ...(o.endTime ? { endTime: o.endTime } : {}),
            })),
        }
      : null;
  const isSeries = draft.weekly || draft.custom;
  return {
    id: asNew ? undefined : draft.id,
    title: draft.title,
    detail: draft.detail,
    date: draft.date,
    endDate: draft.endDate || undefined,
    course: draft.course,
    startTime: draft.startTime || undefined,
    endTime: draft.endTime || undefined,
    appearOnBoard: draft.appearOnBoard,
    rules: (asNew
      ? draft.rules.map((rule) => ({ ...rule, id: createId() }))
      : draft.rules
    ).map((rule) => ({
      ...rule,
      text: rule.text.trim(),
      tags: normalizeTaskTags(rule.tags),
    })),
    recurrence,
    autoNumber: isSeries ? draft.autoNumber : false,
    excludedDates: isSeries ? draft.excludedDates : [],
  };
}

function emptyRule(course: DueCourse): BoardPlacementRule {
  const tag = tagForDueCourse(course);
  return {
    id: createId(),
    relative: "weekOf",
    day: "saturday",
    text: "",
    tags: tag ? normalizeTaskTags([tag]) : [],
  };
}

function dayNumber(date: string): string {
  return String(Number(date.slice(8, 10)));
}

function formatDayHeading(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type EventKindFilter = "all" | "weekly" | "once";

const KIND_FILTERS: { id: EventKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "weekly", label: "Series" },
  { id: "once", label: "One-time" },
];

function instanceMatches(
  event: DueEventInstance,
  query: string,
  courses: readonly DueCourse[],
  kind: EventKindFilter,
): boolean {
  if (courses.length > 0 && !courses.includes(event.course)) return false;
  const series = !!event.recurrence;
  if (kind === "weekly" && !series) return false;
  if (kind === "once" && series) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const ruleText = (event.rules ?? []).map((rule) => rule.text).join(" ");
  return `${event.title} ${event.detail} ${event.course} ${ruleText}`
    .toLowerCase()
    .includes(q);
}

function seriesLabel(event: Pick<DueEvent, "recurrence">): string {
  if (event.recurrence?.frequency === "weekly") return " · weekly";
  if (event.recurrence?.frequency === "custom") return " · custom";
  return "";
}

/** Compact duration field for a board-box rule (`2h`, `45m`). */
function RuleEstimateInput({
  minutes,
  onChange,
}: {
  minutes?: number;
  onChange: (minutes: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(
    minutes && minutes > 0 ? formatDuration(minutes) : "",
  );

  useEffect(() => {
    setDraft(minutes && minutes > 0 ? formatDuration(minutes) : "");
  }, [minutes]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      onChange(undefined);
      setDraft("");
      return;
    }
    const parsed = parseDuration(trimmed);
    if (parsed === null) {
      setDraft(minutes && minutes > 0 ? formatDuration(minutes) : "");
      return;
    }
    onChange(parsed);
    setDraft(formatDuration(parsed));
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(minutes && minutes > 0 ? formatDuration(minutes) : "");
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="2h"
      aria-label="Default box duration"
      title="Default time for every occurrence"
      className="h-8 w-14 shrink-0 bg-white px-1.5 text-center text-xs tabular-nums"
    />
  );
}

export function DueCalendar() {
  const { tags } = useTags();
  const courses = useMemo(() => listDueCourses(), [tags]);
  const [events, setEvents] = useState<DueEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [monthKey, setMonthKey] = useState(() => monthKeyFromDate());
  const [selectedDate, setSelectedDate] = useState(() => todayDateString());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<DueCourse[]>([]);
  const [kindFilter, setKindFilter] = useState<EventKindFilter>("all");
  const [listView, setListView] = useState(false);
  const [weekStartsOn, setWeekStartsOn] = useState<DayKey>(
    DEFAULT_CALENDAR_WEEK_START,
  );
  const courseTagUndoRef = useRef<CalendarCourseUndo | null>(null);
  const draftKey = draft ? (draft.id ?? `new:${draft.date}`) : "";
  useEffect(() => {
    courseTagUndoRef.current = null;
  }, [draftKey]);

  useEffect(() => {
    setCourseFilter((current) =>
      current.filter((course) => courses.includes(course)),
    );
  }, [courses]);

  async function refresh() {
    const list = await listDueEvents();
    setEvents(list);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initDueEventsStore();
      if (cancelled) return;
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || deepLinkHandled || events.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    const date = params.get("date");
    if (!eventId) {
      setDeepLinkHandled(true);
      return;
    }
    const master = findEventById(events, eventId);
    if (!master) {
      setDeepLinkHandled(true);
      return;
    }
    const instanceDate =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : master.date;
    setSelectedDate(instanceDate);
    setMonthKey(monthKeyFromDate(new Date(`${instanceDate}T12:00:00`)));
    setDraft(draftFromEvent(master, instanceDate));
    setDeepLinkHandled(true);
  }, [ready, events, deepLinkHandled]);

  useEffect(() => {
    let cancelled = false;
    void loadCalendarWeekStart().then((day) => {
      if (!cancelled) setWeekStartsOn(day);
    });
    const unsubscribe = subscribeCalendarWeekStart((day) => {
      if (!cancelled) setWeekStartsOn(day);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const instances = useMemo(() => expandEventInstances(events), [events]);
  const cells = useMemo(
    () => monthGridDays(monthKey, weekStartsOn),
    [monthKey, weekStartsOn],
  );
  const weekdayHeaders = useMemo(
    () => calendarWeekdayHeaders(weekStartsOn),
    [weekStartsOn],
  );
  const weekRows = useMemo(() => {
    const rows: { date: string; inMonth: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);
  const spanSegments = useMemo(
    () => layoutMonthSpanSegments(events, cells),
    [events, cells],
  );
  const singleDayByDate = useMemo(() => {
    const map = new Map<string, DueEventInstance[]>();
    for (const e of instances) {
      if (isMultiDayInstance(e)) continue;
      const list = map.get(e.instanceDate) ?? [];
      list.push(e);
      map.set(e.instanceDate, list);
    }
    return map;
  }, [instances]);

  const filtersActive =
    query.trim().length > 0 || courseFilter.length > 0 || kindFilter !== "all";
  const showList = filtersActive && listView;

  const filteredInstances = useMemo(
    () =>
      instances.filter((event) =>
        instanceMatches(event, query, courseFilter, kindFilter),
      ),
    [instances, query, courseFilter, kindFilter],
  );

  const matchGroups = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      items: DueEventInstance[];
    }[] = [];
    const index = new Map<string, number>();
    for (const event of filteredInstances) {
      const key = event.instanceDate.slice(0, 7);
      let groupIndex = index.get(key);
      if (groupIndex === undefined) {
        groupIndex = groups.length;
        index.set(key, groupIndex);
        groups.push({ key, label: formatMonthLabel(key), items: [] });
      }
      groups[groupIndex]!.items.push(event);
    }
    return groups;
  }, [filteredInstances]);

  const filteredSpanKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const event of filteredInstances) {
      if (!isMultiDayInstance(event)) continue;
      keys.add(`${event.seriesId}:${event.instanceDate}`);
    }
    return keys;
  }, [filteredInstances]);

  const visibleSpanSegments = useMemo(
    () =>
      filtersActive
        ? spanSegments.filter((seg) =>
            filteredSpanKeys.has(`${seg.seriesId}:${seg.instanceDate}`),
          )
        : spanSegments,
    [filtersActive, spanSegments, filteredSpanKeys],
  );

  const visibleSingleDayByDate = useMemo(() => {
    if (!filtersActive) return singleDayByDate;
    const map = new Map<string, DueEventInstance[]>();
    for (const event of filteredInstances) {
      if (isMultiDayInstance(event)) continue;
      const list = map.get(event.instanceDate) ?? [];
      list.push(event);
      map.set(event.instanceDate, list);
    }
    return map;
  }, [filtersActive, filteredInstances, singleDayByDate]);

  const monthMatches = useMemo(() => {
    const inMonth = cells.filter((cell) => cell.inMonth);
    const first = inMonth[0]?.date;
    const last = inMonth[inMonth.length - 1]?.date;
    if (!first || !last) return [];
    return filteredInstances.filter(
      (event) => event.instanceDate <= last && event.instanceEndDate >= first,
    );
  }, [cells, filteredInstances]);

  const matchDates = useMemo(() => {
    const dates: string[] = [];
    const seen = new Set<string>();
    for (const event of filteredInstances) {
      if (seen.has(event.instanceDate)) continue;
      seen.add(event.instanceDate);
      dates.push(event.instanceDate);
    }
    return dates;
  }, [filteredInstances]);

  const dayEvents = useMemo(() => {
    const source = filtersActive ? filteredInstances : instances;
    return source
      .filter((event) => eventCoversDate(event, selectedDate))
      .sort((a, b) =>
        a.instanceDate === b.instanceDate
          ? a.title.localeCompare(b.title)
          : a.instanceDate.localeCompare(b.instanceDate),
      );
  }, [filtersActive, filteredInstances, instances, selectedDate]);

  const today = todayDateString();

  function selectDay(date: string) {
    setSelectedDate(date);
    setDraft(null);
  }

  function toggleCourse(course: DueCourse) {
    setCourseFilter((current) =>
      current.includes(course)
        ? current.filter((item) => item !== course)
        : [...current, course],
    );
  }

  function clearFilters() {
    setQuery("");
    setCourseFilter([]);
    setKindFilter("all");
    setListView(false);
  }

  function openMatch(event: DueEventInstance) {
    setSelectedDate(event.instanceDate);
    setMonthKey(monthKeyFromDate(new Date(`${event.instanceDate}T12:00:00`)));
    const master = findEventById(events, event.seriesId) ?? event;
    setDraft(draftFromEvent(master, event.instanceDate));
  }

  function jumpToDate(date: string) {
    setSelectedDate(date);
    setMonthKey(monthKeyFromDate(new Date(`${date}T12:00:00`)));
    setDraft(null);
  }

  function shiftMatch(delta: number) {
    if (matchDates.length === 0) return;
    const exact = matchDates.indexOf(selectedDate);
    let index: number;
    if (exact >= 0) {
      index = (exact + delta + matchDates.length) % matchDates.length;
    } else if (delta > 0) {
      const next = matchDates.findIndex((date) => date > selectedDate);
      index = next < 0 ? 0 : next;
    } else {
      let prev = -1;
      for (let i = 0; i < matchDates.length; i++) {
        if (matchDates[i]! < selectedDate) prev = i;
      }
      index = prev < 0 ? matchDates.length - 1 : prev;
    }
    const date = matchDates[index];
    if (date) jumpToDate(date);
  }

  function openNew() {
    courseTagUndoRef.current = null;
    setDraft(emptyDraft(selectedDate));
  }

  function openEdit(event: DueEventInstance) {
    const master = findEventById(events, event.seriesId) ?? event;
    setDraft(draftFromEvent(master, event.instanceDate));
  }

  function openSpan(seriesId: string, instanceDate: string) {
    const master = findEventById(events, seriesId);
    if (!master) return;
    setSelectedDate(instanceDate);
    setDraft(draftFromEvent(master, instanceDate));
  }

  async function handleSave() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await saveDueEvent(draftPayload(draft, false));
      await refresh();
      setSelectedDate(draft.date);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  /** Saves a new event with these details and opens it in the editor. */
  async function handleCopy(source: Draft) {
    if (!source.title.trim() || saving) return;
    setSaving(true);
    try {
      const saved = await saveDueEvent(draftPayload(source, true));
      await refresh();
      setSelectedDate(saved.date);
      setMonthKey(monthKeyFromDate(new Date(`${saved.date}T12:00:00`)));
      setDraft(draftFromEvent(saved));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const id = draft?.id;
    if (!id || saving) return;
    setSaving(true);
    try {
      await deleteDueEvent(id);
      await refresh();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveOccurrence() {
    if (!draft?.id || !draft.instanceDate || saving) return;
    setSaving(true);
    try {
      await excludeEventOccurrence(draft.id, draft.instanceDate);
      await refresh();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreOccurrence(date: string) {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const next = await restoreEventOccurrence(draft.id, date);
      await refresh();
      if (next) {
        setDraft(draftFromEvent(next, draft.instanceDate));
      }
    } finally {
      setSaving(false);
    }
  }

  function updateRule(id: string, patch: Partial<BoardPlacementRule>) {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        rules: d.rules.map((r) => {
          if (r.id !== id) return r;
          const next: BoardPlacementRule = { ...r, ...patch };
          if (
            "estimateMinutes" in patch &&
            !(patch.estimateMinutes && patch.estimateMinutes > 0)
          ) {
            delete next.estimateMinutes;
          }
          if ("startTime" in patch && !patch.startTime) {
            delete next.startTime;
          }
          if ("endTime" in patch && !patch.endTime) {
            delete next.endTime;
          }
          return next;
        }),
      };
    });
  }

  const canRemoveOccurrence =
    !!draft?.id &&
    (draft.weekly || draft.custom) &&
    !!draft.instanceDate &&
    !draft.excludedDates.includes(draft.instanceDate);

  useEffect(() => {
    if (!showList) return;
    document
      .getElementById("calendar-match-selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [showList, selectedDate]);

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-muted-foreground">Loading calendar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium tracking-[0.2em] text-seafoam uppercase">
            {process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
              ? "Calendar"
              : // eslint-disable-next-line @typescript-eslint/no-require-imports
                require("@/lib/personal/labels").personalCalendarEyebrow()}
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Due dates
          </h1>
          <p className="mt-2 max-w-lg text-muted-foreground">
            Search titles and notes, or filter by course. Click a day to review,
            or open an event to edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showList ? (
            <p className="font-heading text-lg font-semibold text-ink">
              All matches
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft />
              </Button>
              <p className="min-w-[10rem] text-center font-heading text-lg font-semibold text-ink">
                {formatMonthLabel(monthKey)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border/70 bg-white/65 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setQuery("");
                } else if (e.key === "Enter" && filtersActive) {
                  e.preventDefault();
                  shiftMatch(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Search titles, notes, courses…"
              aria-label="Search due dates"
              className="bg-white/80 pr-8 pl-8"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div
            className="flex shrink-0 rounded-lg border border-border/70 bg-white/70 p-0.5"
            role="group"
            aria-label="Event type"
          >
            {KIND_FILTERS.map((kind) => {
              const selected = kindFilter === kind.id;
              return (
                <button
                  key={kind.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setKindFilter(kind.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? "bg-ink text-primary-foreground"
                      : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  {kind.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {courses.map((course) => {
            const on = courseFilter.includes(course);
            return (
              <button
                key={course}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCourse(course)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  on
                    ? "text-ink"
                    : "border-border/70 bg-white/50 text-muted-foreground hover:bg-white hover:text-ink"
                }`}
                style={
                  on
                    ? {
                        borderColor: dueCourseColor(course),
                        backgroundColor: `${dueCourseColor(course)}22`,
                      }
                    : undefined
                }
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: dueCourseColor(course) }}
                />
                {course}
              </button>
            );
          })}
        </div>
        {filtersActive ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filteredInstances.length === 0
                ? "No matching dues"
                : `${filteredInstances.length} matching ${
                    filteredInstances.length === 1 ? "due" : "dues"
                  }${
                    monthMatches.length === filteredInstances.length
                      ? ""
                      : ` · ${monthMatches.length} this month`
                  }`}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={listView ? "secondary" : "outline"}
                size="sm"
                aria-pressed={listView}
                onClick={() => setListView((on) => !on)}
              >
                <List data-icon="inline-start" />
                {listView ? "Calendar" : "List"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Previous match"
                disabled={matchDates.length === 0}
                onClick={() => shiftMatch(-1)}
              >
                <ChevronLeft data-icon="inline-start" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Next match"
                disabled={matchDates.length === 0}
                onClick={() => shiftMatch(1)}
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`grid gap-6 ${
          showList && !draft
            ? ""
            : "lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]"
        }`}
      >
        {showList ? (
          <div className="animate-rise rounded-2xl border border-border/70 bg-white/65 p-3 backdrop-blur-sm sm:p-4">
            {filteredInstances.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                No matching dues
              </p>
            ) : (
              <div className="max-h-[36rem] overflow-y-auto">
                {matchGroups.map((group) => (
                  <section key={group.key} className="mb-3 last:mb-0">
                    <h2 className="sticky top-0 z-10 bg-white/90 px-2 py-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur-sm">
                      {group.label}
                    </h2>
                    <ul className="flex flex-col gap-1">
                      {group.items.map((event) => {
                        const active =
                          (draft?.id === event.seriesId &&
                            draft.instanceDate === event.instanceDate) ||
                          (!draft && event.instanceDate === selectedDate);
                        return (
                          <li key={`${event.seriesId}:${event.instanceDate}`}>
                            <button
                              type="button"
                              id={
                                event ===
                                group.items.find(
                                  (item) => item.instanceDate === selectedDate,
                                )
                                  ? "calendar-match-selected"
                                  : undefined
                              }
                              onClick={() => openMatch(event)}
                              aria-current={active ? "true" : undefined}
                              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                active
                                  ? "border-seafoam/60 bg-seafoam/10"
                                  : "border-transparent bg-white/40 hover:border-seafoam/40 hover:bg-white/80"
                              }`}
                            >
                              <span
                                className="mt-1.5 size-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: dueCourseColor(event.course),
                                }}
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className="block text-xs font-semibold tracking-wider uppercase"
                                  style={{ color: dueCourseColor(event.course) }}
                                >
                                  {event.course}
                                  {seriesLabel(event)}
                                  {event.appearOnBoard ? " · on board" : ""}
                                </span>
                                <span className="block font-medium text-ink">
                                  {event.title}
                                </span>
                                {event.detail ? (
                                  <span className="block truncate text-sm text-muted-foreground">
                                    {event.detail}
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-right text-xs text-muted-foreground">
                                <span className="block">
                                  {isMultiDayInstance(event)
                                    ? `${formatShortDate(event.instanceDate)}–${formatShortDate(event.instanceEndDate)}`
                                    : formatShortDate(event.instanceDate)}
                                </span>
                                {event.startTime ? (
                                  <span className="mt-0.5 block">
                                    {formatTimeRange(
                                      event.startTime,
                                      event.endTime,
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-rise rounded-2xl border border-border/70 bg-white/65 p-3 backdrop-blur-sm sm:p-4">
          <div className="mb-1 grid grid-cols-7 gap-px">
            {weekdayHeaders.map((day) => (
              <div
                key={day.key}
                className="py-1 text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {day.short}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {weekRows.map((week, weekIndex) => {
              const weekSpans = visibleSpanSegments.filter(
                (s) => s.weekIndex === weekIndex,
              );
              const laneCount =
                weekSpans.reduce((max, s) => Math.max(max, s.lane + 1), 0) || 0;
              return (
                <div
                  key={week[0]?.date ?? weekIndex}
                  className="rounded-xl border border-border/40 bg-white/40"
                >
                  <div className="grid grid-cols-7 gap-px">
                    {week.map((cell) => {
                      const singles = visibleSingleDayByDate.get(cell.date) ?? [];
                      const selected = cell.date === selectedDate;
                      const isToday = cell.date === today;
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          onClick={() => selectDay(cell.date)}
                          className={`flex min-h-[3.25rem] flex-col items-start px-1.5 py-1 text-left transition-colors sm:min-h-[3.5rem] ${
                            selected
                              ? "bg-seafoam/15"
                              : isToday
                                ? "bg-glow/15"
                                : "hover:bg-white/80"
                          } ${cell.inMonth ? "text-ink" : "text-muted-foreground/50"}`}
                        >
                          <span
                            className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-medium sm:size-7 sm:text-sm ${
                              isToday ? "bg-ink text-primary-foreground" : ""
                            }`}
                          >
                            {dayNumber(cell.date)}
                          </span>
                          {singles.length > 0 && (
                            <span className="mt-auto flex flex-wrap gap-0.5 pb-0.5">
                              {singles.slice(0, 3).map((ev) => (
                                <span
                                  key={`${ev.seriesId}:${ev.instanceDate}`}
                                  className="size-1.5 rounded-full"
                                  style={{
                                    backgroundColor: dueCourseColor(ev.course),
                                  }}
                                  title={ev.title}
                                />
                              ))}
                              {singles.length > 3 && (
                                <span className="text-[10px] leading-none text-muted-foreground">
                                  +{singles.length - 3}
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {laneCount > 0 && (
                    <div
                      className="relative mx-0.5 mb-1 grid grid-cols-7 gap-x-0.5"
                      style={{
                        gridTemplateRows: `repeat(${laneCount}, 0.375rem)`,
                        minHeight: `${laneCount * 0.375 + (laneCount - 1) * 0.125}rem`,
                        rowGap: "0.125rem",
                      }}
                    >
                      {weekSpans.map((seg) => (
                        <button
                          key={`${seg.seriesId}:${seg.instanceDate}:${seg.weekIndex}:${seg.lane}`}
                          type="button"
                          title={seg.title}
                          aria-label={seg.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            openSpan(seg.seriesId, seg.instanceDate);
                          }}
                          className={`z-10 h-1.5 transition-opacity hover:opacity-80 ${
                            seg.continuesBefore
                              ? "rounded-l-none"
                              : "rounded-l-full"
                          } ${
                            seg.continuesAfter
                              ? "rounded-r-none"
                              : "rounded-r-full"
                          }`}
                          style={{
                            gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                            gridRow: seg.lane + 1,
                            backgroundColor: dueCourseColor(seg.course),
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        <aside
          className={`animate-rise-delay-1 flex min-h-[20rem] flex-col rounded-2xl border border-border/70 bg-white/65 p-4 backdrop-blur-sm ${
            showList && !draft ? "hidden" : ""
          }`}
        >
          {draft ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-ink">
                    {draft.id ? "Edit due" : "New due"}
                  </h2>
                  {draft.id && (draft.weekly || draft.custom) ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Series schedule
                      {draft.instanceDate
                        ? ` · opened from ${formatShortDate(draft.instanceDate)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close editor"
                  onClick={() => setDraft(null)}
                >
                  <X />
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink">Title</span>
                  <Input
                    value={draft.title}
                    onChange={(e) => {
                      courseTagUndoRef.current = null;
                      setDraft((d) => (d ? { ...d, title: e.target.value } : d));
                    }}
                    onKeyDown={(e) => {
                      const value = draft.title;
                      const input = e.currentTarget;
                      const start = input.selectionStart ?? value.length;
                      const end = input.selectionEnd ?? start;

                      if (
                        e.key === " " &&
                        !e.ctrlKey &&
                        !e.metaKey &&
                        !e.altKey
                      ) {
                        if (start !== end) {
                          courseTagUndoRef.current = null;
                          return;
                        }
                        const applied = applyCalendarCourseFromSpace(
                          value,
                          start,
                          draft.course,
                        );
                        if (!applied) {
                          courseTagUndoRef.current = null;
                          return;
                        }
                        e.preventDefault();
                        courseTagUndoRef.current = applied.undo;
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                title: applied.title,
                                course: applied.course,
                              }
                            : d,
                        );
                        requestAnimationFrame(() => {
                          input.focus();
                          input.setSelectionRange(applied.cursor, applied.cursor);
                        });
                        return;
                      }

                      if (
                        e.key === "Backspace" &&
                        !e.ctrlKey &&
                        !e.metaKey &&
                        !e.altKey &&
                        courseTagUndoRef.current
                      ) {
                        const undo = courseTagUndoRef.current;
                        e.preventDefault();
                        courseTagUndoRef.current = null;
                        setDraft((d) =>
                          d
                            ? { ...d, title: undo.title, course: undo.course }
                            : d,
                        );
                        requestAnimationFrame(() => {
                          input.focus();
                          input.setSelectionRange(undo.cursor, undo.cursor);
                        });
                        return;
                      }

                      if (
                        e.key.length === 1 ||
                        e.key === "Delete" ||
                        e.key === "Enter"
                      ) {
                        courseTagUndoRef.current = null;
                      }
                    }}
                    placeholder={
                      process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
                        ? "e.g. Essay draft"
                        : // eslint-disable-next-line @typescript-eslint/no-require-imports
                          require("@/lib/personal/labels").personalEventPlaceholder()
                    }
                    className="bg-white/80"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink">
                    {draft.weekly || draft.custom ? "Starts on" : "Date"}
                  </span>
                  <DateInput
                    value={draft.date}
                    onChange={(date) =>
                      setDraft((d) => {
                        if (!d) return d;
                        const endDate =
                          d.endDate && d.endDate < date ? "" : d.endDate;
                        return { ...d, date, endDate };
                      })
                    }
                    className="bg-white/80"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink">
                    Ends on
                    <span className="ml-1 font-normal text-muted-foreground">
                      (optional, multi-day)
                    </span>
                  </span>
                  <DateInput
                    value={draft.endDate}
                    min={draft.date}
                    onChange={(endDate) =>
                      setDraft((d) => (d ? { ...d, endDate } : d))
                    }
                    className="bg-white/80"
                  />
                  {draft.endDate && draft.endDate > draft.date ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Draws a colored bar across these days
                      {draft.weekly || draft.custom
                        ? " for each occurrence"
                        : ""}
                      .
                    </p>
                  ) : null}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink">Tag</span>
                  <select
                    value={draft.course}
                    aria-label="Tag"
                    onChange={(e) => {
                      courseTagUndoRef.current = null;
                      setDraft((d) =>
                        d
                          ? { ...d, course: e.target.value as DueCourse }
                          : d,
                      );
                    }}
                    className="h-8 w-full rounded-lg border border-input bg-white/80 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {(courses.includes(draft.course)
                      ? courses
                      : [draft.course, ...courses]
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-ink">
                      Start time
                      <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </span>
                    <Input
                      type="time"
                      value={draft.startTime}
                      onChange={(e) =>
                        setDraft((d) => {
                          if (!d) return d;
                          const startTime = e.target.value;
                          const endTime = endTimePreservingDuration(
                            d.startTime,
                            d.endTime,
                            startTime,
                          );
                          return {
                            ...d,
                            startTime,
                            ...(endTime ? { endTime } : {}),
                          };
                        })
                      }
                      className="w-[7.5rem] bg-white/80"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-ink">
                      End time
                      <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </span>
                    <Input
                      type="time"
                      value={draft.endTime}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, endTime: e.target.value } : d,
                        )
                      }
                      className="w-[7.5rem] bg-white/80"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink">Detail</span>
                  <Textarea
                    value={draft.detail}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, detail: e.target.value } : d,
                      )
                    }
                    placeholder="Notes…"
                    className="min-h-16 resize-y bg-white/80"
                  />
                </label>

                <div className="rounded-xl border border-border/60 bg-white/50 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={draft.weekly}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                weekly: e.target.checked,
                                custom: e.target.checked ? false : d.custom,
                              }
                            : d,
                        )
                      }
                      className="size-4 rounded border-input"
                    />
                    Repeat weekly
                  </label>
                  {draft.weekly && (
                    <>
                      <label className="mt-2 block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Until (optional)
                        </span>
                        <DateInput
                          value={draft.until}
                          onChange={(until) =>
                            setDraft((d) => (d ? { ...d, until } : d))
                          }
                          className="bg-white/80"
                        />
                      </label>
                    </>
                  )}

                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={draft.custom}
                      onChange={(e) =>
                        setDraft((d) => {
                          if (!d) return d;
                          const custom = e.target.checked;
                          return {
                            ...d,
                            custom,
                            weekly: custom ? false : d.weekly,
                            customOccurrences:
                              custom && d.customOccurrences.length === 0
                                ? [
                                    {
                                      key: createId(),
                                      date: "",
                                      startTime: d.startTime,
                                      endTime: d.endTime,
                                    },
                                  ]
                                : d.customOccurrences,
                          };
                        })
                      }
                      className="size-4 rounded border-input"
                    />
                    Custom dates
                  </label>
                  {draft.custom && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Add every other date and time for this series. The
                        start date and time above count as the first. Opening
                        any occurrence edits this whole schedule.
                      </p>
                      <ul className="space-y-2">
                        {draft.customOccurrences.map((slot) => {
                          const isOpen =
                            !!draft.instanceDate &&
                            slot.date === draft.instanceDate;
                          return (
                          <li
                            key={slot.key}
                            className={`flex flex-wrap items-end gap-2 rounded-lg border bg-white/80 p-2 ${
                              isOpen
                                ? "border-seafoam/60 ring-1 ring-seafoam/30"
                                : "border-border/50"
                            }`}
                          >
                            <label className="text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Date
                                {isOpen ? " · this one" : ""}
                              </span>
                              <DateInput
                                value={slot.date}
                                onChange={(date) => {
                                  setDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          customOccurrences:
                                            d.customOccurrences.map((o) =>
                                              o.key === slot.key
                                                ? { ...o, date }
                                                : o,
                                            ),
                                        }
                                      : d,
                                  );
                                }}
                                className="bg-white"
                              />
                            </label>
                            <label className="text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Start
                              </span>
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => {
                                  const startTime = e.target.value;
                                  setDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          customOccurrences:
                                            d.customOccurrences.map((o) => {
                                              if (o.key !== slot.key) return o;
                                              const endTime =
                                                endTimePreservingDuration(
                                                  o.startTime,
                                                  o.endTime,
                                                  startTime,
                                                );
                                              return {
                                                ...o,
                                                startTime,
                                                ...(endTime
                                                  ? { endTime }
                                                  : {}),
                                              };
                                            }),
                                        }
                                      : d,
                                  );
                                }}
                                className="w-[7.5rem] bg-white"
                              />
                            </label>
                            <label className="text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                End
                              </span>
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => {
                                  const endTime = e.target.value;
                                  setDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          customOccurrences:
                                            d.customOccurrences.map((o) =>
                                              o.key === slot.key
                                                ? { ...o, endTime }
                                                : o,
                                            ),
                                        }
                                      : d,
                                  );
                                }}
                                className="w-[7.5rem] bg-white"
                              />
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove date"
                              onClick={() =>
                                setDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        customOccurrences:
                                          d.customOccurrences.filter(
                                            (o) => o.key !== slot.key,
                                          ),
                                      }
                                    : d,
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </li>
                          );
                        })}
                      </ul>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  customOccurrences: [
                                    ...d.customOccurrences,
                                    {
                                      key: createId(),
                                      date: "",
                                      startTime: d.startTime,
                                      endTime: d.endTime,
                                    },
                                  ],
                                }
                              : d,
                          )
                        }
                      >
                        <Plus data-icon="inline-start" />
                        Add date
                      </Button>
                    </div>
                  )}

                  {(draft.weekly || draft.custom) && (
                    <>
                      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={draft.autoNumber}
                          onChange={(e) =>
                            setDraft((d) =>
                              d
                                ? { ...d, autoNumber: e.target.checked }
                                : d,
                            )
                          }
                          className="size-4 rounded border-input"
                        />
                        Number occurrences
                      </label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Titles become &quot;{draft.title.trim() || "Title"} 1&quot;,
                        &quot;2&quot;, … in date order
                        {draft.weekly ? ", skipping removed dates" : ""}.
                      </p>
                      {draft.excludedDates.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Removed occurrences
                          </p>
                          <ul className="space-y-1">
                            {draft.excludedDates.map((date) => (
                              <li
                                key={date}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className="text-ink">
                                  {formatShortDate(date)}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={saving || !draft.id}
                                  onClick={() =>
                                    void handleRestoreOccurrence(date)
                                  }
                                >
                                  Restore
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-white/50 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={draft.appearOnBoard}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, appearOnBoard: e.target.checked } : d,
                        )
                      }
                      className="size-4 rounded border-input"
                    />
                    Appear on board
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Places a box with this title
                    {draft.startTime
                      ? " and time"
                      : ""}{" "}
                    on the event day.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-white/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">Board boxes</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                rules: [...d.rules, emptyRule(d.course)],
                              }
                            : d,
                        )
                      }
                    >
                      <Plus data-icon="inline-start" />
                      Add
                    </Button>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Place a tagged box on the board relative to this event.
                    Optional start/end times on a rule apply only to that box —
                    they do not use the event time above (that is for Appear on
                    board). Duration fills every occurrence you haven’t given
                    its own estimate; changing it updates those and leaves a
                    time you already set on one week.
                  </p>
                  {draft.rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rules yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {draft.rules.map((rule) => (
                        <li
                          key={rule.id}
                          className="rounded-lg border border-border/50 bg-white/80 p-2"
                        >
                          <div className="mb-2 flex flex-wrap gap-2">
                            <select
                              value={rule.relative}
                              onChange={(e) =>
                                updateRule(rule.id, {
                                  relative: e.target
                                    .value as BoardPlacementRelative,
                                })
                              }
                              className="h-8 rounded-lg border border-input bg-white px-2 text-xs"
                            >
                              <option value="weekOf">Week of</option>
                              <option value="weekPrior">Week prior</option>
                            </select>
                            <select
                              value={rule.day}
                              onChange={(e) =>
                                updateRule(rule.id, {
                                  day: e.target.value as DayKey,
                                })
                              }
                              className="h-8 rounded-lg border border-input bg-white px-2 text-xs"
                            >
                              {DAYS.map((d) => (
                                <option key={d.key} value={d.key}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove rule"
                              onClick={() =>
                                setDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        rules: d.rules.filter(
                                          (r) => r.id !== rule.id,
                                        ),
                                      }
                                    : d,
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="max-w-[40%] shrink text-sm leading-snug">
                              <TaskTagPrefixes
                                tags={rule.tags}
                                separator={Boolean(rule.text)}
                              />
                            </span>
                            <Input
                              value={rule.text}
                              onChange={(e) =>
                                updateRule(rule.id, { text: e.target.value })
                              }
                              placeholder="Box text"
                              className="h-8 min-w-[8rem] flex-1 bg-white text-sm"
                            />
                            <label className="text-xs">
                              <span className="sr-only">Start</span>
                              <Input
                                type="time"
                                value={rule.startTime ?? ""}
                                onChange={(e) => {
                                  const startTime = e.target.value;
                                  const endTime = endTimePreservingDuration(
                                    rule.startTime,
                                    rule.endTime,
                                    startTime,
                                  );
                                  updateRule(rule.id, {
                                    startTime: startTime || undefined,
                                    ...(endTime ? { endTime } : {}),
                                  });
                                }}
                                className="h-8 w-[7.5rem] bg-white text-xs"
                                aria-label="Start time"
                              />
                            </label>
                            <span className="text-xs text-muted-foreground">
                              –
                            </span>
                            <label className="text-xs">
                              <span className="sr-only">End</span>
                              <Input
                                type="time"
                                value={rule.endTime ?? ""}
                                onChange={(e) =>
                                  updateRule(rule.id, {
                                    endTime: e.target.value || undefined,
                                  })
                                }
                                className="h-8 w-[7.5rem] bg-white text-xs"
                                aria-label="End time"
                              />
                            </label>
                            <RuleEstimateInput
                              minutes={rule.estimateMinutes}
                              onChange={(estimateMinutes) =>
                                updateRule(rule.id, {
                                  estimateMinutes,
                                })
                              }
                            />
                            <BoxTagPicker
                              tags={rule.tags}
                              onChange={(tags: BoxTag[]) =>
                                updateRule(rule.id, {
                                  tags: normalizeTaskTags(tags),
                                })
                              }
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="relative z-[60] mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleSave()}
                  disabled={saving || !draft.title.trim()}
                  className="bg-seafoam text-white hover:bg-seafoam/90"
                >
                  Save
                </Button>
                {canRemoveOccurrence && (
                  <Button
                    type="button"
                    variant="secondary"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleRemoveOccurrence()}
                    disabled={saving}
                  >
                    Remove this occurrence
                  </Button>
                )}
                {draft.id && (
                  <Button
                    type="button"
                    variant="secondary"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleCopy(draft)}
                    disabled={saving || !draft.title.trim()}
                  >
                    <Copy data-icon="inline-start" />
                    Copy
                  </Button>
                )}
                {draft.id && (
                  <Button
                    type="button"
                    variant="destructive"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleDelete()}
                    disabled={saving}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-ink">
                    {formatDayHeading(selectedDate)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {dayEvents.length === 0
                      ? filtersActive
                        ? "Nothing matching"
                        : "Nothing due"
                      : `${dayEvents.length} due`}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={openNew}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {dayEvents.map((event) => (
                  <li key={`${event.seriesId}:${event.instanceDate}`}>
                    <button
                      type="button"
                      onClick={() => openEdit(event)}
                      className="w-full rounded-xl border border-border/70 bg-white/80 px-3 py-3 text-left transition-colors hover:border-seafoam/50"
                    >
                      <p
                        className="text-xs font-semibold tracking-wider uppercase"
                        style={{ color: dueCourseColor(event.course) }}
                      >
                        {event.course}
                        {isMultiDayInstance(event)
                          ? ` · ${formatShortDate(event.instanceDate)}–${formatShortDate(event.instanceEndDate)}`
                          : ""}
                        {seriesLabel(event)}
                        {event.appearOnBoard ? " · on board" : ""}
                        {(event.rules?.length ?? 0) > 0
                          ? ` · ${event.rules!.length} box${event.rules!.length === 1 ? "" : "es"}`
                          : ""}
                      </p>
                      <p className="mt-0.5 font-medium text-ink">{event.title}</p>
                      {event.startTime ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {formatTimeRange(event.startTime, event.endTime)}
                        </p>
                      ) : null}
                      {event.detail ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {event.detail}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              {filtersActive &&
              monthMatches.length === 0 &&
              filteredInstances.length > 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No matches this month. Use Next to jump to one.
                </p>
              ) : null}
              {filtersActive &&
              monthMatches.some(
                (event) => !eventCoversDate(event, selectedDate),
              ) ? (
                <div className="mt-4 border-t border-border/50 pt-3">
                  <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Other matches this month
                  </p>
                  <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {monthMatches
                      .filter((event) => !eventCoversDate(event, selectedDate))
                      .map((event) => (
                        <li key={`${event.seriesId}:${event.instanceDate}`}>
                          <button
                            type="button"
                            onClick={() => jumpToDate(event.instanceDate)}
                            className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/80"
                          >
                            <span
                              className="size-1.5 shrink-0 translate-y-0.5 rounded-full"
                              style={{
                                backgroundColor: dueCourseColor(event.course),
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-ink">
                              {event.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatShortDate(event.instanceDate)}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
