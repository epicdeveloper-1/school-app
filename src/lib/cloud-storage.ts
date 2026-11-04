import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getAppProfile, type AppProfile } from "./app-profile";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-client";
import {
  blankMayOverwriteProfile,
  localIsTooSparseForCloud,
} from "./sync-guard";

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
 * Mirror a local value to Firestore. Skips when a blank client would clobber
 * personal data, or when local is clearly emptier than existing cloud.
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

  if (existing && !blankMayOverwriteProfile(existing.clientProfile)) {
    console.warn(
      "cloud write skipped: blank client cannot overwrite personal blob",
      key,
    );
    return "skipped";
  }

  if (existing && localIsTooSparseForCloud(value, existing.value)) {
    console.warn(
      "cloud write skipped: local blob too sparse vs cloud",
      key,
    );
    return "skipped";
  }

  await setDoc(ref, {
    value,
    updatedAt: serverTimestamp(),
    clientProfile: getAppProfile(),
  });
  return "written";
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
      const next = new Map<string, CloudBlob>();
      for (const docSnap of snap.docs) {
        const blob = blobFromData(docSnap.data() as Record<string, unknown>);
        if (blob) next.set(docSnap.id, blob);
      }
      onChange(next);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}
