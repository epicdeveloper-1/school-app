"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  subscribeSyncStatus,
  type SyncStatusSnapshot,
} from "@/lib/cloud-sync";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
  takeRedirectResult,
} from "@/lib/firebase-client";

function authErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "auth/unauthorized-domain") {
      return "This app address is not allowed for Google sign-in yet. Add 127.0.0.1 / localhost in Firebase Auth settings.";
    }
    if (code === "auth/popup-blocked" || code === "auth/web-storage-unsupported") {
      return "This browser blocked Google sign-in. Allow cookies and storage, then try again.";
    }
  }
  return "Google sign-in did not finish. Try again.";
}

function formatSyncTime(ms: number | null): string {
  if (ms == null) return "Not synced yet";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "Not synced yet";
  }
}

/**
 * Optional Google sync for the personal desktop/web build.
 * The planner always keeps working from local files when signed out.
 */
export function PersonalAccountPanel() {
  const configured = isFirebaseConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    void takeRedirectResult(auth).catch((err: unknown) => {
      setError(authErrorMessage(err));
    });
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setEmail(user?.email ?? null);
      setPending(false);
    });
    const unsubStatus = subscribeSyncStatus(setStatus);
    return () => {
      unsubAuth();
      unsubStatus();
    };
  }, [configured]);

  if (!configured) {
    return (
      <section className="mt-6 rounded-xl border border-border/70 bg-background/80 p-4">
        <h2 className="font-heading text-lg font-semibold text-ink">Cloud sync</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add Firebase web keys to <code className="text-xs">.env.local</code> and
          rebuild to sync this desktop app with your Google account. Your data
          already stays in local files either way.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border/70 bg-background/80 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">Cloud sync</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {email
          ? `Signed in as ${email}. Changes save on this computer first, then sync to your Google account.`
          : "Sign in with Google to mirror this planner to the cloud (same account on your phone). Everything still saves locally first."}
      </p>
      {status?.lastSyncAt != null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Last sync: {formatSyncTime(status.lastSyncAt)}
          {status.syncing ? " · Syncing…" : ""}
        </p>
      ) : null}
      {status?.lastError || error ? (
        <p className="mt-2 text-sm text-destructive">
          {error ?? status?.lastError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {email ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError(null);
              void signOut(getFirebaseAuth())
                .catch(() => {
                  setError("Could not sign out. Try again.");
                })
                .finally(() => setPending(false));
            }}
          >
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-seafoam text-white hover:bg-seafoam/80"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError(null);
              void signInWithRedirect(
                getFirebaseAuth(),
                new GoogleAuthProvider(),
              ).catch((err: unknown) => {
                setPending(false);
                setError(authErrorMessage(err));
              });
            }}
          >
            {pending ? "Redirecting to Google…" : "Sign in with Google"}
          </Button>
        )}
      </div>
    </section>
  );
}
