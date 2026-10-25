export type TaskTextSegment =
  | { type: "text"; text: string }
  | { type: "link"; label: string; href: string };

const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|www\.[^)\s]+|\/[^)\s]*)\)/gi;

/** Split task body into plain text and markdown `[label](url)` link segments. */
export function parseTaskLinks(text: string): TaskTextSegment[] {
  const segments: TaskTextSegment[] = [];
  let last = 0;
  const re = new RegExp(MD_LINK_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", text: text.slice(last, match.index) });
    }
    segments.push({
      type: "link",
      label: match[1],
      href: normalizeHref(match[2]),
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", text: text.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", text }];
}

export function normalizeHref(raw: string): string {
  const href = raw.trim();
  if (!href) return "";
  if (/^https?:\/\//i.test(href) || href.startsWith("/")) return href;
  if (/^www\./i.test(href)) return `https://${href}`;
  return `https://${href}`;
}

/**
 * Wrap the current selection in a markdown link, or insert `[link](url)`.
 * Returns null if the user cancels the URL prompt.
 */
export function applyLinkAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  askUrl: (prefill: string) => string | null = defaultAskUrl,
): { value: string; selectionStart: number; selectionEnd: number } | null {
  const start = Math.max(0, Math.min(selectionStart, selectionEnd));
  const end = Math.max(0, Math.max(selectionStart, selectionEnd));
  const selected = value.slice(start, end);
  const prefill =
    selected && /^https?:\/\//i.test(selected.trim())
      ? selected.trim()
      : "https://";
  const raw = askUrl(prefill);
  if (raw === null) return null;
  const href = normalizeHref(raw);
  if (!href) return null;

  const label = selected.trim()
    ? selected
    : /^https?:\/\//i.test(selected.trim())
      ? href
      : "link";
  const markdown = `[${label}](${href})`;
  const next = value.slice(0, start) + markdown + value.slice(end);
  const caret = start + markdown.length;
  return { value: next, selectionStart: caret, selectionEnd: caret };
}

function defaultAskUrl(prefill: string): string | null {
  if (typeof window === "undefined") return null;
  return window.prompt("Link URL", prefill);
}
