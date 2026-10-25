import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-client";

/** Firestore document ids cannot contain slashes. Match the desktop filename filter. */
export function blobDocumentId(key: string): string {
  const safe = String(key).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 700);
  if (!safe || safe === "." || safe === "..") return "blob";
  return safe;
}

function requireUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in required.");
  return uid;
}

export async function readCloudStorage(key: string): Promise<string | null> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid, "blobs", blobDocumentId(key)));
  if (!snap.exists()) return null;
  const value = snap.data().value;
  return typeof value === "string" ? value : null;
}

export async function writeCloudStorage(key: string, value: string): Promise<void> {
  const uid = requireUid();
  await setDoc(doc(getFirebaseDb(), "users", uid, "blobs", blobDocumentId(key)), {
    value,
    updatedAt: serverTimestamp(),
  });
}
