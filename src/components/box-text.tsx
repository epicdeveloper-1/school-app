"use client";

import { useEffect, useRef } from "react";
import { TaskRichText } from "@/components/task-rich-text";
import {
  isLinkPopoverOpen,
  openLinkPopover,
} from "@/components/link-url-popover";
import {
  hrefForVisibleRange,
  linkFieldPrefill,
  linkVisibleSelection,
} from "@/lib/task-links";

type BoxTextBinding = {
  getText: () => string;
  onChange: (next: string) => void;
};

const bindings = new Map<HTMLElement, BoxTextBinding>();
const HOTKEY = "__schoolAppLinkHotkey";

function visibleOffset(
  root: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  if (!root.contains(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  return range.toString().length;
}

function boxRoot(node: Node | null): HTMLElement | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const root = element?.closest("[data-box-text]");
  return root instanceof HTMLElement ? root : null;
}

function onLinkHotkey(event: KeyboardEvent) {
  if (event.altKey || event.shiftKey || event.isComposing || event.repeat) return;
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() !== "k" && event.code !== "KeyK") return;

  const target = event.target;
  if (target instanceof Element && target.closest("[data-link-popover]")) {
    event.preventDefault();
    return;
  }
  if (isLinkPopoverOpen()) return;

  const inField =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);
  if (inField) {
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      if (start !== end) event.preventDefault();
    }
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const root = boxRoot(selection.anchorNode);
  if (!root || boxRoot(selection.focusNode) !== root) return;
  const binding = bindings.get(root);
  if (!binding) return;
  const start = visibleOffset(root, selection.anchorNode!, selection.anchorOffset);
  const end = visibleOffset(root, selection.focusNode!, selection.focusOffset);
  if (start == null || end == null || start === end) return;

  event.preventDefault();
  event.stopPropagation();

  const visStart = Math.min(start, end);
  const visEnd = Math.max(start, end);
  const label = selection.toString();
  const highlightRange = selection.getRangeAt(0).cloneRange();
  const text = binding.getText();
  const prefill = linkFieldPrefill(
    label,
    hrefForVisibleRange(text, visStart, visEnd),
  );

  openLinkPopover({
    prefill,
    highlightRange,
    getAnchor: () => {
      const rect = highlightRange.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left };
    },
    onResolve: (url) => {
      if (!url) return;
      const next = linkVisibleSelection(
        binding.getText(),
        visStart,
        visEnd,
        label,
        url,
      );
      if (next == null) return;
      binding.onChange(next);
      selection.removeAllRanges();
    },
  });
}

function ensureLinkHotkey() {
  if (typeof window === "undefined") return;
  const host = window as Window & {
    [HOTKEY]?: (event: KeyboardEvent) => void;
  };
  if (host[HOTKEY]) {
    window.removeEventListener("keydown", host[HOTKEY], true);
  }
  host[HOTKEY] = onLinkHotkey;
  window.addEventListener("keydown", onLinkHotkey, true);
}

type BoxTextProps = {
  text: string;
  dimmed?: boolean;
  className?: string;
  onChange?: (next: string) => void;
};

/** Task text that can be selected and linked with Ctrl/Cmd+K. */
export function BoxText({ text, dimmed, className, onChange }: BoxTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const textRef = useRef(text);
  const onChangeRef = useRef(onChange);
  textRef.current = text;
  onChangeRef.current = onChange;

  useEffect(() => {
    ensureLinkHotkey();
    const el = ref.current;
    if (!el) return;
    bindings.set(el, {
      getText: () => textRef.current,
      onChange: (next) => onChangeRef.current?.(next),
    });
    return () => {
      bindings.delete(el);
    };
  }, []);

  return (
    <span ref={ref} data-box-text="" className={className}>
      <TaskRichText text={text} dimmed={dimmed} />
    </span>
  );
}
