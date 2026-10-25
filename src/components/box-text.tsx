"use client";

import { useEffect, useRef } from "react";
import { TaskRichText } from "@/components/task-rich-text";
import { linkVisibleSelection } from "@/lib/task-links";

type BoxTextBinding = {
  getText: () => string;
  onChange: (next: string) => void;
};

const bindings = new Map<HTMLElement, BoxTextBinding>();
let listening = false;

function visibleOffset(
  root: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  const element =
    node instanceof Element ? node : node.parentElement;
  const marked = element?.closest("[data-vis-start]");
  if (!(marked instanceof HTMLElement) || !root.contains(marked)) return null;
  const base = Number(marked.dataset.visStart);
  if (!Number.isFinite(base)) return null;
  const range = document.createRange();
  range.selectNodeContents(marked);
  try {
    range.setEnd(node, offset);
  } catch {
    return base;
  }
  return base + range.toString().length;
}

function onLinkHotkey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.shiftKey) return;
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") {
    return;
  }
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (!anchor || !focus) return;
  const anchorEl = anchor instanceof Element ? anchor : anchor.parentElement;
  const root = anchorEl?.closest("[data-box-text]");
  if (!(root instanceof HTMLElement) || !root.contains(focus)) return;
  const binding = bindings.get(root);
  if (!binding) return;
  const start = visibleOffset(root, anchor, selection.anchorOffset);
  const end = visibleOffset(root, focus, selection.focusOffset);
  if (start == null || end == null || start === end) return;
  event.preventDefault();
  event.stopPropagation();
  const next = linkVisibleSelection(
    binding.getText(),
    Math.min(start, end),
    Math.max(start, end),
    selection.toString(),
  );
  if (next == null) return;
  binding.onChange(next);
  selection.removeAllRanges();
}

function ensureLinkHotkey() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("keydown", onLinkHotkey);
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
