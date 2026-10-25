"use client";

import type { KeyboardEvent } from "react";
import { applyLinkAtSelection } from "@/lib/task-links";

/** Ctrl/Cmd+K turns the input selection into a markdown link. */
export function handleTaskLinkKey(
  event: KeyboardEvent<HTMLInputElement>,
  value: string,
  onChange: (next: string) => void,
  onBeforePrompt?: () => void,
  onAfterPrompt?: () => void,
): boolean {
  if (event.altKey || event.shiftKey) return false;
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  const input =
    event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget
      : event.target instanceof HTMLInputElement
        ? event.target
        : null;
  if (!input) return true;
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
  const next = applied;
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(next.selectionStart, next.selectionEnd);
  });
  return true;
}
