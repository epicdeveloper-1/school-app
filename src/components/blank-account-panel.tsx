"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { useIsCloudProfile } from "@/components/profile-copy";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";

export function BlankAccountPanel() {
  const cloud = useIsCloudProfile();
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud || !isFirebaseConfigured()) return;
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      setEmail(user?.email ?? null);
    });
  }, [cloud]);

  if (!cloud) return null;

  return (
    <section className="mt-6 rounded-xl border border-border/70 bg-background/80 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">Google account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {email ? `Signed in as ${email}.` : "Signed in with Google."} Your planner
        is stored for this account.
      </p>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void signOut(getFirebaseAuth())
            .catch(() => {
              setError("Could not sign out. Try again.");
              setPending(false);
            });
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </section>
  );
}
