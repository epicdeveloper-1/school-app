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
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";

function formatSyncTime(ms: number | null): string {
  if (ms == null) return "Not synced yet";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "Not synced yet";
  }
}

export function BlankAccountPanel() {
  const cloud = useIsCloudProfile();
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud || !isFirebaseConfigured()) return;
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setEmail(user?.email ?? null);
    });
    const unsubStatus = subscribeSyncStatus(setStatus);
    return () => {
      unsubAuth();
      unsubStatus();
    };
  }, [cloud]);

  if (!cloud) return null;

  return (
    <section className="mt-6 rounded-xl border border-border/70 bg-background/80 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">Google account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {email ? `Signed in as ${email}.` : "Signed in with Google."} Your planner
        is stored for this account and cached in this browser.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Friend blank site — real edits sync when signed in; empty seed data will
        not overwrite a richer personal backup. For the full CS234 UI, use the
        personal Hosting channel from the deploy summary.
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
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            void forcePullFromCloud()
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Pull failed.");
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
              .finally(() => {
                setPending(false);
              });
          }}
        >
          Sign out
        </Button>
      </div>
    </section>
  );
}
