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
import { getFirebaseAuth, getFirebaseDb } from "./firebase-client";

/** Firestore document ids cannot contain slashes. Match the desktop filename filter. */
export function blobDocumentId(key: string): string {
  const safe = String(key).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 700);
  if (!safe || safe === "." || safe === "..") return "blob";
  return safe;
}

export type CloudBlob = {
  value: string;
  updatedAtMs: number | null;
};

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

function blobFromData(data: Record<string, unknown> | undefined): CloudBlob | null {
  if (!data) return null;
  const value = data.value;
  if (typeof value !== "string") return null;
  return { value, updatedAtMs: updatedAtMs(data.updatedAt) };
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

export async function writeCloudStorage(key: string, value: string): Promise<void> {
  const uid = requireUid();
  await setDoc(doc(getFirebaseDb(), "users", uid, "blobs", blobDocumentId(key)), {
    value,
    updatedAt: serverTimestamp(),
  });
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
