"use client";

import { useEffect, useRef, useState } from "react";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTags } from "@/components/tags-provider";
import {
  BoxTag,
  boxTagMeta,
  normalizeTaskTags,
  toggleTaskTag,
} from "@/lib/box-tags";

type BoxTagPickerProps = {
  tags: BoxTag[];
  onChange: (tags: BoxTag[]) => void;
  align?: "left" | "right";
};

export function BoxTagList({
  tags,
  onChange,
}: {
  tags: BoxTag[];
  onChange: (tags: BoxTag[]) => void;
}) {
  const { tags: boxTags } = useTags();
  const selected = normalizeTaskTags(tags);

  return (
    <>
      {boxTags.map((meta) => {
        const active = selected.includes(meta.id);
        return (
          <button
            key={meta.id}
            type="button"
            role="option"
            aria-selected={active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(toggleTaskTag(selected, meta.id))}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/70 ${
              active ? "bg-secondary/50" : ""
            }`}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            <span style={{ color: meta.color }} className="font-medium">
              {meta.label}
            </span>
          </button>
        );
      })}
    </>
  );
}

export function BoxTagPicker({
  tags,
  onChange,
  align = "right",
}: BoxTagPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = normalizeTaskTags(tags);

  return (
    <div ref={rootRef} className={`relative shrink-0 ${open ? "z-50" : ""}`}>
      <Button
        type="button"
        variant={open || selected.length > 0 ? "secondary" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose tags"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="relative"
      >
        <Tags className="size-3.5" />
        {selected.length > 0 && (
          <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-seafoam text-[9px] font-semibold text-white">
            {selected.length}
          </span>
        )}
      </Button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className={`absolute top-full z-50 mt-1 w-44 rounded-xl border border-border/80 bg-white p-1.5 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <BoxTagList tags={tags} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function TaskTagPrefixes({
  tags,
  dimmed,
  /** Append ` | ` after tags (before body text). Default true. */
  separator = true,
}: {
  tags?: BoxTag[] | null;
  dimmed?: boolean;
  separator?: boolean;
}) {
  useTags();
  const ordered = normalizeTaskTags(tags);
  if (ordered.length === 0) return null;
  return (
    <span className={dimmed ? "opacity-70" : undefined}>
      {ordered.map((id, i) => {
        const meta = boxTagMeta(id);
        const isLast = i === ordered.length - 1;
        // Trailing ` | ` stays glued to the tag so a wrap never leaves `|`
        // alone at the start of the next line — the whole `Tag |` unit moves.
        const trail = !isLast || separator;
        return (
          <span key={id} className="whitespace-nowrap">
            <span
              style={{ color: meta.color }}
              className={id === "optional" ? undefined : "font-semibold"}
            >
              {meta.label}
            </span>
            {trail && (
              <span className="font-semibold text-muted-foreground">
                {" | "}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
