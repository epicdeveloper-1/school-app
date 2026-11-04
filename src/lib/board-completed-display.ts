import { readStorage, writeStorage } from "./storage";

/** How completed daily-checklist boxes are shown on the board. */
export const BOARD_COMPLETED_DISPLAY_KEY = "board-completed-display-v1";

export type BoardCompletedDisplay = "collapse" | "always";

/** Keep prior board behavior until the user opts into the Completed section. */
export const DEFAULT_BOARD_COMPLETED_DISPLAY: BoardCompletedDisplay = "always";

export const BOARD_COMPLETED_DISPLAY_OPTIONS: {
  value: BoardCompletedDisplay;
  label: string;
  description: string;
}[] = [
  {
    value: "collapse",
    label: "Hide in Completed section",
    description:
      "Checked boxes move into a per-day Completed section (hidden until you show them).",
  },
  {
    value: "always",
    label: "Always show completed",
    description:
      "Checked boxes stay in the day list. Custom order keeps them where you put them.",
  },
];

const listeners = new Set<(value: BoardCompletedDisplay) => void>();

export function parseBoardCompletedDisplay(
  raw: string | null,
): BoardCompletedDisplay {
  if (raw === "collapse" || raw === "always") return raw;
  return DEFAULT_BOARD_COMPLETED_DISPLAY;
}

export function subscribeBoardCompletedDisplay(
  listener: (value: BoardCompletedDisplay) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadBoardCompletedDisplay(): Promise<BoardCompletedDisplay> {
  const raw = await readStorage(BOARD_COMPLETED_DISPLAY_KEY);
  return parseBoardCompletedDisplay(raw);
}

/** Reload preference from disk after a cloud pull and notify subscribers. */
export async function reloadBoardCompletedDisplayFromDisk(): Promise<BoardCompletedDisplay> {
  const value = await loadBoardCompletedDisplay();
  for (const listener of listeners) listener(value);
  return value;
}

export async function saveBoardCompletedDisplay(
  value: BoardCompletedDisplay,
): Promise<void> {
  await writeStorage(BOARD_COMPLETED_DISPLAY_KEY, value);
  for (const listener of listeners) listener(value);
}
