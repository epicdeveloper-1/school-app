"use client";

import type { KeyboardEvent } from "react";
import {
  linkPopoverSession,
  openLinkPopover,
} from "@/components/link-url-popover";
import {
  applyLinkAtSelection,
  linkFieldPrefillForSelection,
} from "@/lib/task-links";

/** Ctrl/Cmd+K opens the link popup for the input selection. */
export function handleTaskLinkKey(
  event: KeyboardEvent<HTMLInputElement>,
  value: string,
  onChange: (next: string) => void,
  onBeforePrompt?: () => void,
  onAfterPrompt?: () => void,
): boolean {
  if (event.altKey || event.shiftKey || event.nativeEvent.isComposing) return false;
  if (!(event.ctrlKey || event.metaKey)) return false;
  if (event.key.toLowerCase() !== "k" && event.code !== "KeyK") return false;
  const input =
    event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget
      : event.target instanceof HTMLInputElement
        ? event.target
        : null;
  if (!input) return false;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start === end) return false;

  event.preventDefault();
  event.stopPropagation();
  onBeforePrompt?.();
  const prefill = linkFieldPrefillForSelection(value, start, end);
  const mySession = openLinkPopover({
    prefill,
    getAnchor: () => {
      if (!input.isConnected) return null;
      const rect = input.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left };
    },
    onResolve: (url) => {
      if (linkPopoverSession() !== mySession && url === null) return;
      let applied: ReturnType<typeof applyLinkAtSelection> = null;
      if (url) {
        applied = applyLinkAtSelection(value, start, end, url);
        if (applied) onChange(applied.value);
      }
      const next = applied;
      requestAnimationFrame(() => {
        if (linkPopoverSession() !== mySession) {
          onAfterPrompt?.();
          return;
        }
        input.focus();
        if (next) {
          input.setSelectionRange(next.selectionStart, next.selectionEnd);
        } else {
          input.setSelectionRange(start, end);
        }
        onAfterPrompt?.();
      });
    },
  });
  return true;
}
