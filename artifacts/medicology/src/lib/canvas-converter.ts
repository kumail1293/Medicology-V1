// ============================================================================
// Canvas converter — bidirectional conversion between structured NoteBlocks
// and CanvasDesign elements.  This enables seamless editing across the
// block editor and canvas editor: content created in one is editable in the
// other without data loss.
//
//   blocks → canvas : positions elements vertically, preserving hierarchy
//   canvas → blocks : extracts text / math / image / list content back to
//                     structured blocks, ignoring pure-shape / arrow elements
// ============================================================================

import type { NoteBlock } from "./note-blocks";
import type { CanvasDesign, CanvasElement, CanvasElementStyle } from "./canvas-design";
import { createCanvasDesign } from "./canvas-design";

// ── helpers ────────────────────────────────────────────────────────────────

let _uid = 0;
function uid(): string {
  _uid += 1;
  return `bc${_uid.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function headingStyle(level: number): CanvasElementStyle {
  const sizes: Record<number, { size: number; weight: number }> = {
    1: { size: 52, weight: 800 },
    2: { size: 40, weight: 700 },
    3: { size: 32, weight: 700 },
    4: { size: 28, weight: 600 },
    5: { size: 24, weight: 600 },
    6: { size: 22, weight: 600 },
  };
  const { size, weight } = sizes[level] ?? sizes[2];
  return { fontFamily: "Outfit", fontSize: size, fontWeight: weight, color: "#0f172a", textAlign: "left", lineHeight: 1.25 };
}

function textStyle(): CanvasElementStyle {
  return { fontFamily: "DM Sans", fontSize: 26, fontWeight: 400, color: "#1e293b", textAlign: "left", lineHeight: 1.6 };
}

function makeEl(type: string, x: number, y: number, w: number, h: number, content: string, style: CanvasElementStyle): CanvasElement {
  return { id: uid(), type: type as any, x, y, w, h, rotation: 0, z: 1, opacity: 1, style, content };
}

// ── blocks → canvas ────────────────────────────────────────────────────────

const CANVAS_W = 1080;
const PAD = 60;
const GAP = 16;

export function blocksToCanvas(blocks: NoteBlock[], design?: CanvasDesign): CanvasDesign {
  const base = design ?? createCanvasDesign(CANVAS_W, 1000);
  const contentWidth = CANVAS_W - PAD * 2;
  const elements: CanvasElement[] = [];
  let y = 40;

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const h = (block.level ?? 2) <= 2 ? 100 : 60;
        elements.push(makeEl("heading", PAD, y, contentWidth, h, block.text ?? "", headingStyle(block.level ?? 2)));
        y += h + GAP;
        break;
      }
      case "paragraph": {
        const text = block.text ?? "";
        const lines = text.split("\n").length;
        const h = Math.max(60, lines * 38 + 20);
        elements.push(makeEl("text", PAD, y, contentWidth, h, text, textStyle()));
        y += h + GAP;
        break;
      }
      case "callout": {
        const toneBg: Record<string, string> = { tip: "#ecfdf5", mnemonic: "#ede9fe", trap: "#fef2f2", highYield: "#fffbeb", pearl: "#eff6ff", warning: "#fef2f2", note: "#f8fafc" };
        const toneBorder: Record<string, string> = { tip: "#bbf7d0", mnemonic: "#c4b5fd", trap: "#fecaca", highYield: "#fde68a", pearl: "#bfdbfe", warning: "#fecaca", note: "#e2e8f0" };
        const toneFg: Record<string, string> = { tip: "#166534", mnemonic: "#5b21b6", trap: "#991b1b", highYield: "#92400e", pearl: "#1e40af", warning: "#991b1b", note: "#475569" };
        const tone = block.tone ?? "note";
        const emoji = tone === "tip" ? "💡" : tone === "mnemonic" ? "🧠" : tone === "trap" ? "⚠️" : tone === "highYield" ? "📌" : tone === "pearl" ? "🩺" : tone === "warning" ? "🔴" : "💬";
        const label = tone === "tip" ? "Tip" : tone === "mnemonic" ? "Mnemonic" : tone === "trap" ? "Trap" : tone === "highYield" ? "High-Yield" : tone === "pearl" ? "Pearl" : tone === "warning" ? "Warning" : "Note";
        const fullText = `${emoji} ${label}: ${block.text ?? ""}`;
        const lines = fullText.split("\n").length;
        const h = Math.max(60, lines * 36 + 28);
        elements.push({
          ...makeEl("text", PAD, y, contentWidth, h, fullText, { ...textStyle(), fontSize: 22, fontWeight: 500, color: toneFg[tone] ?? "#475569" }),
          style: { ...textStyle(), fontSize: 22, fontWeight: 500, color: toneFg[tone] ?? "#475569", background: toneBg[tone] ?? "#f8fafc", borderColor: toneBorder[tone] ?? "#e2e8f0", borderWidth: 1, radius: 12, padding: 16 },
        });
        y += h + GAP;
        break;
      }
      case "table": {
        const md = block.markdown ?? "";
        const rows = md.split("\n").filter((r) => r.trim());
        const h = Math.max(60, rows.length * 36 + 20);
        elements.push(makeEl("text", PAD, y, contentWidth, h, md, { ...textStyle(), fontSize: 20, fontFamily: "JetBrains Mono" }));
        y += h + GAP;
        break;
      }
      case "mermaid": {
        const firstLine = (block.code ?? "").split("\n")[0];
        elements.push(makeEl("text", PAD, y, contentWidth, 120, `📊 [Flowchart: ${firstLine}]`, { ...textStyle(), fontSize: 20, color: "#64748b" }));
        y += 136;
        break;
      }
      case "math": {
        elements.push(makeEl("math", PAD, y, contentWidth, 80, block.text ?? "", { fontFamily: "KaTeX_Main", fontSize: 32, color: "#0f172a", textAlign: "center", lineHeight: 1.4 }));
        y += 96;
        break;
      }
      case "list": {
        const items = block.items ?? [];
        const h = Math.max(60, items.length * 34 + 20);
        const listEl = makeEl("list", PAD, y, contentWidth, h, "", { ...textStyle(), fontSize: 24 });
        listEl.items = items.map((it) => it.replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        elements.push(listEl);
        y += h + GAP;
        break;
      }
      case "checklist": {
        const items = block.items ?? [];
        const h = Math.max(60, items.length * 34 + 20);
        const clEl = makeEl("list", PAD, y, contentWidth, h, "", { ...textStyle(), fontSize: 24 });
        clEl.items = items.map((it) => {
          const checked = /^\s*[-*+]\s+\[[xX]\]/.test(it);
          const clean = it.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "");
          return `${checked ? "✅" : "⬜"} ${clean}`;
        });
        elements.push(clEl);
        y += h + GAP;
        break;
      }
      case "image": {
        if (block.src) {
          elements.push({ ...makeEl("image", PAD, y, contentWidth, 300, "", textStyle()), src: block.src, alt: block.alt ?? "" });
          y += 316;
        }
        break;
      }
      case "divider": {
        elements.push(makeEl("shape", PAD, y + 10, contentWidth, 2, "", { ...textStyle(), background: "#e2e8f0" }));
        y += 24;
        break;
      }
      case "code": {
        const lines = (block.code ?? "").split("\n").length;
        const h = Math.max(60, lines * 24 + 32);
        elements.push(makeEl("text", PAD, y, contentWidth, h, block.code ?? "", { fontFamily: "JetBrains Mono", fontSize: 18, color: "#e2e8f0", background: "#1e293b", radius: 12, padding: 16, lineHeight: 1.5 }));
        y += h + GAP;
        break;
      }
      case "canvas":
        break;
    }
  }

  return { ...base, elements, height: Math.max(base.height, y + 40) };
}

// ── canvas → blocks ────────────────────────────────────────────────────────

export function canvasToBlocks(design: CanvasDesign): NoteBlock[] {
  const sorted = [...design.elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const blocks: NoteBlock[] = [];

  for (const element of sorted) {
    switch (element.type) {
      case "heading":
        blocks.push({ id: `b2c_${element.id}`, type: "heading", level: (element.style.fontSize ?? 40) >= 44 ? 1 : 2, text: element.content });
        break;
      case "text": {
        const text = element.content.trim();
        if (!text) break;
        const calloutMatch = /^(💡\s*Tip|🧠\s*Mnemonic|⚠️\s*Trap|📌\s*High-Yield|🩺\s*Pearl|🔴\s*Warning|💬\s*Note)[:\s]+(.+)/s.exec(text);
        if (calloutMatch) {
          const toneMap: Record<string, string> = { "💡": "tip", "🧠": "mnemonic", "⚠️": "trap", "📌": "highYield", "🩺": "pearl", "🔴": "warning", "💬": "note" };
          const emoji = calloutMatch[1].charAt(0);
          blocks.push({ id: `b2c_${element.id}`, type: "callout", tone: (toneMap[emoji] ?? "note") as any, text: calloutMatch[2].trim() });
        } else {
          blocks.push({ id: `b2c_${element.id}`, type: "paragraph", text });
        }
        break;
      }
      case "math":
        blocks.push({ id: `b2c_${element.id}`, type: "math", display: true, text: element.content });
        break;
      case "image":
        if (element.src) blocks.push({ id: `b2c_${element.id}`, type: "image", src: element.src, alt: element.alt ?? "" });
        break;
      case "list":
        if (element.items?.length) {
          const isChecklist = element.items.some((it) => /^[✅⬜]/.test(it));
          if (isChecklist) {
            blocks.push({ id: `b2c_${element.id}`, type: "checklist", items: element.items.map((it) => `- [${it.startsWith("✅") ? "x" : " "}] ${it.replace(/^[✅⬜]\s*/, "")}`) });
          } else {
            blocks.push({ id: `b2c_${element.id}`, type: "list", items: element.items.map((it) => `- ${it}`) });
          }
        }
        break;
      default:
        break;
    }
  }

  return blocks.length > 0 ? blocks : [{ id: "b2c_empty", type: "paragraph", text: "" }];
}
