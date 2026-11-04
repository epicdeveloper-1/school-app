import { getAppProfile, type AppProfile } from "./app-profile";

/** How substantial a synced JSON blob looks (higher = more real user data). */
export function blobRichness(value: string): number {
  if (!value) return 0;
  try {
    const data = JSON.parse(value) as unknown;
    return richnessOf(data) + Math.min(value.length, 4000) / 200;
  } catch {
    return Math.min(value.length, 4000) / 50;
  }
}

function richnessOf(data: unknown): number {
  if (data == null) return 0;
  if (Array.isArray(data)) {
    let score = data.length * 80;
    for (const item of data) {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        if (Array.isArray(row.tags) && row.tags.length > 0) score += row.tags.length * 20;
        if (typeof row.text === "string" && row.text.trim()) score += 15;
        if (typeof row.title === "string" && row.title.trim()) score += 15;
      }
    }
    return score;
  }
  if (typeof data !== "object") return 5;

  const obj = data as Record<string, unknown>;
  let score = 0;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) score += richnessOf(value);
    else if (value && typeof value === "object") {
      score += Object.keys(value as object).length * 8;
      score += richnessOf(value) * 0.25;
    } else if (typeof value === "string" && value.trim()) score += 4;
    else if (typeof value === "number" || typeof value === "boolean") score += 1;
  }
  return score;
}

/**
 * True when local looks like an empty/seed shell next to real cloud data.
 * Used so a blank browser tab cannot LWW-clobber a personal desktop backup.
 */
export function localIsTooSparseForCloud(
  local: string | null | undefined,
  cloud: string | null | undefined,
): boolean {
  if (cloud == null || cloud === "") return false;
  if (local == null || local === "") return true;
  const cloudScore = blobRichness(cloud);
  if (cloudScore < 40) return false;
  const localScore = blobRichness(local);
  return localScore < cloudScore * 0.5;
}

/** Blank clients must not overwrite blobs written by the personal app. */
export function blankMayOverwriteProfile(
  existingProfile: AppProfile | null | undefined,
): boolean {
  if (getAppProfile() !== "blank") return true;
  if (existingProfile === "personal") return false;
  return true;
}
