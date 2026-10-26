import { isBlankProfile } from "./app-profile";

declare global {
  interface Window {
    weeklyStrategy?: {
      platform: string;
      isDesktop: boolean;
      getItem: (key: string) => Promise<string | null>;
      setItem: (key: string, value: string) => Promise<boolean>;
      openExternal?: (url: string) => Promise<boolean>;
    };
  }
}

export type StorageTarget = "desktop" | "cloud" | "local";

/**
 * Desktop files win whenever the Electron bridge is present, including a blank
 * profile build. Cloud storage is only the blank browser site.
 */
export function storageTarget(input: {
  hasDesktop: boolean;
  blank: boolean;
}): StorageTarget {
  if (input.hasDesktop) return "desktop";
  if (input.blank) return "cloud";
  return "local";
}

function currentTarget(): StorageTarget {
  const desktop = typeof window !== "undefined" ? window.weeklyStrategy : undefined;
  return storageTarget({
    hasDesktop: Boolean(desktop?.getItem || desktop?.setItem),
    blank: isBlankProfile(),
  });
}

const cloudStorage =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
    ? import("./cloud-storage")
    : null;

/** Read a string from Electron userData, the blank site's Firestore, or localStorage. */
export async function readStorage(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const desktop = window.weeklyStrategy;
  const target = currentTarget();

  if (target === "desktop" && desktop?.getItem) {
    try {
      const fromFile = await desktop.getItem(key);
      if (fromFile != null && fromFile !== "") return fromFile;

      // One-time migrate from any prior localStorage value.
      const legacy = window.localStorage.getItem(key);
      if (legacy != null) {
        await desktop.setItem(key, legacy);
        return legacy;
      }
      return null;
    } catch {
      return window.localStorage.getItem(key);
    }
  }

  if (cloudStorage && target === "cloud") {
    const { readCloudStorage } = await cloudStorage;
    return readCloudStorage(key);
  }

  return window.localStorage.getItem(key);
}

/** Write a string to Electron userData, the blank site's Firestore, or localStorage. */
export async function writeStorage(key: string, value: string): Promise<void> {
  if (typeof window === "undefined") return;

  const desktop = window.weeklyStrategy;
  const target = currentTarget();

  if (target === "desktop" && desktop?.setItem) {
    try {
      await desktop.setItem(key, value);
      return;
    } catch {
      // Fall through to localStorage if IPC fails.
      window.localStorage.setItem(key, value);
      return;
    }
  }

  if (cloudStorage && target === "cloud") {
    const { writeCloudStorage } = await cloudStorage;
    await writeCloudStorage(key, value);
    return;
  }

  window.localStorage.setItem(key, value);
}
