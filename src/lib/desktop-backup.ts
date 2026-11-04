import { whenCloudSyncReady } from "./cloud-sync";
import {
  hasDesktopBridge,
  readLocalStorageValue,
  writeLocalStorageValue,
} from "./local-storage";

export const DESKTOP_BACKUP_META_KEY = "desktop-backup-meta-v1";

/** How often to re-check while the app stays open (day rollover). */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export type DesktopBackupMeta = {
  /** Local calendar day of the last successful backup (YYYY-MM-DD). */
  lastBackupDay: string | null;
  lastBackupAt: number | null;
  lastBackupDir: string | null;
  lastError: string | null;
};

const emptyMeta = (): DesktopBackupMeta => ({
  lastBackupDay: null,
  lastBackupAt: null,
  lastBackupDir: null,
  lastError: null,
});

function localDayStamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseMeta(raw: string | null): DesktopBackupMeta {
  if (!raw) return emptyMeta();
  try {
    const parsed = JSON.parse(raw) as DesktopBackupMeta;
    if (!parsed || typeof parsed !== "object") return emptyMeta();
    return {
      lastBackupDay:
        typeof parsed.lastBackupDay === "string" ? parsed.lastBackupDay : null,
      lastBackupAt:
        typeof parsed.lastBackupAt === "number" ? parsed.lastBackupAt : null,
      lastBackupDir:
        typeof parsed.lastBackupDir === "string" ? parsed.lastBackupDir : null,
      lastError:
        typeof parsed.lastError === "string" ? parsed.lastError : null,
    };
  } catch {
    return emptyMeta();
  }
}

async function loadMeta(): Promise<DesktopBackupMeta> {
  return parseMeta(await readLocalStorageValue(DESKTOP_BACKUP_META_KEY));
}

async function saveMeta(meta: DesktopBackupMeta): Promise<void> {
  await writeLocalStorageValue(DESKTOP_BACKUP_META_KEY, JSON.stringify(meta));
}

function backupLog(...args: unknown[]): void {
  if (typeof console === "undefined") return;
  console.info("[weekly-strategy:backup]", ...args);
}

function isBackupDue(meta: DesktopBackupMeta, today = localDayStamp()): boolean {
  return meta.lastBackupDay !== today;
}

let started = false;
let running = false;
let checkTimer: ReturnType<typeof setInterval> | null = null;

/**
 * After cloud sync's first pass (or immediately if Firebase is off), copy all
 * desktop storage JSON into userData/backups/YYYY-MM-DD once per local day.
 */
async function maybeRunDailyBackup(): Promise<void> {
  if (!hasDesktopBridge()) return;
  const backupDaily = window.weeklyStrategy?.backupDaily;
  if (!backupDaily) return;
  if (running) return;

  running = true;
  try {
    await whenCloudSyncReady();

    const meta = await loadMeta();
    const today = localDayStamp();
    if (!isBackupDue(meta, today)) {
      backupLog("skip — already backed up", meta.lastBackupDay);
      return;
    }

    backupLog("starting daily backup for", today);
    const result = await backupDaily();
    if (!result.ok) {
      const error = result.error ?? "Backup failed.";
      backupLog("failed", error);
      await saveMeta({
        ...meta,
        lastError: error,
      });
      return;
    }

    await saveMeta({
      lastBackupDay: result.day,
      lastBackupAt: result.at,
      lastBackupDir: result.dir,
      lastError: null,
    });
    backupLog("ok", result.day, "files", result.fileCount, result.dir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    backupLog("error", message);
    try {
      const meta = await loadMeta();
      await saveMeta({ ...meta, lastError: message });
    } catch {
      /* ignore */
    }
  } finally {
    running = false;
  }
}

/**
 * Desktop-only. Waits for first sync, then backs up if today's copy is missing.
 * Keeps polling while the window stays open so a midnight rollover still runs.
 */
export function startDesktopBackupLifecycle(): () => void {
  if (started) return () => {};
  if (typeof window === "undefined") return () => {};
  if (!hasDesktopBridge() || !window.weeklyStrategy?.backupDaily) {
    return () => {};
  }

  started = true;
  void maybeRunDailyBackup();

  checkTimer = setInterval(() => {
    void maybeRunDailyBackup();
  }, CHECK_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void maybeRunDailyBackup();
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    started = false;
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisible);
  };
}
