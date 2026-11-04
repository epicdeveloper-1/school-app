import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { isBlankProfile } from "./app-profile";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase-client";

/** Signed-in emails that get personal/CS 234 UI on the blank friend site. */
const PERSONAL_EMAILS = new Set(["laoandrei@gmail.com"]);

type Listener = () => void;

const listeners = new Set<Listener>();
let authUnsub: (() => void) | null = null;
let lastSnapshot = false;

export function isAllowlistedPersonalEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return PERSONAL_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Personal syllabus UI (CS 234, UW seeds, course tags/copy).
 * Always on for personal builds; on blank builds only for allowlisted Google accounts.
 */
export function hasPersonalFeatures(): boolean {
  if (!isBlankProfile()) return true;
  if (typeof window === "undefined") return false;
  if (!isFirebaseConfigured()) return false;
  try {
    return isAllowlistedPersonalEmail(getFirebaseAuth().currentUser?.email);
  } catch {
    return false;
  }
}

function ensureAuthSubscription(): void {
  if (typeof window === "undefined") return;
  if (authUnsub) return;
  if (!isFirebaseConfigured()) {
    lastSnapshot = hasPersonalFeatures();
    return;
  }
  try {
    lastSnapshot = hasPersonalFeatures();
    authUnsub = onAuthStateChanged(getFirebaseAuth(), () => {
      const next = hasPersonalFeatures();
      if (next === lastSnapshot) return;
      lastSnapshot = next;
      for (const listener of listeners) listener();
    });
  } catch {
    lastSnapshot = false;
  }
}

export function subscribePersonalAccess(listener: Listener): () => void {
  ensureAuthSubscription();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPersonalAccessSnapshot(): boolean {
  ensureAuthSubscription();
  return hasPersonalFeatures();
}

export function useHasPersonalFeatures(): boolean {
  return useSyncExternalStore(
    subscribePersonalAccess,
    getPersonalAccessSnapshot,
    () => !isBlankProfile(),
  );
}
