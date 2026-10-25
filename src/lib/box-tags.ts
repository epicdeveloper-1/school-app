import type { TaskItem } from "@/lib/week-plan";



/** Stable tag id (stored on tasks, events, routines). */

export type BoxTag = string;



export type BoxTagMeta = {

  id: BoxTag;

  label: string;

  /** Colored label shown before the editable text (joined with ` | `). */

  prefix: string;

  color: string;

};



/** First-launch tags for the blank friend build. */
export const BLANK_BOX_TAGS: BoxTagMeta[] = [
  {
    id: "optional",
    label: "Optional",
    prefix: "Optional",
    color: "#6b7f88",
  },
];

const INITIAL_BOX_TAGS: BoxTagMeta[] =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
    ? BLANK_BOX_TAGS
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./personal/box-tags").DEFAULT_BOX_TAGS as BoxTagMeta[]);

export function defaultBoxTags(): BoxTagMeta[] {
  return INITIAL_BOX_TAGS;
}

let runtimeTags: BoxTagMeta[] = [...defaultBoxTags()];



export function setRuntimeBoxTags(tags: readonly BoxTagMeta[]): void {

  runtimeTags = [...tags];

}



export function getBoxTags(): readonly BoxTagMeta[] {

  return runtimeTags;

}



/** @deprecated Use getBoxTags() or useTags(); kept for non-React modules at init. */

export const BOX_TAGS: BoxTagMeta[] = INITIAL_BOX_TAGS;



function tagIdSet(): Set<BoxTag> {

  return new Set(runtimeTags.map((t) => t.id));

}



export function boxTagMeta(id: BoxTag): BoxTagMeta {

  const found = runtimeTags.find((t) => t.id === id);

  if (found) return found;

  return {

    id,

    label: id,

    prefix: id,

    color: "#6b7f88",

  };

}



export function normalizeTaskTags(tags?: readonly string[] | null): BoxTag[] {

  const ids = tagIdSet();

  const seen = new Set<BoxTag>();

  for (const raw of tags ?? []) {

    if (!ids.has(raw)) continue;

    seen.add(raw);

  }

  // Display / storage order follows the settings registry order.

  return runtimeTags.map((t) => t.id).filter((id) => seen.has(id));

}



export function toggleTaskTag(tags: BoxTag[], id: BoxTag): BoxTag[] {

  if (tags.includes(id)) return normalizeTaskTags(tags.filter((t) => t !== id));

  return normalizeTaskTags([...tags, id]);

}



/** Primary course/lifestyle tag label for board sort (Optional ignored). */

export function primaryTagSortKey(tags: readonly BoxTag[] | undefined): string {

  const primary = (tags ?? []).find((t) => t !== "optional");

  return primary ? boxTagMeta(primary).label : "\uffff";

}



/**

 * Board display order: active scheduled-by-time, then active by tag A–Z,

 * then Optional, then done (done always last, under Optional).

 */

export function compareBoardBoxes(

  a: {

    done: boolean;

    tags?: readonly BoxTag[];

    text: string;

    index?: number;

    /** Minutes from midnight when scheduled; null/undefined = unscheduled. */

    startMinutes?: number | null;

  },

  b: {

    done: boolean;

    tags?: readonly BoxTag[];

    text: string;

    index?: number;

    startMinutes?: number | null;

  },

): number {

  const tier = (done: boolean, tags: readonly BoxTag[] | undefined) => {

    if (done) return 2;

    if ((tags ?? []).includes("optional")) return 1;

    return 0;

  };

  const ta = tier(a.done, a.tags);

  const tb = tier(b.done, b.tags);

  if (ta !== tb) return ta - tb;



  const aSched = a.startMinutes != null;

  const bSched = b.startMinutes != null;

  if (aSched !== bSched) return aSched ? -1 : 1;

  if (

    aSched &&

    bSched &&

    a.startMinutes !== b.startMinutes

  ) {

    return (a.startMinutes as number) - (b.startMinutes as number);

  }



  const ka = primaryTagSortKey(a.tags);

  const kb = primaryTagSortKey(b.tags);

  const byTag = ka.localeCompare(kb);

  if (byTag !== 0) return byTag;

  const byText = a.text.localeCompare(b.text);

  if (byText !== 0) return byText;

  return (a.index ?? 0) - (b.index ?? 0);

}



/** Snapshot so Backspace can restore text after a space→tag conversion. */

export type TagChipUndo = {

  /** Full field value to restore (as if space were typed, not converted). */

  value: string;

  tags: BoxTag[];

  cursor: number;

};



function escapeRegExp(s: string): string {

  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}



/**

 * If `text` ends with a tag label (case-insensitive, flexible spaces),

 * return the tag and the text with that label removed.

 */

export function matchTrailingTagLabel(text: string): {

  tag: BoxTag;

  textWithoutMatch: string;

  matchedText: string;

} | null {

  const candidates = [...runtimeTags].sort(

    (a, b) => b.label.length - a.label.length,

  );

  for (const meta of candidates) {

    const parts = meta.label.trim().split(/\s+/).map(escapeRegExp);

    const re = new RegExp(`(?:^|\\s)(${parts.join("\\s+")})$`, "i");

    const m = text.match(re);

    if (!m || m.index === undefined) continue;

    return {

      tag: meta.id,

      textWithoutMatch: text.slice(0, m.index).replace(/\s+$/, ""),

      matchedText: m[1],

    };

  }

  return null;

}



/**

 * Apply space→tag conversion at `cursor` in `value`.

 * Returns null when the token before the cursor is not a tag label,

 * or when that tag is already applied (so the word stays as text).

 */

export function applyTagChipFromSpace(

  value: string,

  cursor: number,

  tags: BoxTag[],

): { value: string; tags: BoxTag[]; undo: TagChipUndo; cursor: number } | null {

  const before = value.slice(0, cursor);

  const after = value.slice(cursor);

  const match = matchTrailingTagLabel(before);

  if (!match) return null;

  if (tags.includes(match.tag)) return null;

  const nextTags = normalizeTaskTags([...tags, match.tag]);

  const nextValue =

    match.textWithoutMatch.length > 0 && after.length > 0

      ? `${match.textWithoutMatch} ${after.replace(/^\s+/, "")}`

      : match.textWithoutMatch + after.replace(/^\s+/, "");

  return {

    value: nextValue,

    tags: nextTags,

    undo: {

      value: `${before} ${after}`,

      tags: [...tags],

      cursor: before.length + 1,

    },

    cursor: match.textWithoutMatch.length,

  };

}



/** Restore text/tags from a prior space→tag conversion. */

export function undoTagChip(

  _value: string,

  undo: TagChipUndo,

): { value: string; tags: BoxTag[]; cursor: number } {

  return {

    value: undo.value,

    tags: undo.tags,

    cursor: undo.cursor,

  };

}



/** Infer subject tags from seed / legacy task text. */

export function inferTagsFromText(text: string): BoxTag[] {

  const found: BoxTag[] = [];

  for (const meta of runtimeTags) {

    if (meta.id === "optional") continue;

    const parts = meta.label.trim().split(/\s+/).map(escapeRegExp);

    const re = new RegExp(`\\b${parts.join("\\s*")}\\b`, "i");

    if (re.test(text)) found.push(meta.id);

  }

  return found;

}



/** Editable body only — strip legacy "Optional:" / pipe-prefixed tags from text. */

export function taskBodyText(task: Pick<TaskItem, "text" | "optional" | "tags">): string {

  let text = task.text.trim();

  text = text.replace(/^Optional:\s*/i, "");

  const tags = normalizeTaskTags([

    ...(task.optional ? (["optional"] as BoxTag[]) : []),

    ...(task.tags ?? []),

  ]);

  for (const id of tags) {

    if (id === "optional") continue;

    const label = boxTagMeta(id).label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    text = text.replace(new RegExp(`^${label}(?:\\s*\\|\\s*|\\s+)`, "i"), "");

    text = text.replace(new RegExp(`^${label}\\s*`, "i"), "");

  }

  text = text.replace(/^\|\s*/, "");

  return text.trim();

}



export function migrateTaskTags(task: TaskItem): TaskItem {

  const fromLegacy = task.optional ? (["optional"] as BoxTag[]) : [];

  const existing = task.tags ?? [];

  const inferred =

    existing.length === 0 ? inferTagsFromText(task.text) : [];

  const tags = normalizeTaskTags([...fromLegacy, ...existing, ...inferred]);

  let text = taskBodyText({ ...task, tags });

  if (!text) {

    const raw = task.text.replace(/^Optional:\s*/i, "").trim();

    const onlyTagLabel = tags.some(

      (id) =>

        id !== "optional" &&

        boxTagMeta(id).label.toLowerCase() === raw.toLowerCase(),

    );

    text = onlyTagLabel ? "" : raw;

  }

  return {

    id: task.id,

    text,

    done: task.done,

    tags,

    ...(task.estimateMinutes ? { estimateMinutes: task.estimateMinutes } : {}),

    ...(task.startTime ? { startTime: task.startTime } : {}),

    ...(task.endTime ? { endTime: task.endTime } : {}),

  };

}


