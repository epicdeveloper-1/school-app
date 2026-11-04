"use client";

import { useEffect, useState } from "react";
import {
  BOARD_COMPLETED_DISPLAY_OPTIONS,
  DEFAULT_BOARD_COMPLETED_DISPLAY,
  loadBoardCompletedDisplay,
  saveBoardCompletedDisplay,
  type BoardCompletedDisplay,
} from "@/lib/board-completed-display";

export function BoardSettingsPanel() {
  const [completedDisplay, setCompletedDisplay] =
    useState<BoardCompletedDisplay>(DEFAULT_BOARD_COMPLETED_DISPLAY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadBoardCompletedDisplay().then((value) => {
      if (cancelled) return;
      setCompletedDisplay(value);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onChange(value: BoardCompletedDisplay) {
    setCompletedDisplay(value);
    await saveBoardCompletedDisplay(value);
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card/90 px-4 py-4">
      <h2 className="font-heading text-lg font-semibold text-ink">Board</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        How checked boxes behave on each day of the weekly checklist.
      </p>
      <fieldset className="mt-3 space-y-2" disabled={!ready}>
        <legend className="text-xs font-medium text-muted-foreground">
          Completed boxes
        </legend>
        {BOARD_COMPLETED_DISPLAY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-2.5 rounded-lg border border-border/60 bg-white/70 px-3 py-2.5 has-[:checked]:border-seafoam/50 has-[:checked]:bg-seafoam/5"
          >
            <input
              type="radio"
              name="board-completed-display"
              value={option.value}
              checked={completedDisplay === option.value}
              onChange={() => void onChange(option.value)}
              className="mt-1 size-3.5 shrink-0 accent-seafoam"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
