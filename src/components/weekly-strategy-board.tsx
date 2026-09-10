"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, RotateCcw, CheckCircle2, Target, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DAYS,
  DayKey,
  TaskItem,
  WeekPlan,
  createEmptyPlan,
  createId,
  formatWeekLabel,
  formatWeekOf,
  loadPlan,
  savePlan,
  startOfWeek,
} from "@/lib/week-plan";

type LoadState = "loading" | "ready" | "error";

export function WeeklyStrategyBoard() {
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [drafts, setDrafts] = useState<Record<DayKey, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  });
  const [subjectDraft, setSubjectDraft] = useState({ subject: "", goal: "" });
  const [isPending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    try {
      const currentWeek = formatWeekOf(startOfWeek());
      const stored = loadPlan();
      if (stored && stored.weekOf === currentWeek) {
        setPlan(stored);
      } else {
        setPlan(createEmptyPlan(currentWeek));
      }
      setLoadState("ready");
    } catch {
      setPlan(createEmptyPlan());
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!plan || loadState !== "ready") return;
    savePlan(plan);
    setSavedFlash(true);
    const t = window.setTimeout(() => setSavedFlash(false), 1200);
    return () => window.clearTimeout(t);
  }, [plan, loadState]);

  function updatePlan(updater: (prev: WeekPlan) => WeekPlan) {
    startTransition(() => {
      setPlan((prev) => (prev ? updater(prev) : prev));
    });
  }

  function addTask(day: DayKey) {
    const text = drafts[day].trim();
    if (!text || !plan) return;
    const item: TaskItem = { id: createId(), text, done: false };
    updatePlan((prev) => ({
      ...prev,
      days: { ...prev.days, [day]: [...prev.days[day], item] },
    }));
    setDrafts((d) => ({ ...d, [day]: "" }));
  }

  function toggleTask(day: DayKey, id: string) {
    updatePlan((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: prev.days[day].map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        ),
      },
    }));
  }

  function removeTask(day: DayKey, id: string) {
    updatePlan((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: prev.days[day].filter((t) => t.id !== id),
      },
    }));
  }

  function addSubject() {
    const subject = subjectDraft.subject.trim();
    const goal = subjectDraft.goal.trim();
    if (!subject || !goal) return;
    updatePlan((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        { id: createId(), subject, goal, done: false },
      ],
    }));
    setSubjectDraft({ subject: "", goal: "" });
  }

  function toggleSubject(id: string) {
    updatePlan((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === id ? { ...s, done: !s.done } : s,
      ),
    }));
  }

  function removeSubject(id: string) {
    updatePlan((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
    }));
  }

  function resetWeek() {
    const weekOf = plan?.weekOf ?? formatWeekOf(startOfWeek());
    setPlan(createEmptyPlan(weekOf));
    setDrafts({
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    });
    setSubjectDraft({ subject: "", goal: "" });
  }

  if (loadState === "loading" || !plan) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          <div className="h-10 w-56 animate-pulse rounded-md bg-secondary/80" />
          <div className="h-28 animate-pulse rounded-2xl bg-secondary/60" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-secondary/50"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalTasks = DAYS.reduce((n, d) => n + plan.days[d.key].length, 0);
  const doneTasks = DAYS.reduce(
    (n, d) => n + plan.days[d.key].filter((t) => t.done).length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      {loadState === "error" && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not read saved data. Starting a fresh week plan.
        </p>
      )}

      <section className="mb-10 animate-rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium tracking-wide text-seafoam uppercase">
              Week of {formatWeekLabel(plan.weekOf)}
            </p>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your strategy board
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              One focus for the week, then light daily priorities and subject
              targets. Saved on this device.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs transition-opacity ${savedFlash || isPending ? "opacity-100" : "opacity-0"}`}
              aria-live="polite"
            >
              {isPending ? "Saving…" : "Saved"}
            </span>
            <Button variant="outline" onClick={resetWeek}>
              <RotateCcw data-icon="inline-start" />
              Reset week
            </Button>
          </div>
        </div>
        <div className="mt-4 h-px w-full origin-left bg-gradient-to-r from-seafoam via-glow/70 to-transparent animate-draw-line" />
        <p className="mt-3 text-sm text-muted-foreground">
          {totalTasks === 0
            ? "No priorities yet — add your first task below."
            : `${doneTasks} of ${totalTasks} priorities done`}
        </p>
      </section>

      <section className="mb-10 animate-rise-delay-1">
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <Target className="size-4 text-seafoam" />
          Week focus
        </label>
        <Textarea
          value={plan.focus}
          onChange={(e) =>
            updatePlan((prev) => ({ ...prev, focus: e.target.value }))
          }
          placeholder="Example: Finish the history essay draft and stay ahead in algebra."
          className="min-h-24 resize-y border-border/80 bg-white/70 text-base shadow-none backdrop-blur-sm"
        />
      </section>

      <section className="mb-12 animate-rise-delay-2">
        <h3 className="mb-4 font-heading text-2xl font-semibold text-ink">
          Daily priorities
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAYS.map((day) => {
            const tasks = plan.days[day.key];
            return (
              <div
                key={day.key}
                className="flex flex-col rounded-2xl border border-border/70 bg-white/65 p-4 backdrop-blur-sm transition-colors hover:border-seafoam/40"
              >
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h4 className="font-heading text-lg font-semibold text-ink">
                    {day.label}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {tasks.filter((t) => t.done).length}/{tasks.length}
                  </span>
                </div>

                {tasks.length === 0 ? (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Empty day — keep it light or add one priority.
                  </p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {tasks.map((task) => (
                      <li
                        key={task.id}
                        className="group flex items-start gap-2 rounded-lg px-1 py-0.5"
                      >
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => toggleTask(day.key, task.id)}
                          className="mt-0.5"
                          aria-label={`Mark ${task.text} complete`}
                        />
                        <span
                          className={`flex-1 text-sm leading-snug ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {task.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTask(day.key, task.id)}
                          className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex gap-2">
                  <Input
                    value={drafts[day.key]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [day.key]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTask(day.key);
                      }
                    }}
                    placeholder="Add priority"
                    className="h-8 bg-white/80"
                  />
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => addTask(day.key)}
                    aria-label={`Add priority for ${day.label}`}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="animate-rise-delay-2">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="size-5 text-seafoam" />
          <h3 className="font-heading text-2xl font-semibold text-ink">
            Subject targets
          </h3>
        </div>

        {plan.subjects.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">
            No subject targets yet. Add a class and what you want done by
            Friday.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {plan.subjects.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start gap-3 rounded-xl border border-border/70 bg-white/65 px-4 py-3 backdrop-blur-sm"
              >
                <Checkbox
                  checked={s.done}
                  onCheckedChange={() => toggleSubject(s.id)}
                  className="mt-1"
                  aria-label={`Mark ${s.subject} target complete`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${s.done ? "text-muted-foreground line-through" : "text-ink"}`}
                  >
                    {s.subject}
                  </p>
                  <p
                    className={`text-sm ${s.done ? "text-muted-foreground/80 line-through" : "text-muted-foreground"}`}
                  >
                    {s.goal}
                  </p>
                </div>
                {s.done && (
                  <CheckCircle2 className="mt-1 size-4 text-seafoam" />
                )}
                <button
                  type="button"
                  onClick={() => removeSubject(s.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={subjectDraft.subject}
            onChange={(e) =>
              setSubjectDraft((d) => ({ ...d, subject: e.target.value }))
            }
            placeholder="Subject"
            className="bg-white/80 sm:max-w-40"
          />
          <Input
            value={subjectDraft.goal}
            onChange={(e) =>
              setSubjectDraft((d) => ({ ...d, goal: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSubject();
              }
            }}
            placeholder="Target for this week"
            className="bg-white/80 flex-1"
          />
          <Button onClick={addSubject}>
            <Plus data-icon="inline-start" />
            Add target
          </Button>
        </div>
      </section>
    </div>
  );
}
