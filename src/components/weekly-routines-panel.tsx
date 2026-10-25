"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BoxTagPicker, TaskTagPrefixes } from "@/components/box-tag-picker";
import { BoxTag, normalizeTaskTags } from "@/lib/box-tags";
import {
  handleTagChipKey,
  type TagChipUndoState,
} from "@/lib/tag-chip-key";
import { DAYS, DayKey } from "@/lib/week-plan";
import {
  RecurringTodo,
  deleteRecurringTodo,
  initRecurringTodosStore,
  listRecurringTodos,
  peekRecurringTodos,
  saveRecurringTodo,
  subscribeRecurringTodos,
} from "@/lib/recurring-todos";

type DraftFields = {
  text: string;
  tags: BoxTag[];
  startTime: string;
  endTime: string;
};

function emptyDraftFields(): DraftFields {
  return {
    text: "",
    tags: [],
    startTime: "",
    endTime: "",
  };
}

/**
 * Manage recurring weekly board tasks. These never appear as calendar events.
 */
export function WeeklyRoutinesPanel() {
  const [todos, setTodos] = useState<RecurringTodo[]>([]);
  const [ready, setReady] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [draftDay, setDraftDay] = useState<DayKey | null>(null);
  const [draft, setDraft] = useState<DraftFields>(emptyDraftFields);
  const [saving, setSaving] = useState(false);
  const tagChipUndoRef = useRef<TagChipUndoState | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setTodos(await listRecurringTodos());
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initRecurringTodosStore();
      if (cancelled) return;
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeRecurringTodos(() => {
      setTodos(peekRecurringTodos());
    });
  }, []);

  useEffect(() => {
    if (draftDay) {
      draftInputRef.current?.focus();
    }
  }, [draftDay]);

  function startDraft(day: DayKey) {
    setDraftDay(day);
    setDraft(emptyDraftFields());
    tagChipUndoRef.current = null;
  }

  function cancelDraft() {
    setDraftDay(null);
    setDraft(emptyDraftFields());
    tagChipUndoRef.current = null;
  }

  async function handleAdd(day: DayKey) {
    const text = draft.text.trim();
    if (!text) return;
    setSaving(true);
    try {
      await saveRecurringTodo({
        text,
        day,
        tags: normalizeTaskTags(draft.tags),
        startTime: draft.startTime || undefined,
        endTime: draft.endTime || undefined,
      });
      cancelDraft();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(todo: RecurringTodo, patch: Partial<RecurringTodo>) {
    setSaving(true);
    try {
      await saveRecurringTodo({
        id: todo.id,
        text: patch.text ?? todo.text,
        day: patch.day ?? todo.day,
        tags: normalizeTaskTags(patch.tags ?? todo.tags),
        startTime:
          patch.startTime !== undefined ? patch.startTime : todo.startTime,
        endTime: patch.endTime !== undefined ? patch.endTime : todo.endTime,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteRecurringTodo(id);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <section className="animate-rise rounded-2xl border border-border/70 bg-white/65 p-4 backdrop-blur-sm sm:p-5">
        <p className="text-sm text-muted-foreground">Loading weekly routines…</p>
      </section>
    );
  }

  const sorted = [...todos].sort((a, b) => {
    const ai = DAYS.findIndex((d) => d.key === a.day);
    const bi = DAYS.findIndex((d) => d.key === b.day);
    if (ai !== bi) return ai - bi;
    const aTime = a.startTime ?? "";
    const bTime = b.startTime ?? "";
    if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
    if (aTime !== bTime) return aTime ? -1 : 1;
    return a.text.localeCompare(b.text);
  });

  const todosByDay = DAYS.map((day) => ({
    day,
    items: sorted.filter((t) => t.day === day.key),
  }));

  function renderTodoRow(todo: RecurringTodo) {
    return (
      <li
        key={todo.id}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-white/80 px-3 py-2"
      >
        <select
          value={todo.day}
          disabled={saving}
          onChange={(e) =>
            void handleUpdate(todo, { day: e.target.value as DayKey })
          }
          className="h-8 rounded-lg border border-input bg-white px-2 text-xs"
          aria-label="Day of week"
        >
          {DAYS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.short}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-sm leading-snug">
          <TaskTagPrefixes
            tags={todo.tags}
            separator={false}
          />
        </span>
        <Input
          value={todo.text}
          disabled={saving}
          onChange={(e) => {
            tagChipUndoRef.current = null;
            setTodos((list) =>
              list.map((t) =>
                t.id === todo.id ? { ...t, text: e.target.value } : t,
              ),
            );
          }}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (
              next &&
              next !==
                peekRecurringTodos().find((t) => t.id === todo.id)?.text
            ) {
              void handleUpdate(todo, { text: next });
            } else if (!next) {
              void refresh();
            }
          }}
          onKeyDown={(e) => {
            if (
              handleTagChipKey(e, {
                key: `routine:${todo.id}`,
                value: todo.text,
                tags: todo.tags,
                undoRef: tagChipUndoRef,
                onChange: ({ value, tags }) => {
                  setTodos((list) =>
                    list.map((t) =>
                      t.id === todo.id
                        ? { ...t, text: value, tags }
                        : t,
                    ),
                  );
                  void handleUpdate(todo, {
                    text: value,
                    tags: normalizeTaskTags(tags),
                  });
                },
              })
            ) {
              return;
            }
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="h-8 min-w-0 flex-1 basis-40 bg-white text-sm"
          aria-label="Routine text"
        />
        <label className="text-xs">
          <span className="sr-only">Start</span>
          <Input
            type="time"
            value={todo.startTime ?? ""}
            disabled={saving}
            onChange={(e) =>
              setTodos((list) =>
                list.map((t) =>
                  t.id === todo.id
                    ? { ...t, startTime: e.target.value || undefined }
                    : t,
                ),
              )
            }
            onBlur={(e) => {
              const next = e.target.value || undefined;
              if (next !== (todo.startTime ?? undefined)) {
                void handleUpdate(todo, { startTime: next ?? "" });
              }
            }}
            className="h-8 w-[7.5rem] bg-white text-xs"
            aria-label="Start time"
          />
        </label>
        <span className="text-xs text-muted-foreground">–</span>
        <label className="text-xs">
          <span className="sr-only">End</span>
          <Input
            type="time"
            value={todo.endTime ?? ""}
            disabled={saving}
            onChange={(e) =>
              setTodos((list) =>
                list.map((t) =>
                  t.id === todo.id
                    ? { ...t, endTime: e.target.value || undefined }
                    : t,
                ),
              )
            }
            onBlur={(e) => {
              const next = e.target.value || undefined;
              if (next !== (todo.endTime ?? undefined)) {
                void handleUpdate(todo, { endTime: next ?? "" });
              }
            }}
            className="h-8 w-[7.5rem] bg-white text-xs"
            aria-label="End time"
          />
        </label>
        <BoxTagPicker
          tags={todo.tags}
          onChange={(tags) => {
            tagChipUndoRef.current = null;
            void handleUpdate(todo, { tags: normalizeTaskTags(tags) });
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${todo.text}`}
          disabled={saving}
          onClick={() => void handleDelete(todo.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </li>
    );
  }

  function renderDraftRow(day: DayKey) {
    return (
      <li className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-seafoam/40 bg-white/50 px-3 py-2">
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Task</span>
          <Input
            ref={draftInputRef}
            value={draft.text}
            disabled={saving}
            onChange={(e) => {
              tagChipUndoRef.current = null;
              setDraft((d) => ({ ...d, text: e.target.value }));
            }}
            onKeyDown={(e) => {
              if (
                handleTagChipKey(e, {
                  key: `routine-draft:${day}`,
                  value: draft.text,
                  tags: draft.tags,
                  undoRef: tagChipUndoRef,
                  onChange: ({ value, tags }) => {
                    setDraft((d) => ({ ...d, text: value, tags }));
                  },
                })
              ) {
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd(day);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelDraft();
              }
            }}
            placeholder="e.g. Practice scales"
            className="bg-white/80"
            aria-label="New routine text"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Start</span>
          <Input
            type="time"
            value={draft.startTime}
            disabled={saving}
            onChange={(e) =>
              setDraft((d) => ({ ...d, startTime: e.target.value }))
            }
            className="w-[7.5rem] bg-white/80"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">End</span>
          <Input
            type="time"
            value={draft.endTime}
            disabled={saving}
            onChange={(e) =>
              setDraft((d) => ({ ...d, endTime: e.target.value }))
            }
            className="w-[7.5rem] bg-white/80"
          />
        </label>
        <div className="pb-0.5">
          <BoxTagPicker
            tags={draft.tags}
            onChange={(tags) => {
              tagChipUndoRef.current = null;
              setDraft((d) => ({ ...d, tags: normalizeTaskTags(tags) }));
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={saving || !draft.text.trim()}
          onClick={() => void handleAdd(day)}
          className="bg-seafoam text-white hover:bg-seafoam/90"
        >
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={cancelDraft}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <section className="animate-rise rounded-2xl border border-border/70 bg-white/65 p-4 backdrop-blur-sm sm:p-5">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        aria-expanded={sectionOpen}
        className="flex w-full items-start gap-2 text-left"
      >
        <ChevronDown
          className={`mt-1 size-5 shrink-0 text-muted-foreground transition-transform ${
            sectionOpen ? "" : "-rotate-90"
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-semibold text-ink">
            Weekly routines
            {!sectionOpen && todos.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {todos.length}
              </span>
            ) : null}
          </h2>
          {sectionOpen ? (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Recurring tasks for the week board only — they never show as
              calendar events.
            </p>
          ) : null}
        </div>
      </button>

      {sectionOpen ? (
        <div className="mt-4 space-y-3">
          {todosByDay.map(({ day, items }) => {
            const drafting = draftDay === day.key;
            return (
              <div key={day.key}>
                <div className="mb-2 flex items-center gap-1 px-1">
                  <span className="font-heading text-sm font-semibold text-ink">
                    {day.label}
                  </span>
                  {items.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    disabled={saving}
                    aria-label={`Add routine on ${day.label}`}
                    onClick={() => {
                      if (drafting) cancelDraft();
                      else startDraft(day.key);
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                {items.length > 0 || drafting ? (
                  <ul className="space-y-2">
                    {items.map(renderTodoRow)}
                    {drafting ? renderDraftRow(day.key) : null}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
