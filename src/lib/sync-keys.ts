/**
 * Planner blobs mirrored to Firestore when signed in.
 * Keep in sync with the STORAGE_KEY constants in each store module.
 */
export const SYNC_STORAGE_KEYS = [
  "weekly-strategy-plans-v8",
  "due-events-v1",
  /** Completion flags only — kept separate so toggles cannot LWW-clobber event tags/times. */
  "due-events-done-v1",
  "weekly-strategy-reminders-v1",
  "recurring-todos-v1",
  /** Completion flags only — kept separate so toggles cannot LWW-clobber routine times/tags. */
  "recurring-todos-done-v1",
  "box-tags-registry-v1",
  "calendar-week-start-v1",
  "board-completed-display-v1",
  "cs234-checklist-v1",
] as const;

export type SyncStorageKey = (typeof SYNC_STORAGE_KEYS)[number];

export const SYNC_META_KEY = "sync-meta-v1";
