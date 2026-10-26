"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { BoxTagPicker, TaskTagPrefixes } from "@/components/box-tag-picker";
import { BoxText } from "@/components/box-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { BoxTag } from "@/lib/box-tags";
import { normalizeTaskTags } from "@/lib/box-tags";
import { visibleTaskText } from "@/lib/task-links";
import {
  handleTagChipKey,
  type TagChipUndoState,
} from "@/lib/tag-chip-key";
import {
  Reminder,
  addReminder,
  deleteReminder,
  initRemindersStore,
  isReminderPinnedToday,
  listReminders,
  peekReminders,
  subscribeReminders,
  toggleReminder,
  toggleReminderPinnedToday,
  updateReminder,
} from "@/lib/reminders";
import { initPlansStore } from "@/lib/week-plan";

function ReminderRow({
  reminder,
  pinned,
  onToggle,
  onTags,
  onText,
  onToggleToday,
  onDelete,
}: {
  reminder: Reminder;
  pinned: boolean;
  onToggle: () => void;
  onTags: (tags: BoxTag[]) => void;
  onText: (text: string) => void;
  onToggleToday: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reminder.text);
  const [editTags, setEditTags] = useState<BoxTag[]>(reminder.tags);
  const tagChipUndoRef = useRef<TagChipUndoState | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(reminder.text);
      setEditTags(reminder.tags);
    }
  }, [reminder.text, reminder.tags, editing]);

  function beginEdit() {
    tagChipUndoRef.current = null;
    setDraft(reminder.text);
    setEditTags(reminder.tags);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    tagChipUndoRef.current = null;
    const nextText = draft.trim();
    const nextTags = normalizeTaskTags(editTags);
    if (nextText !== reminder.text) {
      onText(nextText || reminder.text);
      if (!nextText) setDraft(reminder.text);
    }
    const tagsChanged =
      nextTags.length !== reminder.tags.length ||
      nextTags.some((t, i) => t !== reminder.tags[i]);
    if (tagsChanged) onTags(nextTags);
  }

  function cancel() {
    tagChipUndoRef.current = null;
    setDraft(reminder.text);
    setEditTags(reminder.tags);
    setEditing(false);
  }

  return (
    <li className="group flex min-w-0 items-start gap-2 rounded-lg px-1 py-1.5">
      <Checkbox
        checked={reminder.done}
        onCheckedChange={onToggle}
        className="mt-0.5"
        aria-label={`Mark ${visibleTaskText(reminder.text) || "reminder"} complete`}
      />
      {editing ? (
        <div
          className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 gap-y-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              commit();
            }
          }}
        >
          {editTags.length > 0 && (
            <span className="shrink-0 pt-1 text-sm leading-snug">
              <TaskTagPrefixes tags={editTags} separator={false} />
            </span>
          )}
          <Input
            autoFocus
            value={draft}
            onChange={(e) => {
              tagChipUndoRef.current = null;
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (
                handleTagChipKey(e, {
                  key: `edit:${reminder.id}`,
                  value: draft,
                  tags: editTags,
                  undoRef: tagChipUndoRef,
                  onChange: ({ value, tags }) => {
                    setDraft(value);
                    setEditTags(tags);
                  },
                })
              ) {
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className="h-7 min-w-0 flex-1 basis-28 bg-white/90 text-sm"
            aria-label="Edit reminder"
          />
          <BoxTagPicker
            tags={editTags}
            onChange={(tags) => {
              tagChipUndoRef.current = null;
              setEditTags(tags);
            }}
          />
        </div>
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest("a")) return;
              beginEdit();
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              beginEdit();
            }}
            className={`min-w-0 flex-1 cursor-text break-words rounded-sm text-left text-sm leading-snug outline-none hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring/50 ${
              reminder.done ? "line-through" : ""
            }`}
          >
            <TaskTagPrefixes
              tags={reminder.tags}
              dimmed={reminder.done}
              separator={Boolean(reminder.text)}
            />
            <BoxText
              text={reminder.text}
              dimmed={reminder.done}
              onChange={onText}
            />
          </div>
          <BoxTagPicker tags={reminder.tags} onChange={onTags} />
        </>
      )}
      {!reminder.done && (
        <Button
          type="button"
          variant={pinned ? "secondary" : "outline"}
          size="xs"
          onClick={onToggleToday}
          aria-pressed={pinned}
          className="mt-0.5 shrink-0"
        >
          {pinned ? "On today" : "Add to today"}
        </Button>
      )}
      <button
        type="button"
        onClick={onDelete}
        title="Delete reminder"
        aria-label={`Delete ${visibleTaskText(reminder.text) || "reminder"}`}
        className="mt-0.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

export function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTags, setDraftTags] = useState<BoxTag[]>([]);
  const [pinTick, setPinTick] = useState(0);
  const tagChipUndoRef = useRef<TagChipUndoState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initPlansStore();
      await initRemindersStore();
      if (cancelled) return;
      setReminders(await listReminders());
      setReady(true);
    })();
    const unsub = subscribeReminders(() => {
      if (!cancelled) {
        setReminders(peekReminders());
        setPinTick((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  async function onAdd() {
    const text = draft.trim();
    const tags = normalizeTaskTags(draftTags);
    if (!text && tags.length === 0) return;
    await addReminder({ text, tags });
    tagChipUndoRef.current = null;
    setDraft("");
    setDraftTags([]);
  }

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="h-40 animate-pulse rounded-2xl bg-secondary/50" />
      </div>
    );
  }

  const active = reminders.filter((r) => !r.done);
  const completed = reminders.filter((r) => r.done);
  // pinTick forces re-check after pin/unpin
  void pinTick;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <p className="mb-2 text-sm font-medium tracking-wide text-seafoam uppercase">
          Checklist
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Reminders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simple checkboxes. Pin any reminder onto today&apos;s board as a
          linked box.
        </p>
        <div className="mt-4 h-px w-full origin-left bg-gradient-to-r from-seafoam via-glow/70 to-transparent animate-draw-line" />
      </div>

      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
        {draftTags.length > 0 && (
          <span className="hidden shrink-0 text-sm leading-snug sm:inline">
            <TaskTagPrefixes tags={draftTags} separator={false} />
          </span>
        )}
        <Input
          value={draft}
          onChange={(e) => {
            tagChipUndoRef.current = null;
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (
              handleTagChipKey(e, {
                key: "draft",
                value: draft,
                tags: draftTags,
                undoRef: tagChipUndoRef,
                onChange: ({ value, tags }) => {
                  setDraft(value);
                  setDraftTags(tags);
                },
              })
            ) {
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              void onAdd();
            }
          }}
          placeholder="New reminder…"
          aria-label="New reminder"
          className="min-w-0 flex-1 basis-40 bg-white/90"
        />
        <BoxTagPicker
          tags={draftTags}
          onChange={(tags) => {
            tagChipUndoRef.current = null;
            setDraftTags(tags);
          }}
          align="right"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => void onAdd()}
          aria-label="Add reminder"
          disabled={!draft.trim() && draftTags.length === 0}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          No open reminders. Add one above.
        </p>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white/50 px-2 py-1 backdrop-blur-sm">
          {active.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              pinned={isReminderPinnedToday(reminder.id)}
              onToggle={() => void toggleReminder(reminder.id)}
              onTags={(tags) => void updateReminder(reminder.id, { tags })}
              onText={(text) => void updateReminder(reminder.id, { text })}
              onToggleToday={() => {
                void toggleReminderPinnedToday(reminder.id).then(() =>
                  setPinTick((n) => n + 1),
                );
              }}
              onDelete={() => void deleteReminder(reminder.id)}
            />
          ))}
        </ul>
      )}

      {completed.length > 0 && (
        <details className="mt-6 group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            Completed ({completed.length})
          </summary>
          <ul className="mt-2 divide-y divide-border/40 rounded-xl border border-border/50 bg-white/30 px-2 py-1">
            {completed.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                pinned={isReminderPinnedToday(reminder.id)}
                onToggle={() => void toggleReminder(reminder.id)}
                onTags={(tags) => void updateReminder(reminder.id, { tags })}
                onText={(text) => void updateReminder(reminder.id, { text })}
                onToggleToday={() => {
                  void toggleReminderPinnedToday(reminder.id).then(() =>
                    setPinTick((n) => n + 1),
                  );
                }}
                onDelete={() => void deleteReminder(reminder.id)}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
