// ============================================================================
// Study-note utilities — heading extraction (TOC), excerpt generation and
// callout (tip / mnemonic / trap / high-yield) classification used by the
// rich MarkdownNote renderer and the share-card exporter.
// ============================================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export interface NoteHeading {
  level: 2 | 3;
  text: string;
  id: string;
}

/** Extract h2/h3 headings from raw markdown for a table of contents. */
export function extractHeadings(markdown: string): NoteHeading[] {
  const headings: NoteHeading[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length === 2 ? 2 : 3;
    const text = stripInline(m[2]);
    if (!text) continue;
    headings.push({ level, text, id: slugify(text) });
  }
  return headings;
}

/** Remove inline markdown (bold, italics, code, links, emoji) from a string. */
export function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/^#+\s+/, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "") // emoji
    .trim();
}

/** Strip all markdown syntax from a body of text (used for card excerpts). */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code / diagrams
    .replace(/^\s*>\s?/gm, "") // blockquote markers
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a clean excerpt for the share card — the first paragraph after the
 * H1 title, trimmed to `chars` characters.
 */
export function getExcerpt(markdown: string, chars = 280): string {
  const lines = markdown.split("\n");
  const body = lines
    .filter((l) => {
      const t = l.trim();
      return (
        t.length > 0 &&
        !t.startsWith("#") &&
        !t.startsWith("```") &&
        !t.startsWith("---") &&
        !t.startsWith(">")
      );
    })
    .join(" ");
  const stripped = stripMarkdown(body);
  if (stripped.length <= chars) return stripped;
  const cut = stripped.slice(0, chars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : chars).trim()}…`;
}

// ---------------------------------------------------------------------------
// Callout classification — blockquotes that open with a marker word or emoji
// render as branded callout cards (Tip / Mnemonic / Trap / High-Yield / …).
// ---------------------------------------------------------------------------

export type CalloutTone =
  | "tip"
  | "mnemonic"
  | "trap"
  | "highYield"
  | "pearl"
  | "warning"
  | "note";

export interface CalloutInfo {
  label: string;
  tone: CalloutTone;
  emoji: string;
}

const EMOJI_TONES: Record<string, CalloutTone> = {
  "💡": "tip",
  "🧠": "mnemonic",
  "⚠️": "trap",
  "❗": "trap",
  "📌": "highYield",
  "🔑": "highYield",
  "🩺": "pearl",
  "🔴": "warning",
  "💊": "pearl",
};

const WORD_TONES: Array<[RegExp, CalloutTone, string]> = [
  [/mnemonic/i, "mnemonic", "Mnemonic"],
  [/high[\s-]?yield/i, "highYield", "High-Yield"],
  [/key\s?point/i, "highYield", "Key Point"],
  [/trap|pitfall/i, "trap", "Trap"],
  [/tip/i, "tip", "Tip"],
  [/clinical\s?pearl/i, "pearl", "Clinical Pearl"],
  [/classic\s?example/i, "pearl", "Clinical Pearl"],
  [/warning|caution/i, "warning", "Warning"],
];

const TONE_LABELS: Record<CalloutTone, string> = {
  tip: "Tip",
  mnemonic: "Mnemonic",
  trap: "Trap",
  highYield: "High-Yield",
  pearl: "Clinical Pearl",
  warning: "Warning",
  note: "Note",
};

/** Classify the opening line of a blockquote. Returns null for plain quotes. */
export function classifyCallout(firstLine: string): CalloutInfo | null {
  const line = firstLine.replace(/^>\s?/, "").trim();
  if (!line) return null;

  // Emoji marker first — e.g. `> 💡 **Tip:** …` or `> 💡 Tip: …`
  const emojiMatch = line.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+)/u);
  if (emojiMatch) {
    const emoji = emojiMatch[1].trim();
    for (const [key, tone] of Object.entries(EMOJI_TONES)) {
      if (emoji.includes(key)) {
        return { label: TONE_LABELS[tone], tone, emoji: key };
      }
    }
  }

  const text = line.replace(/\*\*/g, " ").replace(/[^a-zA-Z\s-]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, tone, label] of WORD_TONES) {
    if (re.test(text)) {
      const emoji = Object.entries(EMOJI_TONES).find(([, t]) => t === tone)?.[0] ?? "💬";
      return { label, tone, emoji };
    }
  }
  return null;
}

/** Split a callout's opening line into marker + remaining content. */
export function splitCalloutLine(line: string): { marker: string; rest: string } {
  const text = line.replace(/^>\s?/, "").trim();
  const emojiMatch = text.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+)\s*/u);
  let rest = text;
  if (emojiMatch) rest = text.slice(emojiMatch[0].length);
  const labelMatch = rest.match(/^\*\*([^*]+):?\*\*\s*/);
  if (labelMatch) rest = rest.slice(labelMatch[0].length);
  else {
    const plain = rest.match(/^([A-Za-z][A-Za-z -]*?):\s*/);
    if (plain) rest = rest.slice(plain[0].length);
  }
  return { marker: text.slice(0, text.length - rest.length), rest: rest.trim() };
}

/** Approximate reading time in minutes for a markdown body. */
export function readingTime(markdown: string): number {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
