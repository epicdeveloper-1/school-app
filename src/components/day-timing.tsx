"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TaskItem } from "@/lib/week-plan";
import {
  computeDayTimingStats,
  formatClockTime,
  formatDuration,
  normalizeClockTime,
  parseDuration,
} from "@/lib/task-time";

type DayTimingProps = {
  tasks: TaskItem[];
  fixedStart?: string;
  breakMinutes?: number;
  onFixedStartChange: (value: string | undefined) => void;
  onBreakMinutesChange: (value: number | undefined) => void;
};

export function DayTimingSummary({
  tasks,
  fixedStart,
  breakMinutes,
  onFixedStartChange,
  onBreakMinutesChange,
}: DayTimingProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [startDraft, setStartDraft] = useState("");
  const [breakDraft, setBreakDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);

  const stats = computeDayTimingStats(tasks, {
    fixedStart,
    breakMinutes,
    now,
  });

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStartDraft(fixedStart ? formatClockTime(fixedStart) : "");
    setBreakDraft(
      breakMinutes && breakMinutes > 0 ? formatDuration(breakMinutes) : "",
    );
  }, [open, fixedStart, breakMinutes]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function clearHoverTimer() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  function commitStart() {
    const trimmed = startDraft.trim();
    if (!trimmed) {
      onFixedStartChange(undefined);
      setStartDraft("");
      return;
    }
    const normalized = normalizeClockTime(trimmed);
    if (!normalized) return;
    onFixedStartChange(normalized);
    setStartDraft(formatClockTime(normalized));
  }

  function commitBreak() {
    const trimmed = breakDraft.trim();
    if (!trimmed) {
      onBreakMinutesChange(undefined);
      setBreakDraft("");
      return;
    }
    const mins = parseDuration(trimmed);
    if (mins === null) return;
    onBreakMinutesChange(mins);
    setBreakDraft(formatDuration(mins));
  }

  const pace =
    stats.paceDeltaMinutes === null
      ? null
      : stats.paceDeltaMinutes === 0
        ? { label: "On track", className: "text-seafoam" }
        : stats.paceDeltaMinutes > 0
          ? {
              label: `Ahead by ${formatDuration(stats.paceDeltaMinutes)}`,
              className: "text-emerald-700",
            }
          : {
              label: `Behind by ${formatDuration(-stats.paceDeltaMinutes)}`,
              className: "text-red-600",
            };

  return (
    <div
      ref={rootRef}
      className="relative flex items-center gap-1.5"
      onMouseEnter={() => {
        clearHoverTimer();
        hoverTimer.current = window.setTimeout(() => setOpen(true), 180);
      }}
      onMouseLeave={() => {
        clearHoverTimer();
        hoverTimer.current = window.setTimeout(() => setOpen(false), 220);
      }}
    >
      {stats.remainingMinutes > 0 && (
        <span
          className="rounded-md border border-border/70 bg-white/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink"
          title="Remaining estimated time"
        >
          {formatDuration(stats.remainingMinutes)}
        </span>
      )}
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Day time estimates"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="size-7"
      >
        <Clock className="size-3.5" />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Day timing stats"
          className="absolute top-full right-0 z-40 mt-1 w-72 rounded-xl border border-border/80 bg-white p-3 shadow-lg"
          onMouseEnter={clearHoverTimer}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatDuration(stats.totalMinutes)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Remaining</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatDuration(stats.remainingMinutes)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Original finish</dt>
              <dd className="font-medium tabular-nums text-ink">
                {stats.originalFinishLabel ?? "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Est. finish</dt>
              <dd
                className={`font-medium tabular-nums ${
                  stats.paceDeltaMinutes === null ||
                  stats.paceDeltaMinutes === 0
                    ? "text-ink"
                    : stats.paceDeltaMinutes > 0
                      ? "text-emerald-700"
                      : "text-red-600"
                }`}
              >
                {stats.estimatedFinishLabel ?? "—"}
              </dd>
            </div>
            {pace && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Pace</dt>
                <dd className={`font-medium ${pace.className}`}>{pace.label}</dd>
              </div>
            )}
          </dl>

          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Fixed start (EST)
              </span>
              <Input
                value={startDraft}
                onChange={(e) => setStartDraft(e.target.value)}
                onBlur={commitStart}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitStart();
                  }
                }}
                placeholder="e.g. 2:00 PM"
                className="h-8 bg-white text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Breaks
              </span>
              <Input
                value={breakDraft}
                onChange={(e) => setBreakDraft(e.target.value)}
                onBlur={commitBreak}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitBreak();
                  }
                }}
                placeholder="e.g. 30m"
                className="h-8 bg-white text-sm"
              />
            </label>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Breaks add the same time to both finish times.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

type EstimateInputProps = {
  minutes?: number;
  onChange: (minutes: number | undefined) => void;
  dimmed?: boolean;
};

/** Compact duration field on a box (`45m`, `1h 30m`). */
export function TaskEstimateInput({
  minutes,
  onChange,
  dimmed,
}: EstimateInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function begin() {
    setDraft(minutes && minutes > 0 ? formatDuration(minutes) : "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) {
      onChange(undefined);
      return;
    }
    const parsed = parseDuration(trimmed);
    if (parsed === null) return;
    onChange(parsed);
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Estimated time"
        placeholder=""
        className="h-6 w-16 shrink-0 bg-white/90 px-1.5 text-center text-xs tabular-nums"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        begin();
      }}
      aria-label={
        minutes && minutes > 0
          ? `Estimated time ${formatDuration(minutes)}. Edit`
          : "Add estimated time"
      }
      className={`shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/50 ${
        minutes && minutes > 0
          ? dimmed
            ? "text-muted-foreground"
            : "text-muted-foreground hover:text-ink"
          : "text-muted-foreground/50 hover:text-muted-foreground"
      }`}
    >
      {minutes && minutes > 0 ? formatDuration(minutes) : "time"}
    </button>
  );
}
