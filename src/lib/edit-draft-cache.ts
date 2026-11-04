/**
 * Ephemeral edit drafts that survive App Router remounts when switching nav
 * tabs. Cleared on save / cancel / commit. Not written to durable storage.
 */

const store = new Map<string, unknown>();

export function peekEditDraft<T>(key: string): T | null {
  if (!store.has(key)) return null;
  return store.get(key) as T;
}

export function putEditDraft<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearEditDraft(key: string): void {
  store.delete(key);
}

export const CALENDAR_EDIT_KEY = "calendar-edit";
export const REMINDERS_EDIT_KEY = "reminders-edit";
export const BOARD_EDIT_KEY = "board-edit";
export const SUBBOX_EDIT_KEY = "subbox-edit";
