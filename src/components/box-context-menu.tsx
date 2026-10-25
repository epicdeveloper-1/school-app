"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Clock, Hourglass, Tags } from "lucide-react";
import { BoxTagList } from "@/components/box-tag-picker";
import { Input } from "@/components/ui/input";
import type { BoxTag } from "@/lib/box-tags";
import {
  formatDuration,
  formatTimeRange,
  parseBoardTimeRange,
  parseDuration,
  type BoardTimeRange,
} from "@/lib/task-time";

type Panel = "menu" | "duration" | "time" | "tags";

type BoxContextMenuProps = {
  x: number;
  y: number;
  minutes?: number;
  time: BoardTimeRange | null;
  tags: BoxTag[];
  canTime: boolean;
  canTags: boolean;
  /** Shown under time and tag editors when the change is shared. */
  scopeNote?: string;
  onDuration: (minutes: number | undefined) => void;
  onTime: (time: BoardTimeRange | null) => void;
  onTags: (tags: BoxTag[]) => void;
  onClose: () => void;
};

export function DismissBoxMenu({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    onDismiss();
  }, [onDismiss]);
  return null;
}

export function BoxContextMenu({
  x,
  y,
  minutes,
  time,
  tags,
  canTime,
  canTags,
  scopeNote,
  onDuration,
  onTime,
  onTags,
  onClose,
}: BoxContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel>("menu");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const skipCommitRef = useRef(false);
  const onCloseRef = useRef(onClose);
  /** Focus and panel growth can scroll the page; that must not dismiss. */
  const ignoreScrollUntilRef = useRef(0);
  onCloseRef.current = onClose;

  function holdThroughScroll() {
    ignoreScrollUntilRef.current = performance.now() + 400;
  }

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setPos({ left, top });
  }, [x, y, panel, canTime, canTags, tags.length]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (eventInsideMenu(event, rootRef.current)) return;
      onCloseRef.current();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (panel !== "menu") {
        event.preventDefault();
        setPanel("menu");
        return;
      }
      onCloseRef.current();
    }
    function onScroll(event: Event) {
      if (performance.now() < ignoreScrollUntilRef.current) return;
      if (eventInsideMenu(event, rootRef.current)) return;
      if (rootRef.current?.contains(document.activeElement)) return;
      onCloseRef.current();
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [panel]);

  const hasDuration = Boolean(minutes && minutes > 0);
  const hasTime = time != null;

  const menu = (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Box actions"
      data-box-menu
      onMouseDown={holdThroughScroll}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[80] w-52 rounded-xl border border-border/80 bg-white p-1.5 shadow-lg"
      style={{
        left: pos?.left ?? x,
        top: pos?.top ?? y,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {panel === "menu" ? (
        <>
          <MenuItem
            icon={<Hourglass className="size-3.5" />}
            label={hasDuration ? "Edit duration" : "Add duration"}
            onClick={() => {
              holdThroughScroll();
              skipCommitRef.current = false;
              setPanel("duration");
            }}
          />
          {canTime && (
            <MenuItem
              icon={<Clock className="size-3.5" />}
              label={hasTime ? "Edit time" : "Add time"}
              onClick={() => {
                holdThroughScroll();
                skipCommitRef.current = false;
                setPanel("time");
              }}
            />
          )}
          {canTags && (
            <MenuItem
              icon={<Tags className="size-3.5" />}
              label="Edit tags"
              onClick={() => {
                holdThroughScroll();
                setPanel("tags");
              }}
            />
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              skipCommitRef.current = true;
            }}
            onClick={() => setPanel("menu")}
            className="mb-1 flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-xs text-muted-foreground hover:bg-secondary/70"
          >
            <ChevronLeft className="size-3.5" />
            Box actions
          </button>
          {panel === "duration" && (
            <ValueField
              skipCommitRef={skipCommitRef}
              label="Duration"
              initial={hasDuration ? formatDuration(minutes!) : ""}
              placeholder="45m"
              errorHint="Use 45m or 1h 30m"
              onCancel={() => setPanel("menu")}
              onCommit={(raw) => {
                const trimmed = raw.trim();
                if (!trimmed) {
                  onDuration(undefined);
                  onClose();
                  return true;
                }
                const parsed = parseDuration(trimmed);
                if (parsed === null) return false;
                onDuration(parsed);
                onClose();
                return true;
              }}
            />
          )}
          {panel === "time" && (
            <ValueField
              skipCommitRef={skipCommitRef}
              label="Time"
              initial={
                time
                  ? (formatTimeRange(time.startTime, time.endTime) ?? "")
                  : ""
              }
              placeholder="3-5pm"
              errorHint="Use 3pm or 3-5pm"
              note={scopeNote}
              onCancel={() => setPanel("menu")}
              onCommit={(raw) => {
                const trimmed = raw.trim();
                if (!trimmed) {
                  onTime(null);
                  onClose();
                  return true;
                }
                const parsed = parseBoardTimeRange(trimmed);
                if (!parsed) return false;
                onTime(parsed);
                onClose();
                return true;
              }}
            />
          )}
          {panel === "tags" && (
            <div
              role="listbox"
              aria-multiselectable
              aria-label="Tags"
              className="max-h-64 overflow-y-auto"
            >
              {scopeNote ? (
                <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
                  {scopeNote}
                </p>
              ) : null}
              <BoxTagList tags={tags} onChange={onTags} />
            </div>
          )}
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}

/** True when the event started in the menu, even if that node has since unmounted. */
function eventInsideMenu(event: Event, root: HTMLElement | null) {
  if (!root) return false;
  const target = event.target;
  if (target instanceof Node && root.contains(target)) return true;
  return event.composedPath().includes(root);
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-secondary/70"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}

function ValueField({
  skipCommitRef,
  label,
  initial,
  placeholder,
  errorHint,
  note,
  onCommit,
  onCancel,
}: {
  skipCommitRef: { current: boolean };
  label: string;
  initial: string;
  placeholder: string;
  errorHint: string;
  note?: string;
  /** Return false to keep the field open. */
  onCommit: (value: string) => boolean;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState(false);
  const doneRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
  }, []);

  function commit() {
    if (doneRef.current || skipCommitRef.current) return;
    const ok = onCommit(draft);
    if (ok) doneRef.current = true;
    else setError(true);
  }

  return (
    <label className="block px-1 pb-1">
      <span className="mb-1 block px-1 text-xs font-medium text-ink">
        {label}
      </span>
      <Input
        ref={inputRef}
        value={draft}
        aria-label={label}
        placeholder={placeholder}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          doneRef.current = false;
          setError(false);
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            doneRef.current = true;
            skipCommitRef.current = true;
            onCancel();
          }
        }}
        className="h-8 bg-white text-sm"
      />
      {error ? (
        <span className="mt-1 block px-1 text-[11px] text-red-600">
          {errorHint}
        </span>
      ) : note ? (
        <span className="mt-1 block px-1 text-[11px] leading-snug text-muted-foreground">
          {note}
        </span>
      ) : null}
    </label>
  );
}
