import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getAppProfile, type AppProfile } from "./app-profile";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-client";
import { hasPersonalFeatures } from "./personal-access";
import { localIsTooSparseForCloud } from "./sync-guard";

/** Firestore document ids cannot contain slashes. Match the desktop filename filter. */
export function blobDocumentId(key: string): string {
  const safe = String(key).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 700);
  if (!safe || safe === "." || safe === "..") return "blob";
  return safe;
}

export type CloudBlob = {
  value: string;
  updatedAtMs: number | null;
  clientProfile: AppProfile | null;
};

export type CloudWriteResult = "written" | "skipped";

function requireUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in required.");
  return uid;
}

function updatedAtMs(value: unknown): number | null {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as Timestamp).toMillis === "function"
  ) {
    return (value as Timestamp).toMillis();
  }
  return null;
}

function parseClientProfile(raw: unknown): AppProfile | null {
  if (raw === "blank" || raw === "personal") return raw;
  return null;
}

function blobFromData(data: Record<string, unknown> | undefined): CloudBlob | null {
  if (!data) return null;
  const value = data.value;
  if (typeof value !== "string") return null;
  return {
    value,
    updatedAtMs: updatedAtMs(data.updatedAt),
    clientProfile: parseClientProfile(data.clientProfile),
  };
}

export async function readCloudStorage(key: string): Promise<string | null> {
  const blob = await readCloudBlob(key);
  return blob?.value ?? null;
}

export async function readCloudBlob(key: string): Promise<CloudBlob | null> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(
    doc(getFirebaseDb(), "users", uid, "blobs", blobDocumentId(key)),
  );
  if (!snap.exists()) return null;
  return blobFromData(snap.data() as Record<string, unknown>);
}

/**
 * Mirror a local value to Firestore.
 * Skips only when local is clearly an empty/seed shell vs richer cloud
 * (prevents blank wipe). Real edits from blank or personal both sync.
 * Once a blob is personal-tagged, keep that tag even if blank writes.
 */
export async function writeCloudStorage(
  key: string,
  value: string,
): Promise<CloudWriteResult> {
  const uid = requireUid();
  const ref = doc(getFirebaseDb(), "users", uid, "blobs", blobDocumentId(key));
  const existing = blobFromData(
    (await getDoc(ref)).data() as Record<string, unknown> | undefined,
  );

  if (existing && localIsTooSparseForCloud(value, existing.value)) {
    console.warn(
      "cloud write skipped: local blob too sparse vs cloud",
      key,
    );
    return "skipped";
  }

  const profile: AppProfile =
    existing?.clientProfile === "personal" || hasPersonalFeatures()
      ? "personal"
      : getAppProfile();

  await setDoc(ref, {
    value,
    updatedAt: serverTimestamp(),
    clientProfile: profile,
  });
  return "written";
}

function blobsFromSnapshot(
  docs: { id: string; data: () => Record<string, unknown> }[],
): Map<string, CloudBlob> {
  const next = new Map<string, CloudBlob>();
  for (const docSnap of docs) {
    const blob = blobFromData(docSnap.data());
    if (blob) next.set(docSnap.id, blob);
  }
  return next;
}

/** One-shot server read of all planner blobs (bypass listener timing). */
export async function fetchAllUserBlobs(): Promise<Map<string, CloudBlob>> {
  const uid = requireUid();
  const snap = await getDocs(collection(getFirebaseDb(), "users", uid, "blobs"));
  return blobsFromSnapshot(
    snap.docs.map((d) => ({
      id: d.id,
      data: () => d.data() as Record<string, unknown>,
    })),
  );
}

/** Live map of blob id → payload for the signed-in user. */
export function subscribeUserBlobs(
  onChange: (blobs: Map<string, CloudBlob>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const uid = requireUid();
  return onSnapshot(
    collection(getFirebaseDb(), "users", uid, "blobs"),
    (snap) => {
      onChange(
        blobsFromSnapshot(
          snap.docs.map((d) => ({
            id: d.id,
            data: () => d.data() as Record<string, unknown>,
          })),
        ),
      );
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}
