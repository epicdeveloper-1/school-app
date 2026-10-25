"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskTagPrefixes } from "@/components/box-tag-picker";
import {
  CS234_WEEKS,
  Cs234ChecklistItem,
  dueNoteForWeek,
  initCs234ChecklistStore,
  isCsItemOptionalInWeek,
  itemsForWeek,
  listCs234Items,
  peekCs234Items,
  subscribeCs234,
  toggleCs234Item,
} from "@/lib/cs234-checklist";

function ItemRow({
  item,
  week,
  onToggle,
}: {
  item: Cs234ChecklistItem;
  week: number;
  onToggle: (id: string) => void;
}) {
  const note = dueNoteForWeek(item, week);
  const optional = isCsItemOptionalInWeek(item, week);
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Checkbox
        checked={item.done}
        onCheckedChange={() => onToggle(item.id)}
        className="mt-0.5"
        aria-label={`Mark ${item.label} complete`}
      />
      <span
        className={`min-w-0 text-sm ${item.done ? "text-muted-foreground line-through" : "text-ink"}`}
      >
        {optional ? (
          <TaskTagPrefixes tags={["optional"]} dimmed={item.done} />
        ) : null}
        {item.label}
        {note ? (
          <span className="ml-1.5 text-xs text-muted-foreground">({note})</span>
        ) : null}
      </span>
    </li>
  );
}

export function Cs234Checklist() {
  const [items, setItems] = useState<Cs234ChecklistItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initCs234ChecklistStore();
      if (cancelled) return;
      setItems(await listCs234Items());
      setReady(true);
    })();
    const unsub = subscribeCs234(() => {
      if (!cancelled) setItems(peekCs234Items());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  async function onToggle(id: string) {
    await toggleCs234Item(id);
  }

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="h-40 animate-pulse rounded-2xl bg-secondary/50" />
      </div>
    );
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <section className="animate-rise">
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium tracking-wide text-seafoam uppercase">
            Course checklist · source of truth
          </p>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            CS 234 checklist
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Check off once — it syncs everywhere this item appears, including
            Friday/Saturday on the weekly board.{" "}
            {done} of {items.length} items done.
          </p>
          <div className="mt-4 h-px w-full origin-left bg-gradient-to-r from-seafoam via-glow/70 to-transparent animate-draw-line" />
        </div>

        <div className="grid gap-4">
          {CS234_WEEKS.map((w) => {
            const weekItems = itemsForWeek(items, w.week);
            const modules = weekItems.filter((i) => i.kind === "module");
            const problem = weekItems.filter(
              (i) =>
                i.kind === "exercise" ||
                i.kind === "quiz" ||
                i.kind === "assignment" ||
                i.kind === "study" ||
                i.kind === "la",
            );
            const weekDone = weekItems.filter((i) => i.done).length;
            return (
              <details
                key={w.week}
                className="group rounded-2xl border border-border/70 bg-white/65 backdrop-blur-sm open:border-seafoam/40"
              >
                <summary className="cursor-pointer list-none px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-heading text-lg font-semibold text-ink">
                      Week {w.week}{" "}
                      <span className="text-base font-normal text-muted-foreground">
                        · {w.label}
                      </span>
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {weekDone}/{weekItems.length}
                    </span>
                  </div>
                </summary>
                <div className="grid gap-5 border-t border-border/60 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-seafoam uppercase">
                      Lecture content
                    </p>
                    {modules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="space-y-2">
                        {modules.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            week={w.week}
                            onToggle={onToggle}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-seafoam uppercase">
                      Problem solving
                    </p>
                    {problem.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="space-y-2">
                        {problem.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            week={w.week}
                            onToggle={onToggle}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
