"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";

function StatusScreen({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="app-shell relative flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10 w-full max-w-md text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-seafoam uppercase">
          Weekly Strategy
        </p>
        <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function authErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "auth/unauthorized-domain") {
      return "This site’s address is not allowed for Google sign-in yet.";
    }
    if (code === "auth/popup-blocked" || code === "auth/web-storage-unsupported") {
      return "This browser blocked Google sign-in. Allow cookies and storage for this site, then try again.";
    }
  }
  return "Google sign-in did not finish. Try again.";
}

function WebSignIn({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null | undefined>(configured ? undefined : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    let unsubscribe = () => {};
    let cancelled = false;
    void getRedirectResult(auth)
      .catch((err: unknown) => {
        if (!cancelled) setError(authErrorMessage(err));
      })
      .finally(() => {
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, (next) => {
          setUser(next);
        });
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured]);

  if (!isFirebaseConfigured()) {
    return (
      <StatusScreen
        title="Sign-in is not set up"
        body="This blank site needs Firebase web config before Google sign-in can save a planner."
      />
    );
  }

  if (user === undefined) {
    return (
      <StatusScreen
        title="Weekly Strategy"
        body="Checking your Google account…"
      />
    );
  }

  if (!user) {
    return (
      <div className="app-shell relative flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 max-w-[50vw] rounded-full bg-seafoam/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-md text-center">
          <p className="text-sm font-medium tracking-[0.2em] text-seafoam uppercase">
            Weekly Strategy
          </p>
          <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-ink">
            Sign in to keep your week
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Your board and calendar are saved to your Google account. They stay
            separate from anyone else’s.
          </p>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button
            type="button"
            className="mt-8 h-10 bg-seafoam px-5 text-white hover:bg-seafoam/80"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void signInWithRedirect(getFirebaseAuth(), new GoogleAuthProvider()).catch(
                (err: unknown) => {
                  setBusy(false);
                  setError(authErrorMessage(err));
                },
              );
            }}
          >
            {busy ? "Redirecting to Google…" : "Continue with Google"}
          </Button>
        </div>
      </div>
    );
  }

  return children;
}

/**
 * Blank builds only. The desktop bridge skips sign-in and keeps using local files.
 * The website waits for Google sign-in before any planner code can read storage.
 */
export function BlankAuthGate({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<"pending" | "desktop" | "web">("pending");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKind(window.weeklyStrategy?.getItem ? "desktop" : "web");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (kind === "desktop") return children;
  if (kind !== "web") {
    return <StatusScreen title="Weekly Strategy" body="Loading…" />;
  }
  return <WebSignIn>{children}</WebSignIn>;
}
