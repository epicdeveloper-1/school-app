import type { TaskItem } from "./week-plan";

export const EST_TZ = "America/New_York";

/** Parse strings like `45m`, `1h`, `1h 30m`, `1.5h`, `90`, `1:30`. */
export function parseDuration(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/,/g, "");
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 0 ? n : null;
  }

  const colon = raw.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (m >= 60) return null;
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }

  let total = 0;
  let matched = false;

  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/);
  if (hourMatch) {
    total += Math.round(Number(hourMatch[1]) * 60);
    matched = true;
  }

  const minMatch = raw.match(/(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?/);
  if (minMatch) {
    total += Math.round(Number(minMatch[1]));
    matched = true;
  }

  if (!matched) return null;
  return total > 0 ? total : null;
}

/** Format minutes as `45m`, `1h`, or `1h 30m`. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return "0m";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

/** Parse `H:mm` or `h:mm am/pm` into minutes from midnight (0–1439). */
export function parseClockTime(input: string): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2] ? Number(ampm[2]) : 0;
    const period = ampm[3];
    if (h < 1 || h > 12 || m > 59) return null;
    if (period === "am") {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return h * 60 + m;
  }

  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const h = Number(twentyFour[1]);
    const m = Number(twentyFour[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

function formatMinutesAsHhmm(mins: number): string {
  const day = 24 * 60;
  const normalized = ((mins % day) + day) % day;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * When a start time moves and both times were already set, keep the same
 * duration by shifting the end. Returns null when the end should stay put
 * (missing times, or the start did not actually change).
 */
export function endTimePreservingDuration(
  prevStart: string | undefined | null,
  prevEnd: string | undefined | null,
  nextStart: string,
): string | null {
  if (!prevStart || !prevEnd || !nextStart) return null;
  const start = parseClockTime(prevStart);
  const end = parseClockTime(prevEnd);
  const next = parseClockTime(nextStart);
  if (start === null || end === null || next === null || next === start) {
    return null;
  }
  let duration = end - start;
  if (duration < 0) duration += 24 * 60;
  return formatMinutesAsHhmm(next + duration);
}

export type BoardTimeRange = {
  /** `HH:mm` 24h. */
  startTime: string;
  /** `HH:mm` 24h. Omitted for a single clock time. */
  endTime?: string;
};

/**
 * Parse a board-box time inside parentheses: a range or a single clock.
 * Spaces are ignored. `am` / `pm` are case-insensitive and may include periods.
 * One meridian applies to both ends of a range. Neither meridian defaults to PM.
 * `(3-5)` is `3:00`–`5:00`. `(3)` is `3:00` PM. Hours outside 1–12 with no
 * meridian are 24-hour.
 */
export function parseBoardTimeRange(inner: string): BoardTimeRange | null {
  const compact = inner.replace(/\s+/g, "").replace(/[–—−]/g, "-");
  const match = compact.match(
    /^(\d{1,2})(?::(\d{1,2}))?((?:a|p)\.?m\.?)?(?:-(\d{1,2})(?::(\d{1,2}))?((?:a|p)\.?m\.?)?)?$/i,
  );
  if (!match) return null;

  const start = readClock(match[1], match[2], match[3]);
  if (!start) return null;
  if (match[4] === undefined) return { startTime: start.hhmm };

  const end = readClock(match[4], match[5], match[6]);
  if (!end) return null;

  const looks24 = start.hour24 || end.hour24;
  if (looks24 && (start.period || end.period)) return null;

  if (looks24) {
    const startTime = clockToHhmm(start.hour, start.minute, "24");
    const endTime = clockToHhmm(end.hour, end.minute, "24");
    if (!startTime || !endTime) return null;
    return { startTime, endTime };
  }

  const shared =
    start.period && end.period ? null : (start.period ?? end.period ?? "pm");
  const startTime = clockToHhmm(
    start.hour,
    start.minute,
    start.period ?? shared ?? "pm",
  );
  const endTime = clockToHhmm(
    end.hour,
    end.minute,
    end.period ?? shared ?? "pm",
  );
  if (!startTime || !endTime) return null;
  return { startTime, endTime };
}

function readClock(
  hourRaw: string | undefined,
  minuteRaw: string | undefined,
  periodRaw: string | undefined,
): {
  hour: number;
  minute: number;
  period: "am" | "pm" | null;
  hour24: boolean;
  hhmm: string;
} | null {
  if (hourRaw === undefined) return null;
  const hour = Number(hourRaw);
  const minute = minuteRaw ? Number(minuteRaw) : 0;
  const period = normalizeMeridian(periodRaw);
  if (!Number.isInteger(hour) || minute > 59) return null;
  const hour24 = !period && (hour === 0 || hour > 12);
  if (hour24 && period) return null;
  const hhmm = clockToHhmm(hour, minute, hour24 ? "24" : (period ?? "pm"));
  if (!hhmm) return null;
  return { hour, minute, period, hour24, hhmm };
}

function normalizeMeridian(raw: string | undefined): "am" | "pm" | null {
  if (!raw) return null;
  const compact = raw.toLowerCase().replace(/\./g, "");
  if (compact === "am") return "am";
  if (compact === "pm") return "pm";
  return null;
}

function clockToHhmm(
  hour: number,
  minute: number,
  period: "am" | "pm" | "24",
): string | null {
  if (minute < 0 || minute > 59) return null;
  let h = hour;
  if (period === "24") {
    if (h > 23) return null;
  } else {
    if (h < 1 || h > 12) return null;
    if (period === "am") {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
  }
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * If `before` ends with a `(time range)`, return that range and the text
 * with the parentheses removed.
 */
export function matchTrailingBoardTime(before: string): {
  time: BoardTimeRange;
  textWithoutMatch: string;
  matchedText: string;
} | null {
  if (!before.endsWith(")")) return null;
  const close = before.length - 1;
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    const ch = before[i];
    if (ch === ")") depth += 1;
    else if (ch === "(") {
      depth -= 1;
      if (depth === 0) {
        if (i > 0 && before[i - 1] === "]") return null;
        const inner = before.slice(i + 1, close);
        const time = parseBoardTimeRange(inner);
        if (!time) return null;
        return {
          time,
          textWithoutMatch: before.slice(0, i).replace(/\s+$/, ""),
          matchedText: before.slice(i),
        };
      }
    }
  }
  return null;
}

/** Space after a trailing `(range)` lifts it out of the text. */
export function applyBoardTimeFromSpace(
  value: string,
  cursor: number,
): {
  value: string;
  time: BoardTimeRange;
  cursor: number;
  /** Field value as if the space had been typed. */
  typedValue: string;
  typedCursor: number;
} | null {
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const match = matchTrailingBoardTime(before);
  if (!match) return null;
  const nextValue =
    match.textWithoutMatch.length > 0 && after.length > 0
      ? `${match.textWithoutMatch} ${after.replace(/^\s+/, "")}`
      : match.textWithoutMatch + after.replace(/^\s+/, "");
  return {
    value: nextValue,
    time: match.time,
    cursor: match.textWithoutMatch.length,
    typedValue: `${before} ${after}`,
    typedCursor: before.length + 1,
  };
}

/** Pull the last `(time range)` out of box text. Other parentheses stay. */
export function detachBoardTime(text: string): {
  text: string;
  time: BoardTimeRange | null;
} {
  const re = /\(([^)]*)\)/g;
  let found: { index: number; length: number; time: BoardTimeRange } | null =
    null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > 0 && text[match.index - 1] === "]") continue;
    const time = parseBoardTimeRange(match[1] ?? "");
    if (!time) continue;
    found = { index: match.index, length: match[0].length, time };
  }
  if (!found) return { text, time: null };
  const next = `${text.slice(0, found.index)}${text.slice(found.index + found.length)}`
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text: next, time: found.time };
}

/** Store as `HH:mm` 24h. Accepts am/pm or 24h input. */
export function normalizeClockTime(input: string): string | null {
  const mins = parseClockTime(input);
  if (mins === null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatClockTime(hhmm: string): string {
  const mins = parseClockTime(hhmm);
  if (mins === null) return hhmm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Display range like `6:00 - 9:00 PM` (shared period) or `11:00 AM - 1:00 PM`.
 */
export function formatTimeRange(
  startHhmm: string,
  endHhmm?: string | null,
): string | null {
  const startMins = parseClockTime(startHhmm);
  if (startMins === null) return null;
  const startLabel = formatClockTime(startHhmm);
  if (!endHhmm) return startLabel;

  const endMins = parseClockTime(endHhmm);
  if (endMins === null) return startLabel;

  const startPeriod = startMins >= 12 * 60 ? "PM" : "AM";
  const endPeriod = endMins >= 12 * 60 ? "PM" : "AM";
  const startClock = startLabel.replace(/ (AM|PM)$/, "");
  const endClock = formatClockTime(endHhmm).replace(/ (AM|PM)$/, "");

  if (startPeriod === endPeriod) {
    return `${startClock} - ${endClock} ${endPeriod}`;
  }
  return `${startLabel} - ${formatClockTime(endHhmm)}`;
}

export function formatTimeInEst(date: Date): string {
  const time = date.toLocaleTimeString("en-US", {
    timeZone: EST_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} EST`;
}

/** Minutes from midnight in America/New_York for `date`. */
export function estMinutesFromMidnight(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EST_TZ,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function sumEstimates(tasks: TaskItem[]): number {
  return tasks.reduce((n, t) => n + (t.estimateMinutes ?? 0), 0);
}

export function remainingEstimates(tasks: TaskItem[]): number {
  return tasks.reduce(
    (n, t) => n + (t.done ? 0 : (t.estimateMinutes ?? 0)),
    0,
  );
}

export function doneEstimates(tasks: TaskItem[]): number {
  return tasks.reduce(
    (n, t) => n + (t.done ? (t.estimateMinutes ?? 0) : 0),
    0,
  );
}

export type DayTimingStats = {
  totalMinutes: number;
  remainingMinutes: number;
  doneMinutes: number;
  breakMinutes: number;
  /**
   * Planned finish if every estimate is worked in full from the fixed start.
   * Null without a fixed start.
   */
  originalFinishAt: Date | null;
  originalFinishLabel: string | null;
  /**
   * Original finish shifted by pace. Checking boxes early pulls this earlier.
   * Breaks add the same minutes as on the original finish.
   * Without a fixed start, this is now + remaining + breaks.
   */
  estimatedFinishAt: Date | null;
  estimatedFinishLabel: string | null;
  /** Minutes ahead (positive) or behind (negative). Only with fixed start. */
  paceDeltaMinutes: number | null;
};

/**
 * Finish / pace math.
 * - No fixed start: estimated finish = now + remaining + breaks (live).
 * - Fixed start: both finishes are start + work + breaks.
 *   Original finish = start + total + breaks.
 *   Estimated finish = original − (done − elapsed), so checking work off
 *   early moves it earlier. Breaks are not removed from elapsed.
 */
export function computeDayTimingStats(
  tasks: TaskItem[],
  opts: {
    fixedStart?: string | null;
    breakMinutes?: number;
    now?: Date;
  },
): DayTimingStats {
  const now = opts.now ?? new Date();
  const breakMinutes = Math.max(0, opts.breakMinutes ?? 0);
  const totalMinutes = sumEstimates(tasks);
  const remainingMinutes = remainingEstimates(tasks);
  const doneMinutes = doneEstimates(tasks);

  const fixedStartMins = opts.fixedStart
    ? parseClockTime(opts.fixedStart)
    : null;

  if (fixedStartMins === null) {
    if (remainingMinutes === 0 && breakMinutes === 0 && totalMinutes === 0) {
      return {
        totalMinutes,
        remainingMinutes,
        doneMinutes,
        breakMinutes,
        originalFinishAt: null,
        originalFinishLabel: null,
        estimatedFinishAt: null,
        estimatedFinishLabel: null,
        paceDeltaMinutes: null,
      };
    }
    const estimatedFinishAt = new Date(
      now.getTime() + (remainingMinutes + breakMinutes) * 60_000,
    );
    return {
      totalMinutes,
      remainingMinutes,
      doneMinutes,
      breakMinutes,
      originalFinishAt: null,
      originalFinishLabel: null,
      estimatedFinishAt,
      estimatedFinishLabel: formatTimeInEst(estimatedFinishAt),
      paceDeltaMinutes: null,
    };
  }

  // Build finish from today's calendar date in EST + fixed clock + duration.
  const originalFinishMins = fixedStartMins + totalMinutes + breakMinutes;
  const originalFinishAt = dateFromEstClock(now, originalFinishMins);
  const nowEst = estMinutesFromMidnight(now);
  const elapsed = Math.max(0, nowEst - fixedStartMins);
  // Positive = ahead (completed more than elapsed), negative = behind.
  const paceDeltaMinutes = doneMinutes - elapsed;
  // Ahead of pace pulls the estimate earlier than the original finish.
  const estimatedFinishAt = dateFromEstClock(
    now,
    originalFinishMins - paceDeltaMinutes,
  );

  return {
    totalMinutes,
    remainingMinutes,
    doneMinutes,
    breakMinutes,
    originalFinishAt,
    originalFinishLabel: formatTimeInEst(originalFinishAt),
    estimatedFinishAt,
    estimatedFinishLabel: formatTimeInEst(estimatedFinishAt),
    paceDeltaMinutes,
  };
}

/** Construct a Date whose EST wall-clock equals `minutesFromMidnight` on `now`'s EST date. */
function dateFromEstClock(now: Date, minutesFromMidnight: number): Date {
  const dayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = dayParts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = dayParts.find((p) => p.type === "month")?.value ?? "01";
  const d = dayParts.find((p) => p.type === "day")?.value ?? "01";

  let dayOffset = 0;
  let mins = minutesFromMidnight;
  while (mins >= 24 * 60) {
    mins -= 24 * 60;
    dayOffset += 1;
  }
  while (mins < 0) {
    mins += 24 * 60;
    dayOffset -= 1;
  }

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  // Interpret as EST/EDT wall time via offset lookup.
  const probe = new Date(`${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  // Adjust from local interpretation to EST wall by comparing formatters.
  // Prefer Temporal-free approach: binary-search UTC ms for matching EST parts.
  const targetDay = new Date(`${y}-${mo}-${d}T12:00:00Z`);
  targetDay.setUTCDate(targetDay.getUTCDate() + dayOffset);
  const y2 = targetDay.getUTCFullYear();
  const mo2 = String(targetDay.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(targetDay.getUTCDate()).padStart(2, "0");

  return estWallTimeToDate(y2, Number(mo2), Number(d2), h, m) ?? probe;
}

function estWallTimeToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date | null {
  // Guess UTC from EST (−5) then refine; handles EDT (−4) via formatter check.
  let utc = Date.UTC(year, month - 1, day, hour + 5, minute, 0);
  for (let i = 0; i < 4; i++) {
    const d = new Date(utc);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: EST_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(d);
    const gotY = Number(parts.find((p) => p.type === "year")?.value);
    const gotMo = Number(parts.find((p) => p.type === "month")?.value);
    const gotD = Number(parts.find((p) => p.type === "day")?.value);
    const gotH = Number(parts.find((p) => p.type === "hour")?.value);
    const gotM = Number(parts.find((p) => p.type === "minute")?.value);
    const target = (((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute;
    const actual = (((gotY * 12 + gotMo) * 31 + gotD) * 24 + gotH) * 60 + gotM;
    const diffMin = target - actual;
    if (diffMin === 0) return d;
    utc += diffMin * 60_000;
  }
  return new Date(utc);
}
