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

export function hasDesktopBridge(): boolean {
  if (typeof window === "undefined") return false;
  const desktop = window.weeklyStrategy;
  return Boolean(desktop?.getItem || desktop?.setItem);
}

/** Read from Electron userData files, else browser localStorage. */
export async function readLocalStorageValue(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const desktop = window.weeklyStrategy;
  if (desktop?.getItem) {
    try {
      const fromFile = await desktop.getItem(key);
      if (fromFile != null && fromFile !== "") return fromFile;

      const legacy = window.localStorage.getItem(key);
      if (legacy != null && desktop.setItem) {
        await desktop.setItem(key, legacy);
        return legacy;
      }
      return fromFile;
    } catch {
      return window.localStorage.getItem(key);
    }
  }

  return window.localStorage.getItem(key);
}

/** Write to Electron userData files, else browser localStorage. Never touches Firestore. */
export async function writeLocalStorageValue(
  key: string,
  value: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  const desktop = window.weeklyStrategy;
  if (desktop?.setItem) {
    try {
      await desktop.setItem(key, value);
      return;
    } catch {
      window.localStorage.setItem(key, value);
      return;
    }
  }

  window.localStorage.setItem(key, value);
}
