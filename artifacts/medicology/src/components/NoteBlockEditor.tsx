import React, { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import katex from "katex";
import MarkdownNote from "./MarkdownNote";
import MermaidDiagram from "./MermaidDiagram";
import MediaPicker from "./MediaPicker";
import {
  parseNoteBlocks,
  serializeNoteBlocks,
  updateBlock,
  addBlockAfter,
  removeBlock,
  duplicateBlock,
  moveBlock,
  isChecked,
  setChecked,
  parseFlowchart,
  buildFlowchart,
  upsertNode,
  removeNode,
  upsertEdge,
  removeEdge,
  CALLOUT_MARKERS,
  type NoteBlock,
  type NoteBlockType,
  type FlowShape,
} from "@/lib/note-blocks";
import { createCanvasDesign, serializeDesign } from "@/lib/canvas-design";
import type { CalloutTone } from "@/lib/note-utils";
import {
  GripVertical, ArrowUp, ArrowDown, Copy, Trash2, Plus, Type, Heading2,
  List, ListChecks, Quote, Table2, GitBranch, Sigma, ImagePlus, Minus,
  Code2, Eye, PenLine, Upload, X, LayoutTemplate,
} from "lucide-react";
import type { MediaItem } from "@/lib/media";
import CanvasRenderer from "./CanvasRenderer";
import { parseDesign } from "@/lib/canvas-design";

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────

const BLOCK_META: Record<NoteBlockType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; hint: string }> = {
  heading: { label: "Heading", icon: Heading2, hint: "Section title" },
  paragraph: { label: "Paragraph", icon: Type, hint: "Body text" },
  list: { label: "List", icon: List, hint: "Bullets or numbered" },
  checklist: { label: "Checklist", icon: ListChecks, hint: "Task list" },
  callout: { label: "Callout", icon: Quote, hint: "Tip / mnemonic / trap" },
  table: { label: "Table", icon: Table2, hint: "GFM table" },
  mermaid: { label: "Diagram", icon: GitBranch, hint: "Flowchart / connectors" },
  math: { label: "Math", icon: Sigma, hint: "LaTeX formula" },
  image: { label: "Image", icon: ImagePlus, hint: "Media library or URL" },
  divider: { label: "Divider", icon: Minus, hint: "Horizontal rule" },
  code: { label: "Code", icon: Code2, hint: "Code block" },
  canvas: { label: "Canvas", icon: LayoutTemplate, hint: "Free-form design" },
};

const ADD_ORDER: NoteBlockType[] = ["heading", "paragraph", "list", "checklist", "callout", "table", "mermaid", "math", "image", "divider", "code", "canvas"];

const inputCls = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
const textareaCls = `${inputCls} resize-y font-mono text-xs leading-relaxed`;

function MathPreview({ latex, display }: { latex: string; display: boolean }) {
  const html = useMemo(() => {
    if (!latex.trim()) return "";
    try {
      return katex.renderToString(latex, { displayMode: display, throwOnError: false });
    } catch {
      return "";
    }
  }, [latex, display]);
  if (!html) return null;
  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/40 px-3 py-2" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid connector builder — nodes & edges model with live preview
// ─────────────────────────────────────────────────────────────────────────────

function FlowchartBuilder({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const [mode, setMode] = useState<"builder" | "source">("builder");
  const parsed = useMemo(() => parseFlowchart(code), [code]);
  const [nodeId, setNodeId] = useState("");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeShape, setNodeShape] = useState<FlowShape>("rect");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [edgeLabel, setEdgeLabel] = useState("");

  const model = parsed ?? { nodes: [], edges: [] };

  if (mode === "source") {
    return (
      <div className="space-y-2">
        <textarea className={textareaCls} rows={6} value={code} onChange={(e) => onChange(e.target.value)} placeholder="flowchart TD&#10;  A[Start] --> B{Decision}" />
        <MermaidDiagram code={code} />
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        This diagram uses syntax the connector builder can't edit visually.
        <button onClick={() => setMode("source")} className="ml-2 font-semibold text-primary hover:underline">Edit source instead</button>
      </div>
    );
  }

  const addNode = () => {
    const id = nodeId.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!id) return;
    const next = upsertNode(model, { id, label: nodeLabel.trim() || id, shape: nodeShape });
    onChange(buildFlowchart(next));
    setNodeId("");
    setNodeLabel("");
  };

  const addEdge = () => {
    if (!fromId || !toId) return;
    const next = upsertEdge(model, { from: fromId, to: toId, label: edgeLabel.trim() });
    onChange(buildFlowchart(next));
    setEdgeLabel("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Connectors</span>
        <button onClick={() => setMode("source")} className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <Code2 size={11} /> Source
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Nodes */}
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-2 text-[11px] font-bold text-muted-foreground">Nodes</p>
          <div className="space-y-1.5">
            {model.nodes.map((n) => (
              <div key={n.id} className="flex items-center gap-1.5 text-xs">
                <span className={clsx("rounded px-1.5 py-0.5 font-mono font-bold", n.shape === "diamond" ? "bg-amber-500/10 text-amber-600" : n.shape === "round" ? "bg-cyan-500/10 text-cyan-600" : "bg-primary/10 text-primary")}>
                  {n.shape === "diamond" ? "◇" : n.shape === "round" ? "◯" : "▢"} {n.id}
                </span>
                <span className="flex-1 truncate text-muted-foreground">{n.label}</span>
                <select
                  value={n.shape}
                  onChange={(e) => onChange(buildFlowchart(upsertNode(model, { ...n, shape: e.target.value as FlowShape })))}
                  className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                  title="Shape"
                >
                  <option value="rect">Rect</option>
                  <option value="diamond">Diamond</option>
                  <option value="round">Round</option>
                </select>
                <button onClick={() => onChange(buildFlowchart(removeNode(model, n.id)))} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
              </div>
            ))}
            {model.nodes.length === 0 && <p className="text-[11px] text-muted-foreground">No nodes yet.</p>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <input className={clsx(inputCls, "w-20")} value={nodeId} onChange={(e) => setNodeId(e.target.value)} placeholder="ID" />
            <input className={clsx(inputCls, "flex-1 min-w-[90px]")} value={nodeLabel} onChange={(e) => setNodeLabel(e.target.value)} placeholder="Label" />
            <select className={clsx(inputCls, "w-24")} value={nodeShape} onChange={(e) => setNodeShape(e.target.value as FlowShape)}>
              <option value="rect">▢ Rect</option>
              <option value="diamond">◇ Diamond</option>
              <option value="round">◯ Round</option>
            </select>
            <button onClick={addNode} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90">
              <Plus size={11} /> Add
            </button>
          </div>
        </div>

        {/* Edges */}
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-2 text-[11px] font-bold text-muted-foreground">Connections</p>
          <div className="space-y-1.5">
            {model.edges.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold">{e.from}</span>
                <span className="text-muted-foreground">──▶</span>
                {e.label && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{e.label}</span>}
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold">{e.to}</span>
                <button onClick={() => onChange(buildFlowchart(removeEdge(model, e.from, e.to)))} className="ml-auto text-muted-foreground hover:text-destructive"><X size={12} /></button>
              </div>
            ))}
            {model.edges.length === 0 && <p className="text-[11px] text-muted-foreground">No connections yet.</p>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select className={clsx(inputCls, "w-24")} value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">From…</option>
              {model.nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
            <select className={clsx(inputCls, "w-24")} value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">To…</option>
              {model.nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
            <input className={clsx(inputCls, "w-24")} value={edgeLabel} onChange={(e) => setEdgeLabel(e.target.value)} placeholder="Label (Yes/No)" />
            <button onClick={addEdge} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90">
              <Plus size={11} /> Connect
            </button>
          </div>
        </div>
      </div>

      <MermaidDiagram code={buildFlowchart(model)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-block inline editor
// ─────────────────────────────────────────────────────────────────────────────

function BlockEditor({ block, onChange, onOpenMedia }: {
  block: NoteBlock;
  onChange: (patch: Partial<NoteBlock>) => void;
  onOpenMedia: () => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 rounded-lg border border-border p-0.5">
            {[1, 2, 3].map((l) => (
              <button key={l} onClick={() => onChange({ level: l })}
                className={clsx("rounded-md px-2 py-1 text-[11px] font-bold", block.level === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                H{l}
              </button>
            ))}
          </div>
          <input className={inputCls} value={block.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Section heading…" />
        </div>
      );
    case "paragraph":
      return <textarea className={textareaCls} rows={3} value={block.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Write your paragraph… (markdown supported: **bold**, links, inline $math$)" />;
    case "list": {
      const items = block.items ?? [];
      const setItems = (next: string[]) => onChange({ items: next });
      return (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <input type="checkbox" checked={!!block.ordered} onChange={(e) => onChange({ ordered: e.target.checked })} className="h-3.5 w-3.5" />
            Numbered list
          </label>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-4 text-right font-mono text-xs text-muted-foreground">{block.ordered ? i + 1 : "•"}</span>
              <input className={inputCls} value={it.replace(/^\s*([-*+]|\d+\.)\s+/, "")} onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                setItems(next);
              }} />
              <button onClick={() => setItems(items.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
            </div>
          ))}
          <button onClick={() => setItems([...items, ""])} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            <Plus size={11} /> Add item
          </button>
        </div>
      );
    }
    case "checklist": {
      const items = block.items ?? [];
      const setItems = (next: string[]) => onChange({ items: next });
      return (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" checked={isChecked(it)} onChange={(e) => {
                const next = [...items];
                next[i] = setChecked(it, e.target.checked);
                setItems(next);
              }} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
              <input className={inputCls} value={it.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "")} onChange={(e) => {
                const next = [...items];
                next[i] = setChecked(it, next[i] !== it).replace(/\]\s*$/, `] ${e.target.value}`);
                setItems(next);
              }} />
              <button onClick={() => setItems(items.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
            </div>
          ))}
          <button onClick={() => setItems([...items, "- [ ] "])} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            <Plus size={11} /> Add task
          </button>
        </div>
      );
    }
    case "callout":
      return (
        <div className="space-y-1.5">
          <select className={inputCls} value={block.tone ?? "note"} onChange={(e) => onChange({ tone: e.target.value as CalloutTone })}>
            {Object.entries(CALLOUT_MARKERS).map(([tone, m]) => (
              <option key={tone} value={tone}>{m.emoji} {m.label}</option>
            ))}
          </select>
          <textarea className={textareaCls} rows={3} value={block.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Callout content…" />
        </div>
      );
    case "table":
      return <textarea className={textareaCls} rows={5} value={block.markdown ?? ""} onChange={(e) => onChange({ markdown: e.target.value })} placeholder={"| Feature | A | B |\n|---|---|---|\n| Item |  |  |"} />;
    case "mermaid":
      return <FlowchartBuilder code={block.code ?? ""} onChange={(code) => onChange({ code })} />;
    case "math":
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <input type="checkbox" checked={!!block.display} onChange={(e) => onChange({ display: e.target.checked })} className="h-3.5 w-3.5" />
              Display ($$…$$)
            </label>
          </div>
          <textarea className={textareaCls} rows={2} value={block.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder={"Anion\\ gap = Na^+ - (Cl^- + HCO_3^-)"} />
          <MathPreview latex={block.text ?? ""} display={!!block.display} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input className={inputCls} value={block.src ?? ""} onChange={(e) => onChange({ src: e.target.value })} placeholder="Image URL" />
            <button onClick={onOpenMedia} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary">
              <Upload size={11} /> Library
            </button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <input className={inputCls} value={block.alt ?? ""} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Alt text" />
            <input className={inputCls} value={block.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Caption (optional)" />
          </div>
          {block.src && (
            <img src={block.src} alt={block.alt ?? ""} className="max-h-40 rounded-lg border border-border object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
      );
    case "divider":
      return <p className="text-center text-xs text-muted-foreground">— horizontal divider —</p>;
    case "code":
      return (
        <div className="space-y-1.5">
          <input className={clsx(inputCls, "w-28")} value={block.lang ?? ""} onChange={(e) => onChange({ lang: e.target.value })} placeholder="lang (js)" />
          <textarea className={textareaCls} rows={4} value={block.code ?? ""} onChange={(e) => onChange({ code: e.target.value })} placeholder="// code" />
        </div>
      );
    case "canvas": {
      const design = block.design ? parseDesign(block.design) : null;
      if (!design) {
        return (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <span>Empty canvas design.</span>
            <span className="font-semibold text-primary">Edit in the Canvas tab</span>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold">Free-form canvas design</p>
            <p className="text-[11px] text-muted-foreground">
              {design.elements.length} element{design.elements.length !== 1 ? "s" : ""} · {design.width}×{design.height}px — open the <span className="font-semibold text-primary">Canvas</span> tab to edit visually.
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-border bg-background p-1">
            <CanvasRenderer design={design} scale={0.12} />
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

export default function NoteBlockEditor({ value, onChange }: { value: string; onChange: (markdown: string) => void }) {
  const [blocks, setBlocks] = useState<NoteBlock[]>(() => parseNoteBlocks(value));
  const [mode, setMode] = useState<"blocks" | "source">("blocks");
  const [showPalette, setShowPalette] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const lastValue = useRef(value);

  // Re-parse only when the value changed externally (e.g. switching notes).
  useEffect(() => {
    if (value !== lastValue.current) {
      const serialized = serializeNoteBlocks(blocks);
      if (value !== serialized) {
        setBlocks(parseNoteBlocks(value));
      }
      lastValue.current = value;
    }
  }, [value]);

  const commit = (next: NoteBlock[]) => {
    setBlocks(next);
    lastValue.current = serializeNoteBlocks(next);
    onChange(lastValue.current);
  };

  const patch = (id: string, p: Partial<NoteBlock>) => commit(updateBlock(blocks, id, p));

  const addBlock = (type: NoteBlockType) => {
    const blank: Omit<NoteBlock, "id"> = {
      type,
      level: 2,
      text: "",
      ordered: false,
      items: [],
      tone: "tip",
      display: false,
      markdown: "",
      code: "",
      lang: "",
      src: "",
      alt: "",
      caption: "",
    };
    if (type === "table") blank.markdown = "| Column A | Column B |\n|---|---|\n|  |  |";
    if (type === "callout") blank.text = "";
    if (type === "mermaid") blank.code = "flowchart TD\n  A[Start] --> B[End]";
    if (type === "checklist") blank.items = ["- [ ] First task"];
    if (type === "list") blank.items = ["Item one"];
    if (type === "math") blank.text = "x^2 + y^2 = z^2";
    if (type === "canvas") blank.design = serializeDesign(createCanvasDesign());
    commit(addBlockAfter(blocks, blocks.length ? blocks[blocks.length - 1].id : null, blank));
    setShowPalette(false);
  };

  const onPickMedia = (media: MediaItem) => {
    if (mediaTarget) {
      patch(mediaTarget, { src: media.url, alt: media.altText || media.filename || "image" });
    }
    setMediaOpen(false);
    setMediaTarget(null);
  };

  const onDrop = (to: number) => {
    if (dragIndex === null || dragIndex === to) return;
    const next = [...blocks];
    const [b] = next.splice(dragIndex, 1);
    next.splice(to, 0, b);
    setDragIndex(null);
    commit(next);
  };

  const markdown = useMemo(() => serializeNoteBlocks(blocks), [blocks]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          <button onClick={() => setMode("blocks")}
            className={clsx("flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold", mode === "blocks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <PenLine size={12} /> Blocks
          </button>
          <button onClick={() => setMode("source")}
            className={clsx("flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold", mode === "source" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Code2 size={12} /> Source
          </button>
        </div>
        <button
          onClick={() => setShowPalette((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={13} /> Add block
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Eye size={12} /> {blocks.length} block{blocks.length !== 1 ? "s" : ""} · drag to reorder
        </span>
      </div>

      {/* Palette */}
      {showPalette && (
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-card p-2 sm:grid-cols-3 lg:grid-cols-6">
          {ADD_ORDER.map((type) => {
            const meta = BLOCK_META[type];
            const Icon = meta.icon;
            return (
              <button key={type} onClick={() => addBlock(type)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left transition-all hover:border-primary/50 hover:shadow-sm">
                <Icon size={15} className="shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{meta.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{meta.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Source mode */}
      {mode === "source" ? (
        <textarea
          className={clsx(textareaCls, "min-h-[260px]")}
          value={value}
          onChange={(e) => { lastValue.current = e.target.value; onChange(e.target.value); }}
          placeholder="# Heading&#10;&#10;Write markdown directly…"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Canvas */}
          <div className="space-y-2">
            {blocks.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No blocks yet — add a heading, paragraph, diagram or table to get started.
              </div>
            )}
            {blocks.map((block, i) => {
              const meta = BLOCK_META[block.type];
              const Icon = meta.icon;
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={() => onDrop(i)}
                  className={clsx(
                    "group rounded-xl border bg-card transition-all",
                    dragIndex === i ? "border-primary opacity-60" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
                    <GripVertical size={13} className="cursor-grab text-muted-foreground/60 active:cursor-grabbing" />
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      <Icon size={11} className="text-primary" /> {meta.label}
                    </span>
                    <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => commit(moveBlock(blocks, block.id, -1))} title="Move up" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowUp size={12} /></button>
                      <button onClick={() => commit(moveBlock(blocks, block.id, 1))} title="Move down" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowDown size={12} /></button>
                      <button onClick={() => commit(duplicateBlock(blocks, block.id))} title="Duplicate" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy size={12} /></button>
                      <button onClick={() => commit(removeBlock(blocks, block.id))} title="Delete" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={12} /></button>
                    </span>
                  </div>
                  <div className="p-2.5">
                    <BlockEditor
                      block={block}
                      onChange={(p) => patch(block.id, p)}
                      onOpenMedia={() => { setMediaTarget(block.id); setMediaOpen(true); }}
                    />
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setShowPalette(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus size={14} /> Add block
            </button>
          </div>

          {/* Live preview */}
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <Eye size={11} className="text-primary" /> Live preview — exactly what students see
            </p>
            <div className="max-h-[560px] overflow-y-auto rounded-xl border border-border bg-background p-4">
              {markdown.trim() ? <MarkdownNote content={markdown} /> : <p className="py-8 text-center text-xs text-muted-foreground">Preview will appear here.</p>}
            </div>
          </div>
        </div>
      )}

      <MediaPicker open={mediaOpen} onClose={() => { setMediaOpen(false); setMediaTarget(null); }} onSelect={onPickMedia} />
    </div>
  );
}
