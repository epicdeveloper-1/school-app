"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Calendar } from "lucide-react";
import { cn } from "cn";

const DEFAULT_YEAR = "2026";

type Parts = { month: string; day: string; year: string };
type Field = "month" | "day" | "year";

function isValidIsoDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function partsFromValue(value: string): Parts {
  if (!isValidIsoDate(value)) {
    return { month: "", day: "", year: DEFAULT_YEAR };
  }
  return { month: value.slice(5, 7), day: value.slice(8, 10), year: value.slice(0, 4) };
}

function toIso(parts: Parts): string | null {
  if (!/^\d{4}$/.test(parts.year)) return null;
  if (!/^\d{1,2}$/.test(parts.month) || !/^\d{1,2}$/.test(parts.day)) return null;
  const iso = `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

function digits(raw: string, max: number): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

function parseLooseDate(text: string, fallbackYear: string): Parts | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso && isValidIsoDate(text)) {
    return { year: iso[1], month: iso[2], day: iso[3] };
  }
  const monthDayYear = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (monthDayYear) {
    const parts = {
      month: monthDayYear[1].padStart(2, "0"),
      day: monthDayYear[2].padStart(2, "0"),
      year: monthDayYear[3],
    };
    return toIso(parts) ? parts : null;
  }
  const monthDay = /^(\d{1,2})[/-](\d{1,2})$/.exec(text);
  if (monthDay && /^\d{4}$/.test(fallbackYear)) {
    const parts = {
      month: monthDay[1].padStart(2, "0"),
      day: monthDay[2].padStart(2, "0"),
      year: fallbackYear,
    };
    return toIso(parts) ? parts : null;
  }
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function DateInput({
  value,
  onChange,
  min,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
  id?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => partsFromValue(value));
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const skipYearSelect = useRef(false);

  useEffect(() => {
    const current = toIso(partsRef.current) ?? "";
    if (current === value) return;
    const next = partsFromValue(value);
    partsRef.current = next;
    setParts(next);
  }, [value]);

  function emit(next: Parts) {
    partsRef.current = next;
    setParts(next);
    const nextValue = toIso(next) ?? "";
    if (nextValue !== value) onChange(nextValue);
  }

  function focusField(field: Field, options?: { yearCaret?: boolean }) {
    const el =
      field === "month"
        ? monthRef.current
        : field === "day"
          ? dayRef.current
          : yearRef.current;
    if (!el) return;
    if (field === "year" && options?.yearCaret) skipYearSelect.current = true;
    el.focus();
    if (field === "year" && options?.yearCaret) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }

  function changeMonth(raw: string) {
    const current = partsRef.current;
    let nextDigits = digits(raw, 2);
    if (nextDigits.length === 2 && Number(nextDigits) > 12) {
      nextDigits = nextDigits.slice(-1);
    }
    if (nextDigits.length === 1 && Number(nextDigits) > 1) {
      emit({ ...current, month: nextDigits.padStart(2, "0") });
      focusField("day");
      return;
    }
    emit({ ...current, month: nextDigits });
    if (nextDigits.length === 2 && Number(nextDigits) >= 1) focusField("day");
  }

  function changeDay(raw: string) {
    const current = partsRef.current;
    let nextDigits = digits(raw, 2);
    if (nextDigits.length === 2 && Number(nextDigits) > 31) {
      nextDigits = nextDigits.slice(-1);
    }
    if (nextDigits.length === 1 && Number(nextDigits) > 3) {
      emit({ ...current, day: nextDigits.padStart(2, "0") });
      focusField("year", { yearCaret: true });
      return;
    }
    emit({ ...current, day: nextDigits });
    if (nextDigits.length === 2 && Number(nextDigits) >= 1) {
      focusField("year", { yearCaret: true });
    }
  }

  function changeYear(raw: string) {
    emit({ ...partsRef.current, year: digits(raw, 4) });
  }

  function blurMonth() {
    const current = partsRef.current;
    if (!current.month || current.month.length === 2) return;
    emit({ ...current, month: current.month.padStart(2, "0") });
  }

  function blurDay() {
    const current = partsRef.current;
    if (!current.day || current.day.length === 2) return;
    emit({ ...current, day: current.day.padStart(2, "0") });
  }

  function blurYear() {
    const current = partsRef.current;
    if (/^\d{4}$/.test(current.year)) return;
    emit({ ...current, year: DEFAULT_YEAR });
  }

  function shift(field: Field, delta: number) {
    const current = partsRef.current;
    const yearNum = Number(/^\d{4}$/.test(current.year) ? current.year : DEFAULT_YEAR);
    if (field === "year") {
      emit({ ...current, year: String(yearNum + delta).padStart(4, "0") });
      return;
    }
    if (field === "month") {
      const start = Number(current.month) || (delta > 0 ? 0 : 1);
      const month = ((start - 1 + delta) % 12 + 12) % 12 + 1;
      emit({ ...current, month: String(month).padStart(2, "0") });
      return;
    }
    const monthNum = Number(current.month) || 1;
    const count = daysInMonth(yearNum, monthNum);
    const start = Number(current.day) || (delta > 0 ? 0 : 1);
    const day = ((start - 1 + delta) % count + count) % count + 1;
    emit({ ...current, day: String(day).padStart(2, "0") });
  }

  function onKeyDown(field: Field, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "/" || event.key === "-") {
      event.preventDefault();
      if (field === "month") focusField("day");
      if (field === "day") focusField("year", { yearCaret: true });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      shift(field, 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      shift(field, -1);
      return;
    }
    const el = event.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd =
      el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    if (event.key === "Backspace" && atStart) {
      event.preventDefault();
      if (field === "day") focusField("month");
      if (field === "year") focusField("day");
      return;
    }
    if (event.key === "ArrowLeft" && atStart) {
      event.preventDefault();
      if (field === "day") focusField("month");
      if (field === "year") focusField("day");
    }
    if (event.key === "ArrowRight" && atEnd) {
      event.preventDefault();
      if (field === "month") focusField("day");
      if (field === "day") focusField("year", { yearCaret: true });
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text").trim();
    const year = /^\d{4}$/.test(partsRef.current.year)
      ? partsRef.current.year
      : DEFAULT_YEAR;
    const parsed = parseLooseDate(text, year);
    if (!parsed) return;
    event.preventDefault();
    emit(parsed);
  }

  function openPicker() {
    const el = pickerRef.current;
    if (!el) return;
    const current = partsRef.current;
    const iso = toIso(current);
    const year = /^\d{4}$/.test(current.year) ? current.year : DEFAULT_YEAR;
    el.value = iso ?? (min && min.slice(0, 4) === year ? min : `${year}-01-01`);
    if (min) el.min = min;
    else el.removeAttribute("min");
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  }

  const fieldClass =
    "bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground";

  return (
    <div
      className={cn(
        "flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent px-2.5 text-base text-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm",
        className,
      )}
    >
      <input
        id={id}
        ref={monthRef}
        aria-label="Month"
        inputMode="numeric"
        autoComplete="off"
        placeholder="mm"
        maxLength={2}
        value={parts.month}
        onChange={(event) => changeMonth(event.target.value)}
        onBlur={blurMonth}
        onKeyDown={(event) => onKeyDown("month", event)}
        onPaste={onPaste}
        className={cn(fieldClass, "w-7")}
      />
      <span aria-hidden className="px-0.5 text-muted-foreground">
        /
      </span>
      <input
        ref={dayRef}
        aria-label="Day"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd"
        maxLength={2}
        value={parts.day}
        onChange={(event) => changeDay(event.target.value)}
        onBlur={blurDay}
        onKeyDown={(event) => onKeyDown("day", event)}
        onPaste={onPaste}
        className={cn(fieldClass, "w-7")}
      />
      <span aria-hidden className="px-0.5 text-muted-foreground">
        /
      </span>
      <input
        ref={yearRef}
        aria-label="Year"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={parts.year}
        onChange={(event) => changeYear(event.target.value)}
        onBlur={blurYear}
        onFocus={(event: FocusEvent<HTMLInputElement>) => {
          if (skipYearSelect.current) {
            skipYearSelect.current = false;
            const len = event.target.value.length;
            event.target.setSelectionRange(len, len);
            return;
          }
          event.target.select();
        }}
        onKeyDown={(event) => onKeyDown("year", event)}
        onPaste={onPaste}
        className={cn(fieldClass, "w-12")}
      />
      <button
        type="button"
        aria-label="Open calendar"
        onMouseDown={(event) => event.preventDefault()}
        onClick={openPicker}
        className="ml-auto text-muted-foreground hover:text-foreground"
      >
        <Calendar className="size-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        min={min}
        defaultValue={value}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            emit({
              month: "",
              day: "",
              year: /^\d{4}$/.test(partsRef.current.year)
                ? partsRef.current.year
                : DEFAULT_YEAR,
            });
            return;
          }
          emit(partsFromValue(next));
        }}
        className="sr-only"
      />
    </div>
  );
}
