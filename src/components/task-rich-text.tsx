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
  let visible = 0;
  return (
    <span
      className={
        className ??
        (dimmed ? "text-muted-foreground" : "text-foreground")
      }
    >
      {segments.map((seg, i) => {
        const start = visible;
        visible += seg.type === "link" ? seg.label.length : seg.text.length;
        return seg.type === "link" ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            data-vis-start={start}
            className="underline decoration-seafoam/50 underline-offset-2 hover:decoration-seafoam"
            onClick={(e) => e.stopPropagation()}
          >
            {seg.label}
          </a>
        ) : (
          <span key={i} data-vis-start={start}>
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}
