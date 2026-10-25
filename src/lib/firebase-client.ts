import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

/** Keep Google's return trip on this site. A firebaseapp.com domain is a different site, so the account never arrives. */
function hostingAuthDomain(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const host = window.location.hostname;
  if (host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) return host;
  return fallback;
}

export function firebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = hostingAuthDomain(clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN));
  const projectId = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const appId = clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function isFirebaseConfigured(): boolean {
  return firebaseWebConfig() != null;
}

function firebaseApp(): FirebaseApp {
  const config = firebaseWebConfig();
  if (!config) {
    throw new Error("Firebase web config is missing.");
  }
  if (getApps().length > 0) return getApp();
  return initializeApp(config);
}

export function getFirebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

let redirectOnce: Promise<UserCredential | null> | null = null;

/** One read per page load. A second call would see an empty result and leave the sign-in screen up. */
export function takeRedirectResult(auth: Auth): Promise<UserCredential | null> {
  if (!redirectOnce) redirectOnce = getRedirectResult(auth);
  return redirectOnce;
}

let db: Firestore | null = null;

/** Firestore with a local cache so a short offline stretch still reads and writes. */
export function getFirebaseDb(): Firestore {
  if (db) return db;
  const app = firebaseApp();
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    try {
      db = initializeFirestore(app, { localCache: memoryLocalCache() });
    } catch {
      db = getFirestore(app);
    }
  }
  return db;
}
