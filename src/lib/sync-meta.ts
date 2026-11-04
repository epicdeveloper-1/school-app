import { readLocalStorageValue, writeLocalStorageValue } from "./local-storage";
import { SYNC_META_KEY, type SyncStorageKey } from "./sync-keys";

export type SyncKeyMeta = {
  localUpdatedAt: number;
  lastAppliedCloudAt: number | null;
};

export type SyncMetaStore = {
  keys: Partial<Record<SyncStorageKey, SyncKeyMeta>>;
  /** Per Google uid: first connect already pushed or pulled. */
  firstLinkByUid: Record<string, boolean>;
  lastSyncAt: number | null;
  lastError: string | null;
  lastEmail: string | null;
};

const emptyMeta = (): SyncMetaStore => ({
  keys: {},
  firstLinkByUid: {},
  lastSyncAt: null,
  lastError: null,
  lastEmail: null,
});

function parseMeta(raw: string | null): SyncMetaStore {
  if (!raw) return emptyMeta();
  try {
    const parsed = JSON.parse(raw) as SyncMetaStore;
    if (!parsed || typeof parsed !== "object") return emptyMeta();
    return {
      keys: parsed.keys && typeof parsed.keys === "object" ? parsed.keys : {},
      firstLinkByUid:
        parsed.firstLinkByUid && typeof parsed.firstLinkByUid === "object"
          ? parsed.firstLinkByUid
          : {},
      lastSyncAt: typeof parsed.lastSyncAt === "number" ? parsed.lastSyncAt : null,
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
      lastEmail: typeof parsed.lastEmail === "string" ? parsed.lastEmail : null,
    };
  } catch {
    return emptyMeta();
  }
}

export async function loadSyncMeta(): Promise<SyncMetaStore> {
  return parseMeta(await readLocalStorageValue(SYNC_META_KEY));
}

export async function saveSyncMeta(meta: SyncMetaStore): Promise<void> {
  await writeLocalStorageValue(SYNC_META_KEY, JSON.stringify(meta));
}

export async function touchLocalKeyMeta(key: SyncStorageKey): Promise<number> {
  const meta = await loadSyncMeta();
  const now = Date.now();
  meta.keys[key] = {
    localUpdatedAt: now,
    lastAppliedCloudAt: meta.keys[key]?.lastAppliedCloudAt ?? null,
  };
  await saveSyncMeta(meta);
  return now;
}

export async function setSyncStatus(patch: {
  lastSyncAt?: number | null;
  lastError?: string | null;
  lastEmail?: string | null;
}): Promise<SyncMetaStore> {
  const meta = await loadSyncMeta();
  if ("lastSyncAt" in patch) meta.lastSyncAt = patch.lastSyncAt ?? null;
  if ("lastError" in patch) meta.lastError = patch.lastError ?? null;
  if ("lastEmail" in patch) meta.lastEmail = patch.lastEmail ?? null;
  await saveSyncMeta(meta);
  return meta;
}
