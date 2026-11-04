import { isBlankProfile } from "./app-profile";
import { isFirebaseConfigured } from "./firebase-client";
import {
  hasDesktopBridge,
  readLocalStorageValue,
  writeLocalStorageValue,
} from "./local-storage";
import { SYNC_META_KEY, SYNC_STORAGE_KEYS, type SyncStorageKey } from "./sync-keys";

export {
  hasDesktopBridge,
  readLocalStorageValue,
  writeLocalStorageValue,
} from "./local-storage";

export type StorageTarget = "desktop" | "cloud" | "local";

/**
 * Primary store only. Cloud is a mirror on top of desktop/local, not a
 * separate exclusive target anymore — kept for callers that still branch.
 */
export function storageTarget(input: {
  hasDesktop: boolean;
  blank: boolean;
}): StorageTarget {
  if (input.hasDesktop) return "desktop";
  if (input.blank) return "cloud";
  return "local";
}

function currentTarget(): StorageTarget {
  return storageTarget({
    hasDesktop: hasDesktopBridge(),
    blank: isBlankProfile(),
  });
}

function isSyncKey(key: string): key is SyncStorageKey {
  return (SYNC_STORAGE_KEYS as readonly string[]).includes(key);
}

let applyingRemote = false;
let mirrorCloud:
  | ((key: SyncStorageKey, value: string) => Promise<void>)
  | null = null;

/** Used by cloud-sync while applying remote blobs so writes stay local-only. */
export function runWithoutCloudMirror<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemote = true;
  return fn().finally(() => {
    applyingRemote = false;
  });
}

/** cloud-sync registers the push path after auth. */
export function setCloudMirror(
  fn: ((key: SyncStorageKey, value: string) => Promise<void>) | null,
): void {
  mirrorCloud = fn;
}

function canAttemptCloudMirror(): boolean {
  if (applyingRemote || !mirrorCloud) return false;
  if (!isFirebaseConfigured()) return false;
  if (typeof window === "undefined") return false;
  return true;
}

/** Read from the local primary store (desktop files or localStorage). */
export async function readStorage(key: string): Promise<string | null> {
  return readLocalStorageValue(key);
}

/**
 * Write local first. When signed in, also mirror sync keys to Firestore.
 * Cloud failures never roll back the local write.
 */
export async function writeStorage(key: string, value: string): Promise<void> {
  await writeLocalStorageValue(key, value);

  if (key === SYNC_META_KEY || !isSyncKey(key)) return;

  try {
    const { touchLocalKeyMeta } = await import("./sync-meta");
    await touchLocalKeyMeta(key);
  } catch {
    // Meta is best-effort; local value is already saved.
  }

  if (!canAttemptCloudMirror() || !mirrorCloud) return;
  try {
    await mirrorCloud(key, value);
  } catch (err) {
    console.error("cloud mirror failed", key, err);
    try {
      const { setSyncStatus } = await import("./sync-meta");
      await setSyncStatus({
        lastError: err instanceof Error ? err.message : "Cloud sync failed.",
      });
    } catch {
      /* ignore */
    }
  }
}

/** True when blank website (no Electron) should treat cloud as the shared store. */
export function isBlankWebCloudSurface(): boolean {
  return isBlankProfile() && !hasDesktopBridge();
}

export function peekStorageTarget(): StorageTarget {
  return currentTarget();
}
