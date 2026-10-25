/**
 * User strategy seed — UW 2A Fall 2026.
 * Academic boxes come from calendar event rules; this file keeps term
 * constants and week plan seeds (deadlines, empty day shells).
 */

import { isBlankProfile } from "@/lib/app-profile";
import {
  DayKey,
  WeekPlan,
  emptyDayMeta,
  emptyDays,
  formatWeekOf,
  shiftWeek,
  startOfWeek,
} from "@/lib/week-plan";

/** MATH 235 quiz Thursdays (YYYY-MM-DD). */
export const MATH_235_QUIZZES = [
  "2026-09-24",
  "2026-10-01",
  "2026-10-29",
  "2026-11-05",
  "2026-11-26",
  "2026-12-03",
] as const;

const MATH_235_SHORT_GAP = new Set([
  "2026-10-01",
  "2026-11-05",
  "2026-12-03",
]);

export function isMath235ShortGap(quizDate: string): boolean {
  return MATH_235_SHORT_GAP.has(quizDate);
}

/** First MATH 237 quiz Tuesday. */
export const MATH_237_FIRST_QUIZ = "2026-09-22";

/** Reading week Mon date. */
export const READING_WEEK_OF = "2026-10-12";

/** AMATH midterm week Mon date. */
export const AMATH_MIDTERM_WEEK_OF = "2026-10-19";

export type QuizFlags = {
  math237: boolean;
  amath250: boolean;
  math235: boolean;
};

type Deadline = { label: string; detail: string };

/** High-level CS 234 calendar keyed by week Monday (YYYY-MM-DD). */
const CS_DEADLINES_BY_WEEK: Record<string, Deadline[]> = {
  "2026-09-07": [
    { label: "CS 234 modules", detail: "1a–f" },
    {
      label: "CS 234 available",
      detail: "Asst 0 Wed Sep 9 · Quiz A Wed Sep 9",
    },
  ],
  "2026-09-14": [
    { label: "CS 234 modules", detail: "2a–e" },
    {
      label: "CS 234 available",
      detail: "Asst 1 · Quiz B · Learning Activity 1 (Mon Sep 14)",
    },
    { label: "CS 234 due", detail: "Exercise 1 Mon Sep 14" },
  ],
  "2026-09-21": [
    { label: "CS 234 modules", detail: "3a–g" },
    { label: "CS 234 available", detail: "Quiz C Mon Sep 21" },
    {
      label: "CS 234 due",
      detail:
        "Quiz A Mon Sep 21 · Quiz B Mon Sep 21 · LA1 1st Mon Sep 21 · Asst 0 Wed Sep 23 · Exercise 2 Thu Sep 24",
    },
  ],
  "2026-09-28": [
    { label: "CS 234 modules", detail: "4a–c" },
    {
      label: "CS 234 available",
      detail: "LA2 Mon Sep 28 · Quiz D Mon Sep 28 · Asst 2 Tue Sep 29",
    },
    {
      label: "CS 234 due",
      detail:
        "Quiz C Mon Sep 28 · LA1 2nd Mon Sep 28 · Exercise 3 Tue Sep 29 · Asst 1 Wed Sep 30",
    },
  ],
  "2026-10-05": [
    { label: "CS 234 modules", detail: "4d–f" },
    {
      label: "CS 234 due",
      detail: "Exercise 4 Mon Oct 5 · Learning Activity 2 Fri Oct 9",
    },
  ],
  "2026-10-12": [
    { label: "Reading week", detail: "CS catch-up / no class rhythm" },
  ],
  "2026-10-19": [
    { label: "CS 234 modules", detail: "5a–e" },
    {
      label: "CS 234 available",
      detail: "LA3 Mon Oct 19 · Quiz E Mon Oct 19",
    },
    {
      label: "CS 234 due",
      detail: "Quiz D Mon Oct 19 · Exercise 5 Mon Oct 19",
    },
  ],
  "2026-10-26": [
    { label: "CS 234 modules", detail: "6a–e" },
    {
      label: "CS 234 available",
      detail: "Quiz F Mon Oct 26 · Asst 3 Tue Oct 27",
    },
    {
      label: "CS 234 due",
      detail:
        "LA3 1st Mon Oct 26 · Quiz E Mon Oct 26 · Exercise 6 Mon Oct 26 · Asst 2 Wed Oct 28",
    },
  ],
  "2026-11-02": [
    { label: "CS 234 modules", detail: "6f, 7a–c" },
    {
      label: "CS 234 due",
      detail: "Exercise 7 Mon Nov 2 · LA3 2nd Mon Nov 2",
    },
  ],
  "2026-11-09": [
    { label: "CS 234 modules", detail: "7d–g" },
    {
      label: "CS 234 available",
      detail: "LA4 Mon Nov 9 · Quiz G Mon Nov 9",
    },
    {
      label: "CS 234 due",
      detail: "Quiz F Mon Nov 9 · Exercise 8 Wed Nov 11",
    },
  ],
  "2026-11-16": [
    { label: "CS 234 modules", detail: "8a–d" },
    {
      label: "CS 234 available",
      detail: "Quiz H Mon Nov 16 · Asst 4 Tue Nov 17",
    },
    {
      label: "CS 234 due",
      detail:
        "Quiz G Mon Nov 16 · Exercise 9 Tue Nov 17 · Asst 3 Wed Nov 18",
    },
  ],
  "2026-11-23": [
    { label: "CS 234 modules", detail: "9a–e" },
    {
      label: "CS 234 due",
      detail: "LA4 Mon Nov 23 · Exercise 10 Tue Nov 24",
    },
  ],
  "2026-11-30": [
    { label: "CS 234 modules", detail: "10a–d" },
    {
      label: "CS 234 due",
      detail:
        "Quiz H Mon Nov 30 · Exercise 11 Tue Dec 1 · Asst 4 Wed Dec 2 · Exercise 12 Wed Dec 2 · All popups Tue Dec 8 · Final TBA (registrar)",
    },
  ],
};

export function thursdayOfWeek(weekOf: string): string {
  const d = new Date(`${weekOf}T12:00:00`);
  d.setDate(d.getDate() + 3);
  return formatWeekOf(d);
}

export function tuesdayOfWeek(weekOf: string): string {
  const d = new Date(`${weekOf}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return formatWeekOf(d);
}

/** Which quizzes fall in this calendar week (Mon-start). */
export function quizFlagsForWeek(weekOf: string): QuizFlags {
  if (weekOf === READING_WEEK_OF) {
    return { math237: false, amath250: false, math235: false };
  }

  const tue = tuesdayOfWeek(weekOf);
  const thu = thursdayOfWeek(weekOf);

  return {
    math237: tue >= MATH_237_FIRST_QUIZ,
    amath250: weekOf !== AMATH_MIDTERM_WEEK_OF,
    math235: (MATH_235_QUIZZES as readonly string[]).includes(thu),
  };
}

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Sept: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export type CsDueItem = { name: string; dueDate: string };

function csDueDetail(weekOf: string): string | undefined {
  return CS_DEADLINES_BY_WEEK[weekOf]?.find((d) => /\bdue\b/i.test(d.label))
    ?.detail;
}

function shortenCsName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^Learning Activity\s+(\d+)\b.*$/i, "LA$1");
  s = s.replace(/^LA(\d+)\b.*$/i, "LA$1");
  s = s.replace(/^Assignment\s+/i, "Asst ");
  s = s.replace(/^Ex\s+(\d+)/i, "Exercise $1");
  s = s.replace(/^All popups\b.*$/i, "Popups");
  s = s.replace(/^Final\b.*$/i, "Final");
  if (/^CS 234\b/i.test(s)) return s;
  return `CS 234 ${s}`;
}

/** Parse "Quiz A Mon Sep 21 · …" due blurbs into dated items. */
export function parseCsDues(weekOf: string): CsDueItem[] {
  const detail = csDueDetail(weekOf);
  if (!detail) return [];
  const year = Number(weekOf.slice(0, 4));
  const items: CsDueItem[] = [];
  for (const part of detail.split(/\s*·\s*/)) {
    const m = part
      .trim()
      .match(
        /^(.*?)\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})$/i,
      );
    if (!m) continue;
    const month = MONTH_INDEX[m[3].replace(/^Sept$/i, "Sep")];
    if (month === undefined) continue;
    const day = Number(m[4]);
    const due = new Date(year, month, day, 12, 0, 0);
    items.push({ name: shortenCsName(m[1]), dueDate: formatWeekOf(due) });
  }
  return items;
}

/** Every dated CS 234 due across the syllabus (one item per · fragment). */
export function allCsDueItems(): CsDueItem[] {
  const seen = new Set<string>();
  const items: CsDueItem[] = [];
  for (const weekOf of Object.keys(CS_DEADLINES_BY_WEEK).sort()) {
    for (const item of parseCsDues(weekOf)) {
      const key = `${item.name}|${item.dueDate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

/** Fall 2026 term Mondays that carry weekly Tue quizzes (excl. reading). */
export function termQuizWeekMondays(): string[] {
  const weeks: string[] = [];
  let weekOf = "2026-09-07";
  const end = "2026-11-30";
  while (weekOf <= end) {
    weeks.push(weekOf);
    weekOf = shiftWeek(weekOf, 1);
  }
  return weeks;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return formatWeekOf(d);
}

const DAY_KEYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function dayKeyInWeek(weekOf: string, dateStr: string): DayKey | null {
  const start = new Date(`${weekOf}T12:00:00`);
  const target = new Date(`${dateStr}T12:00:00`);
  const diff = Math.round(
    (target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diff < 0 || diff > 6) return null;
  return DAY_KEYS[diff];
}

function hasEarlyWeekCsPressure(weekOf: string): boolean {
  return parseCsDues(weekOf).some((item) => {
    const safe = addDays(item.dueDate, -1);
    const key = dayKeyInWeek(shiftWeek(weekOf, -1), safe);
    return key === "saturday" || key === "sunday";
  });
}

/**
 * Legacy academic/lifestyle boxes now owned by calendar rules or recurring todos.
 * Filter on render so old saved plans don't duplicate overlays.
 * Accepts raw text or a migrated TaskItem (tags + stripped body).
 */
export function isLegacyAcademicDayTask(
  taskOrText: string | { text: string; tags?: string[]; optional?: boolean },
): boolean {
  if (typeof taskOrText === "string") {
    const t = taskOrText.trim();
    if (/^MATH\s*237\s+(Study|Quiz|Tutorial)\b/i.test(t)) return true;
    if (/^AMATH\s*250\s+(Study|Quiz|Tutorial|Midterm Study)\b/i.test(t))
      return true;
    if (/^MATH\s*235\s+(Study|Quiz|Tutorial)\b/i.test(t)) return true;
    if (/^CS\s*234\b/i.test(t)) return true;
    if (/^Catch-up$/i.test(t)) return true;
    if (/^Job hours$/i.test(t)) return true;
    if (/^Water Boys$/i.test(t)) return true;
    if (/^Water Boys Rehearsal$/i.test(t)) return true;
    if (/^Vocal Techniques\b/i.test(t)) return true;
    if (/^Voice lesson\b/i.test(t)) return true;
    return false;
  }

  const tags = taskOrText.tags ?? [];
  const body = taskOrText.text.trim();
  if (isLegacyAcademicDayTask(body)) return true;

  if (tags.includes("math237") && /^(Study|Quiz|Tutorial)$/i.test(body))
    return true;
  if (
    tags.includes("amath250") &&
    /^(Study|Quiz|Tutorial|Midterm Study)$/i.test(body)
  )
    return true;
  if (tags.includes("math235") && /^(Study|Quiz|Tutorial)$/i.test(body))
    return true;
  if (tags.includes("music") && /^Vocal Techniques$/i.test(body)) return true;
  if (
    tags.includes("water-boys") &&
    /^(Water Boys|Water Boys Rehearsal)$/i.test(body)
  )
    return true;
  if (tags.includes("optional") && /^(Catch-up|Job hours)$/i.test(body))
    return true;
  return false;
}

export function deadlinesForWeek(weekOf: string): Deadline[] {
  const items: Deadline[] = [];
  const flags = quizFlagsForWeek(weekOf);
  const thu = thursdayOfWeek(weekOf);
  const tue = tuesdayOfWeek(weekOf);
  const nextWeekOf = shiftWeek(weekOf, 1);
  const nextFlags = quizFlagsForWeek(nextWeekOf);
  const nextTue = tuesdayOfWeek(nextWeekOf);

  if (flags.math235) {
    items.push({
      label: "MATH 235 Quiz",
      detail: `Thu ${thu} · 5:30–6:20`,
    });
  }
  if (flags.math237) {
    items.push({
      label: "MATH 237 Quiz",
      detail: `Tue ${tue} · 8:30–9:20`,
    });
  }
  if (flags.amath250) {
    items.push({
      label: "AMATH 250 Quiz",
      detail: `Tue ${tue} · 10:30–11:20`,
    });
  }
  if (weekOf === AMATH_MIDTERM_WEEK_OF) {
    items.push({
      label: "AMATH 250 Midterm",
      detail: "Week of Oct 19–23",
    });
  }

  const cs = CS_DEADLINES_BY_WEEK[weekOf];
  if (cs) items.push(...cs);

  if (nextFlags.math237 && !flags.math237) {
    items.push({
      label: "Next week: MATH 237 Quiz",
      detail: `Tue ${nextTue} · prep on Sat/Sun`,
    });
  }
  if (nextFlags.amath250 && !flags.amath250) {
    items.push({
      label: "Next week: AMATH 250 Quiz",
      detail: `Tue ${nextTue} · prep on Sat/Sun`,
    });
  }
  if (hasEarlyWeekCsPressure(nextWeekOf)) {
    items.push({
      label: "Next week: CS early dues",
      detail: csDueDetail(nextWeekOf) ?? `Week of ${nextWeekOf}`,
    });
  }

  return items;
}

export function buildWeekPlan(
  weekOf = formatWeekOf(startOfWeek()),
): WeekPlan {
  if (isBlankProfile()) {
    return {
      weekOf,
      focus: "",
      tags: [],
      flexNotes: [],
      deadlines: [],
      dayMeta: emptyDayMeta(),
      days: emptyDays(),
      subjects: [],
    };
  }
  return {
    weekOf,
    focus:
      "Finish the boxes → on track. Locked-in ≤ ~4h/day; after Water Boys = wind down only.",
    tags: [],
    flexNotes: [],
    deadlines: deadlinesForWeek(weekOf),
    dayMeta: emptyDayMeta(),
    days: emptyDays(),
    subjects: [],
  };
}
