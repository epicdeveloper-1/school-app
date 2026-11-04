import type { KeyboardEvent } from "react";
import { applyBoardDurationFromSpace } from "@/lib/task-time";

export type DurationChipUndoState = {
  key: string;
  value: string;
  estimateMinutes: number | null;
  cursor: number;
};

/**
 * Space after a trailing `[duration]` lifts it off the text.
 * Backspace undoes that conversion. Returns true when the event was handled.
 */
export function handleDurationChipKey(
  e: KeyboardEvent<HTMLInputElement>,
  opts: {
    key: string;
    value: string;
    estimateMinutes: number | null;
    undoRef: { current: DurationChipUndoState | null };
    onChange: (next: {
      value: string;
      estimateMinutes: number | null;
    }) => void;
  },
): boolean {
  const { value, estimateMinutes, undoRef, onChange } = opts;
  const input = e.currentTarget;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;

  if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (start !== end) {
      undoRef.current = null;
      return false;
    }
    const applied = applyBoardDurationFromSpace(value, start);
    if (!applied) {
      undoRef.current = null;
      return false;
    }
    e.preventDefault();
    onChange({
      value: applied.value,
      estimateMinutes: applied.estimateMinutes,
    });
    undoRef.current = {
      key: opts.key,
      value: applied.typedValue,
      estimateMinutes,
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
      onChange({ value: undo.value, estimateMinutes: undo.estimateMinutes });
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
