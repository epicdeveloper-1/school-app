"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { BoxText } from "@/components/box-text";
import { handleTaskLinkKey } from "@/components/task-link-key";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SubBox } from "@/lib/sub-boxes";
import { visibleTaskText } from "@/lib/task-links";
import { createId } from "@/lib/week-plan";

export function SubBoxToggle({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? "Collapse sub-boxes" : "Expand sub-boxes"}
      title={open ? "Collapse sub-boxes" : "Expand sub-boxes"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="mt-0.5 grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary/70 hover:text-ink"
    >
      <ChevronRight
        className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        aria-hidden
      />
    </button>
  );
}

export function SubBoxList({
  items,
  onChange,
  pendingEditId,
  onPendingHandled,
}: {
  items: SubBox[];
  onChange: (next: SubBox[]) => void;
  pendingEditId?: string | null;
  onPendingHandled?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const itemsRef = useRef(items);
  const onChangeRef = useRef(onChange);
  const draftRef = useRef(draft);
  const editingIdRef = useRef<string | null>(null);
  const handledRef = useRef(onPendingHandled);
  const suppressBlurRef = useRef(false);
  const ignoreBlurUntilRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  itemsRef.current = items;
  onChangeRef.current = onChange;
  draftRef.current = draft;
  handledRef.current = onPendingHandled;

  useEffect(() => {
    if (!pendingEditId) return;
    const sub = itemsRef.current.find((item) => item.id === pendingEditId);
    beginEdit(pendingEditId, sub?.text ?? "");
    handledRef.current?.();
  }, [pendingEditId]);

  useEffect(() => {
    if (!editingId) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editingId]);

  function beginEdit(id: string, text: string) {
    editingIdRef.current = id;
    ignoreBlurUntilRef.current = performance.now() + 300;
    draftRef.current = text;
    setEditingId(id);
    setDraft(text);
  }

  function commit(id: string, text = draftRef.current) {
    onChangeRef.current(
      itemsRef.current.map((item) =>
        item.id === id ? { ...item, text } : item,
      ),
    );
  }

  function writeDraft(id: string, text: string) {
    draftRef.current = text;
    setDraft(text);
    commit(id, text);
  }

  function updateText(id: string, text: string) {
    onChangeRef.current(
      itemsRef.current.map((item) =>
        item.id === id ? { ...item, text } : item,
      ),
    );
  }

  function toggleDone(id: string) {
    onChangeRef.current(
      itemsRef.current.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    );
  }

  function remove(id: string) {
    onChangeRef.current(itemsRef.current.filter((item) => item.id !== id));
    if (editingIdRef.current === id) {
      editingIdRef.current = null;
      setEditingId(null);
    }
  }

  function insertAfter(id: string) {
    const text = draftRef.current;
    const created: SubBox = { id: createId(), text: "", done: false };
    const next: SubBox[] = [];
    for (const item of itemsRef.current) {
      next.push(item.id === id ? { ...item, text } : item);
      if (item.id === id) next.push(created);
    }
    editingIdRef.current = created.id;
    ignoreBlurUntilRef.current = performance.now() + 300;
    onChangeRef.current(next);
    setEditingId(created.id);
    setDraft("");
  }

  return (
    <ul className="space-y-1" aria-label="Sub-boxes">
      {items.map((sub) => {
        const editing = editingId === sub.id;
        return (
          <li key={sub.id} className="group/sub flex items-start gap-2">
            <Checkbox
              checked={sub.done}
              onCheckedChange={() => toggleDone(sub.id)}
              className="mt-0.5"
              aria-label={`Mark sub-box ${visibleTaskText(sub.text) || "empty"} complete`}
            />
            {editing ? (
              <Input
                ref={inputRef}
                autoFocus
                value={draft}
                placeholder="Sub-box"
                aria-label="Edit sub-box"
                onChange={(event) => writeDraft(sub.id, event.target.value)}
                onBlur={(event) => {
                  if (suppressBlurRef.current) return;
                  if (!event.currentTarget.isConnected) return;
                  if (editingIdRef.current !== sub.id) return;
                  writeDraft(sub.id, event.currentTarget.value);
                  if (performance.now() < ignoreBlurUntilRef.current) return;
                  editingIdRef.current = null;
                  setEditingId((cur) => (cur === sub.id ? null : cur));
                }}
                onKeyDown={(event) => {
                  if (
                    handleTaskLinkKey(
                      event,
                      draftRef.current,
                      (value) => writeDraft(sub.id, value),
                      () => {
                        suppressBlurRef.current = true;
                      },
                      () => {
                        suppressBlurRef.current = false;
                      },
                    )
                  ) {
                    return;
                  }
                  if (event.key === "Enter" && event.shiftKey) {
                    event.preventDefault();
                    insertAfter(sub.id);
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit(sub.id);
                    editingIdRef.current = null;
                    setEditingId(null);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraft(sub.text);
                    editingIdRef.current = null;
                    setEditingId(null);
                  }
                }}
                className="h-7 min-w-0 flex-1 bg-white/90 text-sm"
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  const target = event.target;
                  if (target instanceof Element && target.closest("a")) return;
                  const selection = window.getSelection();
                  if (selection && !selection.isCollapsed) return;
                  beginEdit(sub.id, sub.text);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  beginEdit(sub.id, sub.text);
                }}
                className={`min-w-0 flex-1 break-words rounded-sm text-left text-sm leading-snug outline-none hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  sub.done ? "line-through" : ""
                }`}
              >
                {sub.text ? (
                  <BoxText
                    text={sub.text}
                    dimmed={sub.done}
                    onChange={(text) => updateText(sub.id, text)}
                  />
                ) : (
                  <span className="text-muted-foreground">Sub-box</span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(sub.id)}
              className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover/sub:opacity-100 hover:text-destructive"
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}
