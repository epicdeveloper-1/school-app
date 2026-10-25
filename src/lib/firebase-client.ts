import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
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

export function firebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? "";
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
