// ============================================================================
// Note block model — a small markdown <-> structured-block bridge that powers
// the visual (Canva-style) study-note editor. The student reader keeps
// rendering plain markdown, so every block round-trips losslessly.
//
//   markdown ──parse──▶ NoteBlock[] ──serialize──▶ markdown
//
// Blocks: heading, paragraph, list, checklist, callout, table, mermaid,
// math, image, divider, code.
// ============================================================================

import { classifyCallout, splitCalloutLine, type CalloutTone } from "./note-utils";

export type NoteBlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "checklist"
  | "callout"
  | "table"
  | "mermaid"
  | "math"
  | "image"
  | "divider"
  | "code"
  | "canvas";

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  /** heading level (1–6). */
  level?: number;
  /** heading / paragraph / callout text / math latex. */
  text?: string;
  /** list: ordered vs bullet. */
  ordered?: boolean;
  /** list / checklist items. Checklist items keep their `[x]` / `[ ]` marker. */
  items?: string[];
  /** callout tone. */
  tone?: CalloutTone;
  /** math: block (`$$`) vs inline (`$`). */
  display?: boolean;
  /** table: raw GFM markdown, preserved verbatim. */
  markdown?: string;
  /** mermaid diagram source. */
  code?: string;
  /** code fence language. */
  lang?: string;
  /** image. */
  src?: string;
  alt?: string;
  caption?: string;
  /** canvas design (serialized JSON from the Canva-style editor). */
  design?: string;
}

let _id = 0;
function nextId(): string {
  _id += 1;
  return `b${_id.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Tones → serialization markers (kept in sync with classifyCallout).
// ---------------------------------------------------------------------------

export const CALLOUT_MARKERS: Record<CalloutTone, { emoji: string; label: string }> = {
  tip: { emoji: "💡", label: "Tip" },
  mnemonic: { emoji: "🧠", label: "Mnemonic" },
  trap: { emoji: "⚠️", label: "Trap" },
  highYield: { emoji: "📌", label: "High-Yield" },
  pearl: { emoji: "🩺", label: "Clinical Pearl" },
  warning: { emoji: "🔴", label: "Warning" },
  note: { emoji: "💬", label: "Note" },
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseNoteBlocks(markdown: string): NoteBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: NoteBlock[] = [];
  let i = 0;

  const push = (block: Omit<NoteBlock, "id">) => blocks.push({ id: nextId(), ...block });

  const isBlank = (l: string) => l.trim() === "";
  const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-") && l.includes("|");
  const isDivider = (l: string) => /^(\s*[-*_]\s*){3,}$/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    // Blank lines separate blocks.
    if (isBlank(line)) { i += 1; continue; }

    // Fenced code (mermaid / canvas / generic).
    const fence = /^```(\S*)\s*$/.exec(t);
    if (fence) {
      const lang = fence[1];
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      if (lang === "mermaid") {
        push({ type: "mermaid", code: body.join("\n") });
      } else if (lang === "canvas") {
        push({ type: "canvas", design: body.join("\n") });
      } else {
        push({ type: "code", code: body.join("\n"), lang });
      }
      continue;
    }

    // Display math: `$$` fence or single-line `$$...$$`.
    if (t === "$$") {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== "$$") {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing $$
      push({ type: "math", display: true, text: body.join("\n") });
      continue;
    }
    const singleMath = /^\$\$(.+)\$\$\s*$/.exec(t);
    if (singleMath) {
      push({ type: "math", display: true, text: singleMath[1] });
      i += 1;
      continue;
    }

    // Blockquote → callout (or plain note blockquote kept as callout "note").
    if (t.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      const first = quote[0] ?? "";
      const info = classifyCallout(first);
      const tone = info?.tone ?? "note";
      // Strip the marker from the first line so the editor shows clean text.
      const { rest } = splitCalloutLine(first);
      const text = [rest, ...quote.slice(1)].join("\n").trim();
      push({ type: "callout", tone, text });
      continue;
    }

    // GFM table — header row followed by a separator row.
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim());
        i += 1;
      }
      push({ type: "table", markdown: rows.join("\n") });
      continue;
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      push({ type: "heading", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    // Divider.
    if (isDivider(line)) {
      push({ type: "divider" });
      i += 1;
      continue;
    }

    // Image-only line.
    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(line);
    if (image) {
      push({ type: "image", alt: image[1], src: image[2], caption: image[3] ?? "" });
      i += 1;
      continue;
    }

    // Checklist (`- [ ]` / `- [x]`).
    if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i])) {
        items.push(lines[i].trim());
        i += 1;
      }
      push({ type: "checklist", items });
      continue;
    }

    // List (bullet or ordered).
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].trim());
        i += 1;
      }
      push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph — accumulate until a blank line or a new structural line.
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i])) {
      const l = lines[i];
      const lt = l.trim();
      if (
        /^```/.test(lt) || lt === "$$" || /^\$\$.+\$\$\s*$/.test(lt) ||
        lt.startsWith(">") || (lt.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) ||
        /^#{1,6}\s+/.test(lt) || isDivider(l) ||
        /^!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)\s*$/.test(lt) ||
        /^\s*([-*+]|\d+\.)\s+/.test(lt)
      ) {
        break;
      }
      para.push(l);
      i += 1;
    }
    if (para.length > 0) {
      push({ type: "paragraph", text: para.join("\n") });
    } else {
      i += 1;
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeNoteBlocks(blocks: NoteBlock[]): string {
  return blocks.map(serializeBlock).filter(Boolean).join("\n\n") + "\n";
}

function serializeBlock(block: NoteBlock): string {
  switch (block.type) {
    case "heading":
      return `${"#".repeat(Math.min(6, Math.max(1, block.level ?? 2)))} ${(block.text ?? "").trim()}`;
    case "paragraph":
      return block.text ?? "";
    case "list": {
      const items = block.items ?? [];
      if (block.ordered) {
        return items.map((it, idx) => `${idx + 1}. ${it.replace(/^\s*\d+\.\s+/, "")}`).join("\n");
      }
      return items.map((it) => it.replace(/^\s*[-*+]\s+/, "- ")).join("\n");
    }
    case "checklist":
      return (block.items ?? []).map((it) => {
        const m = /^\s*[-*+]\s+(\[[ xX]\]\s*)?/.exec(it);
        const checked = /^\s*[-*+]\s+\[[xX]\]/.test(it);
        const text = it.replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, "");
        return `- [${checked ? "x" : " "}] ${text}`;
      }).join("\n");
    case "callout": {
      const marker = CALLOUT_MARKERS[block.tone ?? "note"];
      const lines = (block.text ?? "").split("\n");
      return lines.map((l) => `> ${l}`).join("\n").replace(/^>\s/, `> **${marker.emoji} ${marker.label}:** `);
    }
    case "table":
      return block.markdown ?? "";
    case "mermaid":
      return "```mermaid\n" + (block.code ?? "") + "\n```";
    case "canvas":
      return "```canvas\n" + (block.design ?? "{}") + "\n```";
    case "math":
      if (block.display) return "$$\n" + (block.text ?? "") + "\n$$";
      return `$${(block.text ?? "").trim()}$`;
    case "image": {
      const alt = block.alt ?? "";
      const src = block.src ?? "";
      const cap = block.caption ? ` "${block.caption.replace(/"/g, '\\"')}"` : "";
      return `![${alt}](${src}${cap})`;
    }
    case "divider":
      return "---";
    case "code":
      return `\`\`\`${block.lang ?? ""}\n${block.code ?? ""}\n\`\`\``;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Editor helpers (immutable updates)
// ---------------------------------------------------------------------------

export function updateBlock(blocks: NoteBlock[], id: string, patch: Partial<NoteBlock>): NoteBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...patch, id: b.id } : b));
}

export function addBlockAfter(blocks: NoteBlock[], afterId: string | null, block: Omit<NoteBlock, "id">): NoteBlock[] {
  const next = { id: nextId(), ...block };
  if (afterId === null) return [...blocks, next];
  const idx = blocks.findIndex((b) => b.id === afterId);
  if (idx === -1) return [...blocks, next];
  return [...blocks.slice(0, idx + 1), next, ...blocks.slice(idx + 1)];
}

export function removeBlock(blocks: NoteBlock[], id: string): NoteBlock[] {
  return blocks.filter((b) => b.id !== id);
}

export function duplicateBlock(blocks: NoteBlock[], id: string): NoteBlock[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return blocks;
  const copy = { ...blocks[idx], id: nextId() };
  return [...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)];
}

export function moveBlock(blocks: NoteBlock[], id: string, dir: -1 | 1): NoteBlock[] {
  const idx = blocks.findIndex((b) => b.id === id);
  const to = idx + dir;
  if (idx === -1 || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [b] = next.splice(idx, 1);
  next.splice(to, 0, b);
  return next;
}

/** Checklist item helpers — items keep their `[x]` / `[ ]` marker. */
export function isChecked(item: string): boolean {
  return /^\s*[-*+]\s+\[[xX]\]/.test(item);
}

export function setChecked(item: string, checked: boolean): string {
  const text = item.replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, "");
  return `- [${checked ? "x" : " "}] ${text}`;
}

// ---------------------------------------------------------------------------
// Mermaid flowchart builder — a tiny node/edge model that powers the visual
// "connectors" editor. Best-effort parse of simple `flowchart TD` sources;
// anything it can't understand falls back to raw source editing.
// ---------------------------------------------------------------------------

export type FlowShape = "rect" | "diamond" | "round";

export interface FlowNode {
  id: string;
  label: string;
  shape: FlowShape;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
}

export interface FlowchartModel {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const SHAPE_WRAP: Record<FlowShape, [string, string]> = {
  rect: ["[", "]"],
  diamond: ["{", "}"],
  round: ["(", ")"],
};

export function parseFlowchart(source: string): FlowchartModel | null {
  // Nodes and edges can share a line (e.g. `A["Start"] -->|Yes| B{Decision}`),
  // so run global passes over the body instead of parsing line-by-line.
  const body = source
    .split(/\r?\n/)
    .filter((l) => !/^\s*(flowchart|graph)\s+\w*\s*$/.test(l))
    .join("\n");

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();

  const nodeRe = /([A-Za-z0-9_]+)\s*(\[[^\]]*\]|\{[^}]*\}|\([^)]*\))/g;
  let m: RegExpExecArray | null;
  while ((m = nodeRe.exec(body))) {
    const raw = m[2];
    const inner = raw.slice(1, -1).replace(/^"|"$/g, "");
    const shape: FlowShape = raw.startsWith("{") ? "diamond" : raw.startsWith("(") ? "round" : "rect";
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      nodes.push({ id: m[1], label: inner, shape });
    }
  }

  // Allow an inline node declaration before the arrow: `A["Start"] -->|Yes| B`.
  const edgeRe = /([A-Za-z0-9_]+)(?:\s*(\[[^\]]*\]|\{[^}]*\}|\([^)]*\)))?\s*-->\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)/g;
  while ((m = edgeRe.exec(body))) {
    edges.push({ from: m[1], to: m[4], label: (m[3] ?? "").trim() });
  }

  if (nodes.length === 0) return null;
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^\s*(classDef|style|linkStyle|subgraph|end)\b/.test(t)) continue;
    if (!/^\s*[A-Za-z0-9_]+\s*(-->|\[[^\]]*\]|\{[^}]*\}|\([^)]*\))/.test(t)) return null;
  }
  return { nodes, edges };
}

export function buildFlowchart(model: FlowchartModel): string {
  const { nodes, edges } = model;
  if (nodes.length === 0) return "flowchart TD\n";
  const out = ["flowchart TD"];
  for (const n of nodes) {
    const [open, close] = SHAPE_WRAP[n.shape];
    out.push(`  ${n.id}${open}"${n.label || n.id}"${close}`);
  }
  for (const e of edges) {
    const label = e.label ? `|${e.label}|` : "";
    out.push(`  ${e.from} -->${label} ${e.to}`);
  }
  return out.join("\n");
}

export function upsertNode(model: FlowchartModel, node: FlowNode): FlowchartModel {
  const exists = model.nodes.some((n) => n.id === node.id);
  return {
    nodes: exists ? model.nodes.map((n) => (n.id === node.id ? node : n)) : [...model.nodes, node],
    edges: model.edges,
  };
}

export function removeNode(model: FlowchartModel, id: string): FlowchartModel {
  return {
    nodes: model.nodes.filter((n) => n.id !== id),
    edges: model.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

export function upsertEdge(model: FlowchartModel, edge: FlowEdge): FlowchartModel {
  const exists = model.edges.some((e) => e.from === edge.from && e.to === edge.to);
  return {
    nodes: model.nodes,
    edges: exists
      ? model.edges.map((e) => (e.from === edge.from && e.to === edge.to ? edge : e))
      : [...model.edges, edge],
  };
}

export function removeEdge(model: FlowchartModel, from: string, to: string): FlowchartModel {
  return {
    nodes: model.nodes,
    edges: model.edges.filter((e) => !(e.from === from && e.to === to)),
  };
}
