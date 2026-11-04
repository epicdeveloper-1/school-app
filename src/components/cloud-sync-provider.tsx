"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isBlankProfile } from "@/lib/app-profile";
import {
  startCloudSyncLifecycle,
  whenCloudSyncReady,
} from "@/lib/cloud-sync";
import { startDesktopBackupLifecycle } from "@/lib/desktop-backup";
import { isFirebaseConfigured } from "@/lib/firebase-client";
import { hasDesktopBridge } from "@/lib/storage";

function needsBlockingSync(): boolean {
  if (!isBlankProfile() || !isFirebaseConfigured()) return false;
  if (typeof window === "undefined") return true;
  return !hasDesktopBridge();
}

/**
 * Starts local↔Firestore sync when Firebase is configured.
 * Blank website blocks until the first pull/push so the board is not empty.
 * Personal desktop never blocks — local files always work offline.
 */
export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !needsBlockingSync());

  useEffect(() => {
    const stopSync = startCloudSyncLifecycle();
    const stopBackup = startDesktopBackupLifecycle();
    if (!needsBlockingSync()) {
      return () => {
        stopBackup();
        stopSync();
      };
    }
    let active = true;
    void whenCloudSyncReady().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      stopBackup();
      stopSync();
    };
  }, []);

  if (!ready) {
    return (
      <div className="app-shell relative flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
        <p className="relative z-10 text-sm text-muted-foreground">
          Syncing your planner…
        </p>
      </div>
    );
  }

  return children;
}
