import type { KeyboardEvent } from "react";
import {
  applyBoardTimeFromSpace,
  type BoardTimeRange,
} from "@/lib/task-time";

export type TimeChipUndoState = {
  key: string;
  value: string;
  time: BoardTimeRange | null;
  cursor: number;
};

/**
 * Space after a trailing `(time range)` lifts it off the text.
 * Backspace undoes that conversion. Returns true when the event was handled.
 */
export function handleTimeChipKey(
  e: KeyboardEvent<HTMLInputElement>,
  opts: {
    key: string;
    value: string;
    time: BoardTimeRange | null;
    undoRef: { current: TimeChipUndoState | null };
    onChange: (next: { value: string; time: BoardTimeRange | null }) => void;
  },
): boolean {
  const { value, time, undoRef, onChange } = opts;
  const input = e.currentTarget;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;

  if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (start !== end) {
      undoRef.current = null;
      return false;
    }
    const applied = applyBoardTimeFromSpace(value, start);
    if (!applied) {
      undoRef.current = null;
      return false;
    }
    e.preventDefault();
    onChange({ value: applied.value, time: applied.time });
    undoRef.current = {
      key: opts.key,
      value: applied.typedValue,
      time,
      cursor: applied.typedCursor,
    };
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(applied.cursor, applied.cursor);
    });
    return true;
  }

  if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const undo = undoRef.current;
    if (undo && undo.key === opts.key && start === end) {
      e.preventDefault();
      undoRef.current = null;
      onChange({ value: undo.value, time: undo.time });
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(undo.cursor, undo.cursor);
      });
      return true;
    }
    return false;
  }

  if (e.key.length === 1 || e.key === "Delete" || e.key === "Enter") {
    undoRef.current = null;
  }
  return false;
}
