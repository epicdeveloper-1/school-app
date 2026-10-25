import { readStorage, writeStorage } from "./storage";
import {
  defaultBoxTags,
  type BoxTag,
  type BoxTagMeta,
  setRuntimeBoxTags,
} from "./box-tags";

export const TAG_REGISTRY_STORAGE_KEY = "box-tags-registry-v1";

export type TagRegistryStore = {
  tags: BoxTagMeta[];
};

export function slugFromLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "tag";
}

function uniqueTagId(label: string, existing: readonly BoxTagMeta[]): BoxTag {
  const base = slugFromLabel(label);
  const ids = new Set(existing.map((t) => t.id));
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function parseRegistry(raw: string | null): TagRegistryStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TagRegistryStore;
    if (!parsed?.tags || !Array.isArray(parsed.tags)) return null;
    const tags = parsed.tags
      .filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          typeof t.label === "string" &&
          typeof t.color === "string",
      )
      .map((t) => ({
        id: t.id.trim(),
        label: t.label.trim(),
        prefix: (t.prefix ?? t.label).trim(),
        color: t.color.trim(),
      }))
      .filter((t) => t.id && t.label);
    if (tags.length === 0) return null;
    return { tags };
  } catch {
    return null;
  }
}

export async function loadTagRegistry(): Promise<BoxTagMeta[]> {
  const raw = await readStorage(TAG_REGISTRY_STORAGE_KEY);
  const parsed = parseRegistry(raw);
  const tags = parsed?.tags ?? [...defaultBoxTags()];
  setRuntimeBoxTags(tags);
  if (!parsed) {
    await writeStorage(
      TAG_REGISTRY_STORAGE_KEY,
      JSON.stringify({ tags } satisfies TagRegistryStore),
    );
  }
  return tags;
}

export async function persistTagRegistry(tags: BoxTagMeta[]): Promise<void> {
  setRuntimeBoxTags(tags);
  await writeStorage(
    TAG_REGISTRY_STORAGE_KEY,
    JSON.stringify({ tags } satisfies TagRegistryStore),
  );
}

export function createTagMeta(
  label: string,
  color: string,
  existing: readonly BoxTagMeta[],
): BoxTagMeta {
  const trimmed = label.trim();
  const id = uniqueTagId(trimmed, existing);
  return {
    id,
    label: trimmed,
    prefix: trimmed,
    color,
  };
}

export const TAG_COLOR_PRESETS = [
  "#1a1a1a",
  "#3d6fb0",
  "#1f9e8f",
  "#e08a8a",
  "#e891c0",
  "#7eb6e8",
  "#a8d86a",
  "#f2b705",
  "#6b7f88",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#64748b",
  "#0b2430",
  "#ef4444",
] as const;
