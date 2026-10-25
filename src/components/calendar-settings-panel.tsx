"use client";

import { useEffect, useState } from "react";
import type { DayKey } from "@/lib/week-plan";
import {
  CALENDAR_WEEK_START_OPTIONS,
  DEFAULT_CALENDAR_WEEK_START,
  loadCalendarWeekStart,
  saveCalendarWeekStart,
} from "@/lib/calendar-week-start";

export function CalendarSettingsPanel() {
  const [weekStartsOn, setWeekStartsOn] = useState<DayKey>(
    DEFAULT_CALENDAR_WEEK_START,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCalendarWeekStart().then((day) => {
      if (cancelled) return;
      setWeekStartsOn(day);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onChange(day: DayKey) {
    setWeekStartsOn(day);
    await saveCalendarWeekStart(day);
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card/90 px-4 py-4">
      <h2 className="font-heading text-lg font-semibold text-ink">Calendar</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        First column of each week on the calendar. Week of and Week prior stay
        on Monday–Sunday board weeks.
      </p>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Week starts on
        <select
          value={weekStartsOn}
          disabled={!ready}
          onChange={(event) => void onChange(event.target.value as DayKey)}
          className="mt-1 h-9 w-full max-w-xs rounded-lg border border-input bg-white px-2 text-sm text-ink disabled:opacity-60"
        >
          {CALENDAR_WEEK_START_OPTIONS.map((day) => (
            <option key={day.key} value={day.key}>
              {day.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
