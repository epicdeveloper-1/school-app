"use client";

import { parseTaskLinks } from "@/lib/task-links";

type TaskRichTextProps = {
  text: string;
  dimmed?: boolean;
  className?: string;
};

/** Renders task body text with markdown `[label](url)` as clickable links. */
export function TaskRichText({ text, dimmed, className }: TaskRichTextProps) {
  const segments = parseTaskLinks(text);
  return (
    <span
      className={
        className ??
        (dimmed ? "text-muted-foreground" : "text-foreground")
      }
    >
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-seafoam/50 underline-offset-2 hover:decoration-seafoam"
            onClick={(e) => e.stopPropagation()}
          >
            {seg.label}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
