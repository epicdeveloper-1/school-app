import { onAuthStateChanged, type Unsubscribe as AuthUnsubscribe } from "firebase/auth";
import type { Unsubscribe as FsUnsubscribe } from "firebase/firestore";
import {
  blobDocumentId,
  subscribeUserBlobs,
  writeCloudStorage,
  type CloudBlob,
} from "./cloud-storage";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase-client";
import {
  readLocalStorageValue,
  runWithoutCloudMirror,
  setCloudMirror,
  writeLocalStorageValue,
} from "./storage";
import { SYNC_STORAGE_KEYS, type SyncStorageKey } from "./sync-keys";
import {
  loadSyncMeta,
  saveSyncMeta,
  setSyncStatus,
  type SyncMetaStore,
} from "./sync-meta";
import { reloadAllAppDataStores } from "./tag-data-sync";

export const SYNC_STATUS_EVENT = "weekly-strategy:sync-status";

export type SyncStatusSnapshot = {
  email: string | null;
  uid: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
};

let authUnsub: AuthUnsubscribe | null = null;
let blobsUnsub: FsUnsubscribe | null = null;
let syncing = false;
let started = false;
let readyResolvers: Array<() => void> = [];
let initialReady = false;

const listeners = new Set<(status: SyncStatusSnapshot) => void>();

function emitStatus(partial?: Partial<SyncStatusSnapshot>): void {
  const user = isFirebaseConfigured()
    ? getFirebaseAuth().currentUser
    : null;
  const status: SyncStatusSnapshot = {
    email: partial?.email ?? user?.email ?? null,
    uid: partial?.uid ?? user?.uid ?? null,
    lastSyncAt: partial?.lastSyncAt ?? null,
    lastError: partial?.lastError ?? null,
    syncing: partial?.syncing ?? syncing,
  };
  void loadSyncMeta().then((meta) => {
    const next: SyncStatusSnapshot = {
      email: status.email ?? meta.lastEmail,
      uid: status.uid,
      lastSyncAt:
        status.lastSyncAt != null ? status.lastSyncAt : meta.lastSyncAt,
      lastError:
        status.lastError !== null && status.lastError !== undefined
          ? status.lastError
          : meta.lastError,
      syncing: status.syncing,
    };
    for (const listener of listeners) listener(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(SYNC_STATUS_EVENT, { detail: next }),
      );
    }
  });
}

export function subscribeSyncStatus(
  listener: (status: SyncStatusSnapshot) => void,
): () => void {
  listeners.add(listener);
  void loadSyncMeta().then((meta) => {
    const user = isFirebaseConfigured()
      ? getFirebaseAuth().currentUser
      : null;
    listener({
      email: user?.email ?? meta.lastEmail,
      uid: user?.uid ?? null,
      lastSyncAt: meta.lastSyncAt,
      lastError: meta.lastError,
      syncing,
    });
  });
  return () => {
    listeners.delete(listener);
  };
}

function markInitialReady(): void {
  if (initialReady) return;
  initialReady = true;
  for (const resolve of readyResolvers) resolve();
  readyResolvers = [];
}

/** Resolves after the first sync pass (or immediately if Firebase is off). */
export function whenCloudSyncReady(): Promise<void> {
  if (initialReady || !isFirebaseConfigured()) {
    initialReady = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    readyResolvers.push(resolve);
  });
}

async function mirrorKey(key: SyncStorageKey, value: string): Promise<void> {
  await writeCloudStorage(key, value);
  const meta = await loadSyncMeta();
  const now = Date.now();
  meta.keys[key] = {
    localUpdatedAt: meta.keys[key]?.localUpdatedAt ?? now,
    lastAppliedCloudAt: meta.keys[key]?.lastAppliedCloudAt ?? null,
  };
  meta.lastSyncAt = now;
  meta.lastError = null;
  await saveSyncMeta(meta);
  emitStatus({ lastSyncAt: now, lastError: null, syncing });
}

async function firstLink(uid: string, meta: SyncMetaStore): Promise<boolean> {
  if (meta.firstLinkByUid[uid]) return false;

  let hasLocal = false;
  const locals = new Map<SyncStorageKey, string>();
  for (const key of SYNC_STORAGE_KEYS) {
    const value = await readLocalStorageValue(key);
    if (value != null && value !== "") {
      hasLocal = true;
      locals.set(key, value);
    }
  }

  if (hasLocal) {
    for (const [key, value] of locals) {
      await writeCloudStorage(key, value);
      const now = Date.now();
      meta.keys[key] = {
        localUpdatedAt: meta.keys[key]?.localUpdatedAt ?? now,
        lastAppliedCloudAt: meta.keys[key]?.lastAppliedCloudAt ?? null,
      };
    }
  } else {
    const { readCloudBlob } = await import("./cloud-storage");
    let applied = false;
    await runWithoutCloudMirror(async () => {
      for (const key of SYNC_STORAGE_KEYS) {
        const blob = await readCloudBlob(key);
        if (!blob) continue;
        await writeLocalStorageValue(key, blob.value);
        meta.keys[key] = {
          localUpdatedAt: Date.now(),
          lastAppliedCloudAt: blob.updatedAtMs,
        };
        applied = true;
      }
    });
    if (applied) await reloadAllAppDataStores();
  }

  meta.firstLinkByUid[uid] = true;
  meta.lastSyncAt = Date.now();
  meta.lastError = null;
  await saveSyncMeta(meta);
  return true;
}

async function applyRemoteBlobs(blobs: Map<string, CloudBlob>): Promise<void> {
  const meta = await loadSyncMeta();
  let changed = false;

  await runWithoutCloudMirror(async () => {
    for (const key of SYNC_STORAGE_KEYS) {
      const blob = blobs.get(blobDocumentId(key));
      if (!blob) continue;

      const keyMeta = meta.keys[key];
      const localUpdatedAt = keyMeta?.localUpdatedAt ?? 0;
      const lastApplied = keyMeta?.lastAppliedCloudAt ?? null;
      const cloudAt = blob.updatedAtMs ?? 0;

      if (lastApplied != null && cloudAt <= lastApplied) continue;
      if (cloudAt && localUpdatedAt && cloudAt <= localUpdatedAt) {
        // Local is newer or equal — push local instead of applying stale cloud.
        const local = await readLocalStorageValue(key);
        if (local != null) {
          try {
            await writeCloudStorage(key, local);
          } catch (err) {
            console.error("push newer local failed", key, err);
          }
        }
        continue;
      }

      const current = await readLocalStorageValue(key);
      if (current === blob.value) {
        meta.keys[key] = {
          localUpdatedAt: keyMeta?.localUpdatedAt ?? Date.now(),
          lastAppliedCloudAt: blob.updatedAtMs,
        };
        continue;
      }

      await writeLocalStorageValue(key, blob.value);
      meta.keys[key] = {
        localUpdatedAt: Date.now(),
        lastAppliedCloudAt: blob.updatedAtMs,
      };
      changed = true;
    }
  });

  meta.lastSyncAt = Date.now();
  meta.lastError = null;
  await saveSyncMeta(meta);
  emitStatus({ lastSyncAt: meta.lastSyncAt, lastError: null, syncing });
  if (changed) await reloadAllAppDataStores();
}

async function stopBlobSubscription(): Promise<void> {
  if (blobsUnsub) {
    blobsUnsub();
    blobsUnsub = null;
  }
  setCloudMirror(null);
}

async function startForUser(uid: string, email: string | null): Promise<void> {
  syncing = true;
  emitStatus({ uid, email, syncing: true });
  await setSyncStatus({ lastEmail: email, lastError: null });

  try {
    setCloudMirror(mirrorKey);
    const meta = await loadSyncMeta();
    await firstLink(uid, meta);

    await stopBlobSubscription();
    setCloudMirror(mirrorKey);

    blobsUnsub = subscribeUserBlobs(
      (blobs) => {
        void applyRemoteBlobs(blobs).catch(async (err) => {
          console.error("apply remote blobs failed", err);
          await setSyncStatus({
            lastError: err instanceof Error ? err.message : "Sync failed.",
          });
          emitStatus({
            lastError: err instanceof Error ? err.message : "Sync failed.",
            syncing: false,
          });
        });
      },
      async (err) => {
        await setSyncStatus({ lastError: err.message });
        emitStatus({ lastError: err.message, syncing: false });
      },
    );
  } catch (err) {
    console.error("cloud sync start failed", err);
    await setSyncStatus({
      lastError: err instanceof Error ? err.message : "Sync failed.",
    });
    emitStatus({
      lastError: err instanceof Error ? err.message : "Sync failed.",
      syncing: false,
    });
  } finally {
    syncing = false;
    emitStatus({ syncing: false });
    markInitialReady();
  }
}

export function startCloudSyncLifecycle(): () => void {
  if (started) {
    return () => {};
  }
  started = true;

  if (!isFirebaseConfigured()) {
    markInitialReady();
    return () => {
      started = false;
    };
  }

  const auth = getFirebaseAuth();
  authUnsub = onAuthStateChanged(auth, (user) => {
    void (async () => {
      await stopBlobSubscription();
      if (!user) {
        setCloudMirror(null);
        emitStatus({ email: null, uid: null, syncing: false });
        markInitialReady();
        return;
      }
      await startForUser(user.uid, user.email);
    })();
  });

  return () => {
    authUnsub?.();
    authUnsub = null;
    void stopBlobSubscription();
    setCloudMirror(null);
    started = false;
    initialReady = false;
  };
}
