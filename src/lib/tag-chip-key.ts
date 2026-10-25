import type { KeyboardEvent } from "react";
import {
  BoxTag,
  TagChipUndo,
  applyTagChipFromSpace,
  undoTagChip,
} from "@/lib/box-tags";

export type TagChipUndoState = TagChipUndo & { key: string };

/**
 * Space converts a trailing tag name into a tag chip; Backspace undoes.
 * Returns true when the event was handled.
 */
export function handleTagChipKey(
  e: KeyboardEvent<HTMLInputElement>,
  opts: {
    key: string;
    value: string;
    tags: BoxTag[];
    undoRef: { current: TagChipUndoState | null };
    onChange: (next: { value: string; tags: BoxTag[] }) => void;
  },
): boolean {
  const { value, tags, undoRef, onChange } = opts;
  const input = e.currentTarget;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? start;

  if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (start !== end) {
      undoRef.current = null;
      return false;
    }
    const applied = applyTagChipFromSpace(value, start, tags);
    if (!applied) {
      undoRef.current = null;
      return false;
    }
    e.preventDefault();
    onChange({ value: applied.value, tags: applied.tags });
    undoRef.current = { ...applied.undo, key: opts.key };
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(applied.cursor, applied.cursor);
    });
    return true;
  }

  if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const undo = undoRef.current;
    if (undo && undo.key === opts.key) {
      e.preventDefault();
      undoRef.current = null;
      const restored = undoTagChip(value, undo);
      onChange({ value: restored.value, tags: restored.tags });
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(restored.cursor, restored.cursor);
      });
      return true;
    }
    return false;
  }

  if (e.key.length === 1 || e.key === "Delete" || e.key === "Enter") {
    undoRef.current = null;
  }
  return false;
}
