"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { useIsCloudProfile } from "@/components/profile-copy";
import {
  forcePullFromCloud,
  subscribeSyncStatus,
  type SyncStatusSnapshot,
} from "@/lib/cloud-sync";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
  takeRedirectResult,
} from "@/lib/firebase-client";
import {
  googleSignInErrorMessage,
  signInWithGoogle,
} from "@/lib/google-sign-in";
import { useHasPersonalFeatures } from "@/lib/personal-access";

function formatSyncTime(ms: number | null): string {
  if (ms == null) return "Not synced yet";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "Not synced yet";
  }
}

/**
 * Blank friend builds: website requires Google first; desktop keeps local files
 * and optionally mirrors the same account used on the blank website.
 * CS 234 stays off unless the signed-in email is allowlisted.
 */
export function BlankAccountPanel() {
  const cloudOnly = useIsCloudProfile();
  const personal = useHasPersonalFeatures();
  const configured = isFirebaseConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    void takeRedirectResult(auth).catch((err: unknown) => {
      setError(googleSignInErrorMessage(err));
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
    if (cloudOnly) return null;
    return (
      <section className="mt-6 rounded-xl border border-border/70 bg-background/80 p-4">
        <h2 className="font-heading text-lg font-semibold text-ink">Cloud sync</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add Firebase web keys to <code className="text-xs">.env.local</code> and
          rebuild to sync this desktop app with Google. Your data already stays in
          local files either way.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border/70 bg-background/80 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">
        {cloudOnly ? "Google account" : "Cloud sync"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {email
          ? cloudOnly
            ? `Signed in as ${email}. Your planner is stored for this account and cached in this browser.`
            : `Signed in as ${email}. Changes save on this computer first, then sync to your Google account (same as the website).`
          : cloudOnly
            ? "Signed in with Google. Your planner is stored for this account and cached in this browser."
            : "Sign in with Google to mirror this planner to the cloud (same account as the blank website). Everything still saves locally first."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {personal
          ? "Personal syllabus UI (including CS 234) is enabled for this account. Edits sync with your Google backup."
          : "Blank planner — no CS 234. Real edits sync when signed in; empty seed data will not overwrite a richer personal backup."}
      </p>
      {status?.lastSyncAt != null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Last sync: {formatSyncTime(status.lastSyncAt)}
          {status.syncing ? " · Syncing…" : ""}
        </p>
      ) : null}
      {error || status?.lastError ? (
        <p className="mt-2 text-sm text-destructive">
          {error ?? status?.lastError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {email ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setPending(true);
                setError(null);
                void forcePullFromCloud()
                  .catch((err: unknown) => {
                    setError(
                      err instanceof Error ? err.message : "Pull failed.",
                    );
                  })
                  .finally(() => setPending(false));
              }}
            >
              {pending ? "Working…" : "Pull from cloud"}
            </Button>
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
          </>
        ) : (
          <Button
            type="button"
            className="bg-seafoam text-white hover:bg-seafoam/80"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError(null);
              void signInWithGoogle()
                .catch((err: unknown) => {
                  setError(googleSignInErrorMessage(err));
                })
                .finally(() => setPending(false));
            }}
          >
            {pending ? "Signing in…" : "Sign in with Google"}
          </Button>
        )}
      </div>
    </section>
  );
}
