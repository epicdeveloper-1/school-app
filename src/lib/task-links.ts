export type TaskTextSegment =
  | { type: "text"; text: string }
  | { type: "link"; label: string; href: string };

const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|www\.[^)\s]+|\/[^)\s]*)\)/gi;

type Token =
  | { type: "text"; text: string }
  | { type: "link"; label: string; href: string; raw: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const re = new RegExp(MD_LINK_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: "text", text: text.slice(last, match.index) });
    }
    tokens.push({
      type: "link",
      label: match[1],
      href: normalizeHref(match[2]),
      raw: match[0],
    });
    last = match.index + match[0].length;
  }
  if (last < text.length || tokens.length === 0) {
    tokens.push({ type: "text", text: text.slice(last) });
  }
  return tokens;
}

/** Split task body into plain text and markdown `[label](url)` link segments. */
export function parseTaskLinks(text: string): TaskTextSegment[] {
  return tokenize(text).map((token) =>
    token.type === "text"
      ? { type: "text", text: token.text }
      : { type: "link", label: token.label, href: token.href },
  );
}

/** Visible characters of a task body, with link labels and without markdown syntax. */
export function visibleTaskText(text: string): string {
  return parseTaskLinks(text)
    .map((segment) => (segment.type === "link" ? segment.label : segment.text))
    .join("");
}

export function normalizeHref(raw: string): string {
  const href = raw.trim();
  if (!href) return "";
  if (/^https?:\/\//i.test(href) || href.startsWith("/")) return href;
  if (/^www\./i.test(href)) return `https://${href}`;
  return `https://${href}`;
}

function safeLabel(label: string): string {
  const cleaned = label.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || "link";
}

type Piece = { ch: string; href?: string };

function toPieces(text: string): Piece[] {
  const pieces: Piece[] = [];
  for (const token of tokenize(text)) {
    const chars = token.type === "text" ? token.text : token.label;
    for (const ch of chars) {
      pieces.push(token.type === "link" ? { ch, href: token.href } : { ch });
    }
  }
  return pieces;
}

function fromPieces(pieces: Piece[]): string {
  let out = "";
  let i = 0;
  while (i < pieces.length) {
    const href = pieces[i]?.href;
    let j = i + 1;
    while (j < pieces.length && pieces[j]?.href === href) j++;
    const label = pieces
      .slice(i, j)
      .map((piece) => piece.ch)
      .join("");
    out += href ? `[${label}](${href})` : label;
    i = j;
  }
  return out;
}

/** Map a raw-string caret to an index in the visible (link-label) text. */
export function sourceIndexToVisible(text: string, sourceIndex: number): number {
  const index = Math.max(0, sourceIndex);
  let source = 0;
  let visible = 0;
  for (const token of tokenize(text)) {
    if (token.type === "text") {
      const len = token.text.length;
      if (index <= source + len) return visible + (index - source);
      source += len;
      visible += len;
      continue;
    }
    const rawLen = token.raw.length;
    if (index <= source + rawLen) {
      const rel = index - source;
      const labelStart = 1;
      const labelEnd = 1 + token.label.length;
      if (rel <= labelStart) return visible;
      if (rel >= labelEnd) return visible + token.label.length;
      return visible + (rel - labelStart);
    }
    source += rawLen;
    visible += token.label.length;
  }
  return visible;
}

function visibleIndexToSource(text: string, visibleIndex: number): number {
  const index = Math.max(0, visibleIndex);
  let source = 0;
  let visible = 0;
  for (const token of tokenize(text)) {
    if (token.type === "text") {
      const len = token.text.length;
      if (index <= visible + len) return source + (index - visible);
      visible += len;
      source += len;
      continue;
    }
    const labelLen = token.label.length;
    const rawLen = token.raw.length;
    if (index <= visible + labelLen) {
      if (index >= visible + labelLen) return source + rawLen;
      if (index <= visible) return source;
      return source + 1 + (index - visible);
    }
    visible += labelLen;
    source += rawLen;
  }
  return source;
}

function visibleSlice(text: string, visStart: number, visEnd: number): string {
  const start = Math.min(visStart, visEnd);
  const end = Math.max(visStart, visEnd);
  let out = "";
  let cursor = 0;
  for (const token of tokenize(text)) {
    const chunk = token.type === "text" ? token.text : token.label;
    const fromIndex = cursor;
    const toIndex = cursor + chunk.length;
    cursor = toIndex;
    if (toIndex <= start || fromIndex >= end) continue;
    const from = Math.max(0, start - fromIndex);
    const to = Math.min(chunk.length, end - fromIndex);
    out += chunk.slice(from, to);
  }
  return out;
}

/** Replace the visible character range with a markdown link. */
export function applyLinkAtVisibleRange(
  text: string,
  visStart: number,
  visEnd: number,
  href: string,
  label: string,
): string {
  const pieces = toPieces(text);
  const start = Math.max(0, Math.min(visStart, visEnd, pieces.length));
  const end = Math.max(
    start,
    Math.min(Math.max(visStart, visEnd), pieces.length),
  );
  const mid: Piece[] = [];
  for (const ch of safeLabel(label)) mid.push({ ch, href });
  return fromPieces([...pieces.slice(0, start), ...mid, ...pieces.slice(end)]);
}

/**
 * Prompt for a URL and link the visible selection.
 * Returns null if the prompt is cancelled or the URL is empty.
 */
export function linkVisibleSelection(
  text: string,
  visStart: number,
  visEnd: number,
  label: string,
  askUrl: (prefill: string) => string | null = defaultAskUrl,
): string | null {
  const trimmed = label.replace(/[\[\]]/g, "").trim();
  const prefill = /^https?:\/\//i.test(trimmed) ? trimmed : "https://";
  const raw = askUrl(prefill);
  if (raw === null) return null;
  const href = normalizeHref(raw);
  if (!href) return null;
  return applyLinkAtVisibleRange(
    text,
    visStart,
    visEnd,
    href,
    trimmed || "link",
  );
}

/**
 * Wrap the current input selection in a markdown link, or insert `[link](url)`.
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
  const visStart = sourceIndexToVisible(value, start);
  const visEnd = sourceIndexToVisible(value, end);
  const selected = visibleSlice(value, visStart, visEnd);
  const next = linkVisibleSelection(value, visStart, visEnd, selected, askUrl);
  if (next == null) return null;
  const caret = visibleIndexToSource(next, visStart + safeLabel(selected).length);
  return { value: next, selectionStart: caret, selectionEnd: caret };
}

function defaultAskUrl(prefill: string): string | null {
  if (typeof window === "undefined") return null;
  return window.prompt("Link URL", prefill);
}
