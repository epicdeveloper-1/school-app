"use client";

import { Search } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type LinkAnchor = { top: number; bottom: number; left: number };

export type LinkPopoverRequest = {
  session: number;
  getAnchor: () => LinkAnchor | null;
  prefill: string;
  highlightRange?: Range | null;
  onResolve: (url: string | null) => void;
};

type Listener = () => void;

let request: LinkPopoverRequest | null = null;
let session = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

const HIGHLIGHT_STYLE_ID = "task-link-highlight-style";

/** Injected at runtime so the production CSS parser never sees `::highlight`. */
function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent =
    "::highlight(task-link){background-color:#d4d4d4;color:CanvasText}";
  document.head.appendChild(style);
}

function setHighlight(range: Range | null | undefined) {
  const highlights = (CSS as { highlights?: Map<string, unknown> }).highlights;
  if (!highlights || typeof Highlight === "undefined") return;
  if (!range) {
    highlights.delete("task-link");
    return;
  }
  ensureHighlightStyle();
  highlights.set("task-link", new Highlight(range));
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return request;
}

export function linkPopoverSession() {
  return session;
}

export function isLinkPopoverOpen() {
  return request !== null;
}

export function openLinkPopover(
  next: Omit<LinkPopoverRequest, "session">,
): number {
  const prev = request;
  session += 1;
  request = { ...next, session };
  setHighlight(next.highlightRange);
  emit();
  if (prev && prev !== request) prev.onResolve(null);
  return session;
}

export function closeLinkPopover(url: string | null) {
  const current = request;
  if (!current) return;
  request = null;
  setHighlight(null);
  emit();
  current.onResolve(url);
}

function anchorOf(current: LinkPopoverRequest): LinkAnchor | null {
  try {
    return current.getAnchor();
  } catch {
    return null;
  }
}

function place(anchor: LinkAnchor, width: number, height: number) {
  const margin = 8;
  let left = anchor.left;
  let top = anchor.bottom - 6;
  if (left + width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - width);
  }
  if (left < margin) left = margin;
  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - height - 4);
  }
  return { top, left };
}

export function LinkUrlPopoverHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setUrl(current?.prefill ?? "");
  }, [current]);

  useLayoutEffect(() => {
    if (!current) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorOf(current);
      const panel = panelRef.current;
      if (!anchor || !panel) {
        setPos(null);
        return;
      }
      setPos(place(anchor, panel.offsetWidth, panel.offsetHeight));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = current.prefill === "https://" ? current.prefill.length : 0;
    input.setSelectionRange(end, end);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onPointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.target instanceof Node && panel.contains(event.target)) return;
      closeLinkPopover(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [current]);

  if (!current || typeof document === "undefined") return null;

  const usable = url.trim().length > 0 && !/^https?:\/\/$/i.test(url.trim());

  return createPortal(
    <form
      ref={panelRef}
      data-link-popover=""
      role="dialog"
      aria-label="Add link"
      className="fixed z-[90] flex items-center gap-1.5 rounded-lg bg-white px-1.5 py-1.5 shadow-[0_1px_3px_rgba(60,64,67,0.3),0_4px_12px_rgba(60,64,67,0.18)]"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? 0,
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!usable) return;
        closeLinkPopover(url.trim());
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        closeLinkPopover(null);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-1.5 left-4 h-3 w-5 rounded-t-md bg-white"
      />
      <label className="flex h-8 min-w-0 items-center gap-1.5 rounded border-2 border-[#1a73e8] bg-white px-1.5">
        <Search className="size-4 shrink-0 text-[#5f6368]" strokeWidth={2} />
        <input
          ref={inputRef}
          data-link-url-input=""
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-label="Link URL"
          spellCheck={false}
          className="w-[min(52vw,240px)] bg-transparent text-sm text-[#202124] outline-none"
        />
      </label>
      <button
        type="submit"
        className="shrink-0 rounded px-1.5 py-1 text-sm font-medium text-[#1a73e8] hover:bg-[#1a73e8]/10"
      >
        Apply
      </button>
    </form>,
    document.body,
  );
}
