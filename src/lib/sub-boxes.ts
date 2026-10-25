export type SubBox = {
  id: string;
  text: string;
  done: boolean;
};

export function normalizeSubBoxList(raw: unknown): SubBox[] {
  if (!Array.isArray(raw)) return [];
  const out: SubBox[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const value = item as Partial<SubBox>;
    if (typeof value.id !== "string" || value.id.length === 0) continue;
    out.push({
      id: value.id,
      text: typeof value.text === "string" ? value.text : "",
      done: Boolean(value.done),
    });
  }
  return out;
}

export function normalizeSubBoxMap(
  raw: unknown,
): Record<string, SubBox[]> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const next: Record<string, SubBox[]> = {};
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!id) continue;
    const subs = normalizeSubBoxList(list);
    if (subs.length > 0) next[id] = subs;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
