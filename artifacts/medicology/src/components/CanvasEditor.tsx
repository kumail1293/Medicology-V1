import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { toPng } from "html-to-image";
import katex from "katex";
import MediaPicker from "./MediaPicker";
import {
  createCanvasDesign,
  createElement,
  updateElement,
  resizeElement,
  bringForward,
  sendBackward,
  removeElement,
  duplicateElement,
  sortedElements,
  resizeCanvas,
  serializeDesign,
  groupElements,
  ungroupElements,
  alignElements,
  CANVAS_PRESETS,
  CANVAS_TEMPLATES,
  type CanvasDesign,
  type CanvasElement,
  type CanvasElementType,
  type CanvasShapeKind,
  type CanvasBranding,
} from "@/lib/canvas-design";
import { useToast } from "@/hooks/use-toast";
import {
  MousePointer2, Type, Heading1, ImagePlus, Shapes, MoveRight, Sigma, List,
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Download, Trash2, Copy, Layers,
  ChevronUp, ChevronDown, X, GripVertical, Grid3X3, AlignLeft, AlignCenter,
  AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Group, Ungroup, Stamp, SunMedium, Droplets,
} from "lucide-react";

const FONTS = ["DM Sans", "Outfit", "Georgia", "Trebuchet MS", "JetBrains Mono"];
const SHAPES: { kind: CanvasShapeKind; label: string }[] = [
  { kind: "rect", label: "▢ Rect" },
  { kind: "round", label: "▢ Rounded" },
  { kind: "circle", label: "◯ Circle" },
  { kind: "diamond", label: "◇ Diamond" },
  { kind: "triangle", label: "△ Triangle" },
  { kind: "line", label: "─ Line" },
];
const SWATCHES = ["#0d9488", "#0f172a", "#ffffff", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f8fafc", "#94a3b8", "#1e293b"];

const inputCls = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary";
const smallBtn = "inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

const TOOLS: { tool: CanvasElementType | "select"; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { tool: "select", label: "Select", icon: MousePointer2 },
  { tool: "heading", label: "Heading", icon: Heading1 },
  { tool: "text", label: "Text", icon: Type },
  { tool: "image", label: "Image", icon: ImagePlus },
  { tool: "shape", label: "Shape", icon: Shapes },
  { tool: "arrow", label: "Connector", icon: MoveRight },
  { tool: "math", label: "Formula", icon: Sigma },
  { tool: "list", label: "List", icon: List },
];

interface DragState {
  mode: "move" | "resize" | "rotate" | "arrow";
  startX: number;
  startY: number;
  startEl: CanvasElement;
  handle?: string;
  end?: "start" | "end";
}

const HANDLES: Array<{ id: string; x: number; y: number; cursor: string }> = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

function parseSafe(json: string): CanvasDesign {
  try {
    const parsed = JSON.parse(json) as CanvasDesign;
    if (parsed && typeof parsed.width === "number" && typeof parsed.height === "number" && Array.isArray(parsed.elements)) {
      return { version: 1, width: parsed.width, height: parsed.height, background: parsed.background ?? { color: "#ffffff" }, elements: parsed.elements };
    }
  } catch { /* fall through */ }
  return createCanvasDesign();
}

function updateBackground(design: CanvasDesign, patch: Partial<CanvasDesign["background"]>): CanvasDesign {
  return { ...design, background: { ...design.background, ...patch } };
}

// ---------------------------------------------------------------------------
// Element surfaces (interactive, editor-only)
// ---------------------------------------------------------------------------

function ShapeBody({ el }: { el: CanvasElement }) {
  const s = el.style;
  const fill = s.background ?? "#0d9488";
  const stroke = s.borderColor ?? "transparent";
  const strokeW = s.borderWidth ?? 0;
  const radius = s.radius ?? 0;
  switch (el.shape ?? "rect") {
    case "rect":
      return <div style={{ width: "100%", height: "100%", background: fill, border: `${strokeW}px solid ${stroke}` }} />;
    case "round":
      return <div style={{ width: "100%", height: "100%", background: fill, borderRadius: radius, border: `${strokeW}px solid ${stroke}` }} />;
    case "circle":
      return <div style={{ width: "100%", height: "100%", background: fill, borderRadius: "50%", border: `${strokeW}px solid ${stroke}` }} />;
    case "diamond":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,4 96,50 50,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        </svg>
      );
    case "triangle":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,4 96,96 4,96" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        </svg>
      );
    case "line":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke={stroke || "#0f172a"} strokeWidth={Math.max(2, strokeW)} />
        </svg>
      );
    default:
      return null;
  }
}

function ArrowBody({ el }: { el: CanvasElement }) {
  const s = el.style;
  const stroke = s.borderColor ?? "#0f172a";
  const width = Math.max(2, s.borderWidth ?? 4);
  const id = `arrow-${el.id}`;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <marker id={id} markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L8,4 L0,8 Z" fill={stroke} />
          </marker>
        </defs>
        <line x1={el.x1 ?? 0} y1={el.y1 ?? 0} x2={el.x2 ?? el.w} y2={el.y2 ?? el.h} stroke={stroke} strokeWidth={width}
          markerEnd={el.arrowEnd ? `url(#${id})` : undefined} markerStart={el.arrowStart ? `url(#${id})` : undefined} />
      </svg>
      {el.arrowLabel && (
        <div style={{ position: "absolute", left: ((el.x1 ?? 0) + (el.x2 ?? el.w)) / 2, top: ((el.y1 ?? 0) + (el.y2 ?? el.h)) / 2 - 12, transform: "translate(-50%,-50%)", background: "rgba(255,255,255,0.85)", padding: "1px 6px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: s.color ?? "#0f172a", whiteSpace: "nowrap" }}>
          {el.arrowLabel}
        </div>
      )}
    </div>
  );
}

function MathBody({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch {
      return "";
    }
  }, [latex]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function CanvasSurfaceElement({ el, selected, showHandles, onPatch }: {
  el: CanvasElement;
  selected: boolean;
  showHandles: boolean;
  onPatch: (patch: Partial<CanvasElement>) => void;
}) {
  const s = el.style;
  const common: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "center",
    opacity: el.opacity,
    cursor: "move",
    touchAction: "none",
  };

  return (
    <div data-el-id={el.id} style={{ ...common, boxShadow: selected ? "0 0 0 2px var(--color-primary, #0d9488)" : undefined, zIndex: el.z }}>
      {el.type === "arrow" ? (
        <ArrowBody el={el} />
      ) : el.type === "image" ? (
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          {el.src
            ? <img src={el.src} alt={el.alt ?? ""} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: s.radius ?? 0, border: `${s.borderWidth ?? 0}px solid ${s.borderColor ?? "transparent"}` }} />
            : <div style={{ width: "100%", height: "100%", background: s.background ?? "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>Image</div>}
        </div>
      ) : el.type === "shape" ? (
        <ShapeBody el={el} />
      ) : el.type === "math" ? (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: s.fontSize ?? 36, color: s.color ?? "#0f172a" }}>
          <MathBody latex={el.content} />
        </div>
      ) : el.type === "list" ? (
        <ul style={{ margin: 0, paddingLeft: "1.1em", fontFamily: s.fontFamily, fontSize: s.fontSize ?? 26, fontWeight: s.fontWeight ?? 500, color: s.color ?? "#0f172a", lineHeight: s.lineHeight ?? 1.5, overflow: "hidden", height: "100%" }}>
          {(el.items ?? []).map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      ) : (
        <div style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", alignItems: el.type === "heading" ? "center" : "flex-start", justifyContent: s.textAlign === "center" ? "center" : s.textAlign === "right" ? "flex-end" : "flex-start" }}>
          <div style={{ width: "100%", fontFamily: s.fontFamily ?? "DM Sans", fontSize: s.fontSize ?? (el.type === "heading" ? 56 : 26), fontWeight: s.fontWeight ?? (el.type === "heading" ? 800 : 400), fontStyle: s.fontStyle ?? "normal", color: s.color ?? "#0f172a", textAlign: s.textAlign ?? (el.type === "heading" ? "center" : "left"), lineHeight: s.lineHeight ?? 1.25, letterSpacing: s.letterSpacing ?? 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {el.content}
          </div>
        </div>
      )}

      {selected && (
        <>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", border: "2px solid var(--color-primary, #0d9488)" }} />
          {showHandles && HANDLES.map((h) => (
            <div key={h.id} data-el-id={el.id} data-handle={h.id}
              style={{ position: "absolute", left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: 10, height: 10, transform: "translate(-50%,-50%)", background: "#fff", border: "2px solid var(--color-primary, #0d9488)", borderRadius: 2, cursor: h.cursor, zIndex: 10 }} />
          ))}
          <div data-el-id={el.id} data-handle="rotate"
            style={{ position: "absolute", left: "50%", top: -18, transform: "translateX(-50%)", width: 12, height: 12, background: "#fff", border: "2px solid var(--color-primary, #0d9488)", borderRadius: "50%", cursor: "grab", zIndex: 10 }} />
          {el.type === "arrow" && (
            <>
              <div data-el-id={el.id} data-handle="arrow-start" title="Drag endpoint"
                style={{ position: "absolute", left: (el.x1 ?? 0) - 6, top: (el.y1 ?? 0) - 6, width: 12, height: 12, background: "#fff", border: "2px solid var(--color-primary, #0d9488)", borderRadius: "50%", cursor: "move", zIndex: 10 }} />
              <div data-el-id={el.id} data-handle="arrow-end" title="Drag endpoint"
                style={{ position: "absolute", left: (el.x2 ?? el.w) - 6, top: (el.y2 ?? el.h) - 6, width: 12, height: 12, background: "#fff", border: "2px solid var(--color-primary, #0d9488)", borderRadius: "50%", cursor: "move", zIndex: 10 }} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

function SelectedProps({ el, design, patch, commit, styleField, colorField, onRemove, onDuplicate, onOpenMedia, toast }: {
  el: CanvasElement;
  design: CanvasDesign;
  patch: (p: Partial<CanvasElement>) => void;
  commit: (d: CanvasDesign) => void;
  styleField: (label: string, node: React.ReactNode) => React.ReactNode;
  colorField: (label: string, value: string | undefined, onChangeVal: (v: string) => void) => React.ReactNode;
  onRemove: () => void;
  onDuplicate: () => void;
  onOpenMedia: () => void;
  toast: (opts: { title?: React.ReactNode; description?: React.ReactNode; variant?: "default" | "destructive" | null }) => void;
}) {
  const s = el.style;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground capitalize">
          {el.type === "arrow" ? "Connector" : el.type === "math" ? "Formula" : el.type}
        </p>
        <button onClick={onDuplicate} title="Duplicate (Ctrl+D)" className={smallBtn}><Copy size={12} /></button>
        <button onClick={onRemove} title="Delete" className={smallBtn}><Trash2 size={12} /></button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {styleField("X", <input type="number" className={inputCls} value={Math.round(el.x)} onChange={(e) => patch({ x: Number(e.target.value) })} />)}
        {styleField("Y", <input type="number" className={inputCls} value={Math.round(el.y)} onChange={(e) => patch({ y: Number(e.target.value) })} />)}
        {styleField("W", <input type="number" className={inputCls} value={Math.round(el.w)} onChange={(e) => patch({ w: Number(e.target.value) })} />)}
        {styleField("H", <input type="number" className={inputCls} value={Math.round(el.h)} onChange={(e) => patch({ h: Number(e.target.value) })} />)}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {styleField("Rotation°", <input type="number" className={inputCls} value={Math.round(el.rotation)} onChange={(e) => patch({ rotation: Number(e.target.value) })} />)}
        {styleField("Opacity", <input type="number" min={0} max={1} step={0.05} className={inputCls} value={el.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} />)}
      </div>

      {(el.type === "heading" || el.type === "text") && (
        <>
          <div>
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Text</span>
            <textarea className={clsx(inputCls, "min-h-[64px] resize-y")} value={el.content} onChange={(e) => patch({ content: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {styleField("Font", (
              <select className={inputCls} value={s.fontFamily} onChange={(e) => patch({ style: { ...s, fontFamily: e.target.value } })}>
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            ))}
            {styleField("Size", <input type="number" className={inputCls} value={s.fontSize ?? 28} onChange={(e) => patch({ style: { ...s, fontSize: Number(e.target.value) } })} />)}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {styleField("Weight", (
              <select className={inputCls} value={s.fontWeight ?? 400} onChange={(e) => patch({ style: { ...s, fontWeight: Number(e.target.value) } })}>
                <option value={400}>Regular</option>
                <option value={500}>Medium</option>
                <option value={700}>Bold</option>
                <option value={800}>Extra bold</option>
              </select>
            ))}
            {styleField("Align", (
              <select className={inputCls} value={s.textAlign ?? "left"} onChange={(e) => patch({ style: { ...s, textAlign: e.target.value as "left" | "center" | "right" } })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {styleField("Line height", <input type="number" step={0.05} className={inputCls} value={s.lineHeight ?? 1.25} onChange={(e) => patch({ style: { ...s, lineHeight: Number(e.target.value) } })} />)}
            {styleField("Letter spacing", <input type="number" step={0.5} className={inputCls} value={s.letterSpacing ?? 0} onChange={(e) => patch({ style: { ...s, letterSpacing: Number(e.target.value) } })} />)}
          </div>
          {colorField("Text color", s.color ?? "#0f172a", (c) => patch({ style: { ...s, color: c } }))}
          <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <input type="checkbox" checked={s.fontStyle === "italic"} onChange={(e) => patch({ style: { ...s, fontStyle: e.target.checked ? "italic" : "normal" } })} className="h-3.5 w-3.5" />
            Italic
          </label>
        </>
      )}

      {el.type === "image" && (
        <>
          <div>
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source</span>
            <div className="flex gap-1.5">
              <input className={inputCls} value={el.src ?? ""} onChange={(e) => patch({ src: e.target.value })} placeholder="Image URL" />
              <button onClick={onOpenMedia} className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary">Library</button>
            </div>
          </div>
          {styleField("Alt text", <input className={inputCls} value={el.alt ?? ""} onChange={(e) => patch({ alt: e.target.value })} />)}
          {styleField("Corner radius", <input type="number" className={inputCls} value={s.radius ?? 0} onChange={(e) => patch({ style: { ...s, radius: Number(e.target.value) } })} />)}
        </>
      )}

      {el.type === "shape" && (
        <>
          {styleField("Shape", (
            <select className={inputCls} value={el.shape ?? "rect"} onChange={(e) => patch({ shape: e.target.value as CanvasShapeKind })}>
              {SHAPES.map((sh) => <option key={sh.kind} value={sh.kind}>{sh.label}</option>)}
            </select>
          ))}
          {colorField("Fill", s.background ?? "#0d9488", (c) => patch({ style: { ...s, background: c } }))}
          <div className="grid grid-cols-2 gap-1.5">
            {styleField("Border width", <input type="number" min={0} className={inputCls} value={s.borderWidth ?? 0} onChange={(e) => patch({ style: { ...s, borderWidth: Number(e.target.value) } })} />)}
            {styleField("Radius", <input type="number" min={0} className={inputCls} value={s.radius ?? 0} onChange={(e) => patch({ style: { ...s, radius: Number(e.target.value) } })} />)}
          </div>
          {colorField("Border", s.borderColor ?? "transparent", (c) => patch({ style: { ...s, borderColor: c } }))}
        </>
      )}

      {el.type === "arrow" && (
        <>
          <div>
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Label</span>
            <input className={inputCls} value={el.arrowLabel ?? ""} onChange={(e) => patch({ arrowLabel: e.target.value })} placeholder="e.g. Yes / No" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {styleField("Start x", <input type="number" className={inputCls} value={el.x1 ?? 0} onChange={(e) => patch({ x1: Number(e.target.value) })} />)}
            {styleField("Start y", <input type="number" className={inputCls} value={el.y1 ?? 0} onChange={(e) => patch({ y1: Number(e.target.value) })} />)}
            {styleField("End x", <input type="number" className={inputCls} value={el.x2 ?? el.w} onChange={(e) => patch({ x2: Number(e.target.value) })} />)}
            {styleField("End y", <input type="number" className={inputCls} value={el.y2 ?? el.h} onChange={(e) => patch({ y2: Number(e.target.value) })} />)}
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <input type="checkbox" checked={!!el.arrowStart} onChange={(e) => patch({ arrowStart: e.target.checked })} className="h-3.5 w-3.5" /> Start
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <input type="checkbox" checked={!!el.arrowEnd} onChange={(e) => patch({ arrowEnd: e.target.checked })} className="h-3.5 w-3.5" /> End
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {styleField("Stroke width", <input type="number" min={1} className={inputCls} value={s.borderWidth ?? 4} onChange={(e) => patch({ style: { ...s, borderWidth: Number(e.target.value) } })} />)}
            {colorField("Stroke", s.borderColor ?? "#0f172a", (c) => patch({ style: { ...s, borderColor: c } }))}
          </div>
        </>
      )}

      {el.type === "math" && (
        <>
          <div>
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">LaTeX</span>
            <textarea className={clsx(inputCls, "min-h-[64px] resize-y font-mono")} value={el.content} onChange={(e) => patch({ content: e.target.value })} placeholder={"Anion\\ gap = Na^+ - (Cl^- + HCO_3^-)"} />
          </div>
          {styleField("Size", <input type="number" className={inputCls} value={s.fontSize ?? 36} onChange={(e) => patch({ style: { ...s, fontSize: Number(e.target.value) } })} />)}
          {colorField("Color", s.color ?? "#0f172a", (c) => patch({ style: { ...s, color: c } }))}
        </>
      )}

      {el.type === "list" && (
        <div>
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Items (one per line)</span>
          <textarea className={clsx(inputCls, "min-h-[80px] resize-y")} value={(el.items ?? []).join("\n")} onChange={(e) => patch({ items: e.target.value.split("\n") })} />
        </div>
      )}

      {/* ── Shadow ── */}
      <details className="group">
        <summary className="mb-1 flex cursor-pointer items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          <SunMedium size={11} /> Shadow
        </summary>
        <div className="space-y-1.5">
          {styleField("Box shadow", (
            <select className={inputCls} value={s.shadow ?? "none"} onChange={(e) => patch({ style: { ...s, shadow: e.target.value } })}>
              <option value="none">None</option>
              <option value="0 1px 3px rgba(0,0,0,0.12)">Small</option>
              <option value="0 4px 12px rgba(0,0,0,0.15)">Medium</option>
              <option value="0 8px 30px rgba(0,0,0,0.2)">Large</option>
              <option value="0 12px 40px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.1)">Extra large</option>
              <option value="0 0 20px rgba(13,148,136,0.3)">Primary glow</option>
            </select>
          ))}
          {(el.type === "heading" || el.type === "text") && (
            styleField("Text shadow", (
              <select className={inputCls} value={s.textShadow ?? "none"} onChange={(e) => patch({ style: { ...s, textShadow: e.target.value } })}>
                <option value="none">None</option>
                <option value="1px 1px 2px rgba(0,0,0,0.15)">Subtle</option>
                <option value="2px 2px 4px rgba(0,0,0,0.2)">Medium</option>
                <option value="0 0 10px rgba(13,148,136,0.3)">Glow</option>
              </select>
            ))
          )}
        </div>
      </details>

      {/* ── Border style ── */}
      {(el.type === "shape" || el.type === "arrow" || el.type === "image") && (
        styleField("Border style", (
          <select className={inputCls} value={s.borderStyle ?? "solid"} onChange={(e) => patch({ style: { ...s, borderStyle: e.target.value as any } })}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        ))
      )}

      {/* ── Background gradient for shapes ── */}
      {el.type === "shape" && (
        <details className="group">
          <summary className="mb-1 flex cursor-pointer items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            <Droplets size={11} /> Gradient fill
          </summary>
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">From</span>
                <input type="color" className="h-7 w-full rounded border border-border" value={s.backgroundGradient?.from ?? s.background ?? "#0d9488"}
                  onChange={(e) => patch({ style: { ...s, backgroundGradient: { from: e.target.value, to: s.backgroundGradient?.to ?? s.background ?? "#0f766e", angle: s.backgroundGradient?.angle ?? 135 } } })} />
              </label>
              <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">To</span>
                <input type="color" className="h-7 w-full rounded border border-border" value={s.backgroundGradient?.to ?? s.background ?? "#0f766e"}
                  onChange={(e) => patch({ style: { ...s, backgroundGradient: { from: s.backgroundGradient?.from ?? s.background ?? "#0d9488", to: e.target.value, angle: s.backgroundGradient?.angle ?? 135 } } })} />
              </label>
            </div>
            {styleField("Angle°", <input type="number" min={0} max={360} className={inputCls} value={s.backgroundGradient?.angle ?? 135} onChange={(e) => patch({ style: { ...s, backgroundGradient: { ...(s.backgroundGradient ?? { from: "#0d9488", to: "#0f766e" }), angle: Number(e.target.value) } } })} />)}
            <button onClick={() => patch({ style: { ...s, backgroundGradient: undefined } })} className="w-full text-[11px] text-destructive hover:underline">Remove gradient</button>
          </div>
        </details>
      )}

      {/* ── Image filters ── */}
      {el.type === "image" && el.src && (
        <details className="group">
          <summary className="mb-1 flex cursor-pointer items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            <SunMedium size={11} /> Image filters
          </summary>
          <div className="space-y-1.5">
            {([
              ["brightness", "Brightness", 0, 2, 1, 0.05],
              ["contrast", "Contrast", 0, 2, 1, 0.05],
              ["saturate", "Saturation", 0, 2, 1, 0.05],
              ["blur", "Blur", 0, 20, 0, 1],
              ["grayscale", "Grayscale", 0, 1, 0, 0.05],
              ["sepia", "Sepia", 0, 1, 0, 0.05],
            ] as const).map(([key, label, min, max, def, step]) => (
              <label key={key} className="block">
                <span className="mb-0.5 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                  {label}
                  <span className="font-mono text-foreground">{(el.filters as any)?.[key] ?? def}</span>
                </span>
                <input type="range" min={min} max={max} step={step} value={(el.filters as any)?.[key] ?? def}
                  onChange={(e) => patch({ filters: { ...(el.filters ?? {}), [key]: Number(e.target.value) } })}
                  className="w-full accent-[var(--color-primary)]" />
              </label>
            ))}
            <button onClick={() => patch({ filters: undefined })} className="w-full text-[11px] text-destructive hover:underline">Reset filters</button>
          </div>
        </details>
      )}

      {/* ── Group / Ungroup ── */}
      {design.elements.filter((e) => e.groupId === el.groupId && el.groupId).length > 1 && (
        <div>
          <button onClick={() => { if (el.groupId) { commit(ungroupElements(design, el.groupId)); toast({ title: "Ungrouped" }); } }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
            <Ungroup size={12} /> Ungroup ({design.elements.filter((e) => e.groupId === el.groupId).length} items)
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function CanvasEditor({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const { toast } = useToast();
  const [design, setDesign] = useState<CanvasDesign>(() => parseSafe(value));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasElementType | "select">("select");
  const [zoom, setZoom] = useState(0.9);
  const [past, setPast] = useState<CanvasDesign[]>([]);
  const [future, setFuture] = useState<CanvasDesign[]>([]);
  const [layersOpen, setLayersOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasNodeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const designRef = useRef(design);
  designRef.current = design;

  const elements = useMemo(() => sortedElements(design), [design]);
  const selected = design.elements.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    onChange(serializeDesign(design));
  }, [design]);

  const commit = useCallback((next: CanvasDesign, recordHistory = true) => {
    if (recordHistory) {
      setPast((p) => [...p.slice(-60), designRef.current]);
      setFuture([]);
    }
    setDesign(next);
  }, []);

  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-60), designRef.current]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [designRef.current, ...f]);
      setDesign(prev);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, designRef.current]);
      setDesign(next);
      return f.slice(1);
    });
  }, []);

  const toDesignPoint = (clientX: number, clientY: number) => {
    const node = surfaceRef.current;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  };

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle;
    const elId = target.dataset.elId;

    if (handle) {
      e.preventDefault();
      e.stopPropagation();
      const el = designRef.current.elements.find((x) => x.id === elId);
      if (!el) return;
      if (handle === "rotate") {
        dragRef.current = { mode: "rotate", startX: e.clientX, startY: e.clientY, startEl: el };
      } else if (handle === "arrow-start" || handle === "arrow-end") {
        dragRef.current = { mode: "arrow", startX: e.clientX, startY: e.clientY, startEl: el, end: handle === "arrow-end" ? "end" : "start" };
      } else {
        dragRef.current = { mode: "resize", startX: e.clientX, startY: e.clientY, startEl: el, handle };
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (elId) {
      e.preventDefault();
      e.stopPropagation();
      const el = designRef.current.elements.find((x) => x.id === elId);
      if (!el) return;
      setSelectedId(elId);
      if (tool !== "select") setTool("select");
      dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, startEl: el };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Empty canvas — creation tool or deselect.
    const pt = toDesignPoint(e.clientX, e.clientY);
    if (tool !== "select") {
      const el = createElement(tool as CanvasElementType, designRef.current);
      const placed = {
        ...el,
        x: pt.x - el.w / 2,
        y: pt.y - el.h / 2,
        content: tool === "heading" ? "Your heading" : tool === "text" ? "Your text here" : el.content,
      };
      commit({ ...designRef.current, elements: [...designRef.current.elements, placed] });
      setSelectedId(placed.id);
      setTool("select");
    } else {
      setSelectedId(null);
    }
  };

  const onSurfacePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const id = d.startEl.id;

    if (d.mode === "move") {
      setDesign(updateElement(designRef.current, id, { x: d.startEl.x + dx / zoom, y: d.startEl.y + dy / zoom }));
    } else if (d.mode === "resize") {
      setDesign(resizeElement(designRef.current, id, d.handle as "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w", dx / zoom, dy / zoom));
    } else if (d.mode === "rotate") {
      const el = designRef.current.elements.find((x) => x.id === id);
      if (!el) return;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const p = toDesignPoint(e.clientX, e.clientY);
      const angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      setDesign(updateElement(designRef.current, id, { rotation: Math.round(angle) }));
    } else if (d.mode === "arrow") {
      const el = designRef.current.elements.find((x) => x.id === id);
      if (!el) return;
      const p = toDesignPoint(e.clientX, e.clientY);
      const local = { x: p.x - el.x, y: p.y - el.y };
      setDesign(updateElement(designRef.current, id, d.end === "end" ? { x2: local.x, y2: local.y } : { x1: local.x, y1: local.y }));
    }
  };

  const endDrag = () => {
    if (dragRef.current) pushHistory();
    dragRef.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); if (selectedId) commit(duplicateElement(designRef.current, selectedId)); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) commit(removeElement(designRef.current, selectedId));
        setSelectedId(null);
        return;
      }
      if (e.key === "Escape") { setSelectedId(null); setTool("select"); return; }
      if (!selectedId) return;
      const el = designRef.current.elements.find((x) => x.id === selectedId);
      if (!el) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        commit(updateElement(designRef.current, selectedId, { x: el.x + m[0], y: el.y + m[1] }), false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, undo, redo, commit]);

  const fitZoom = useCallback(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const z = Math.min((rect.width - 48) / design.width, (rect.height - 48) / design.height, 1.5);
    setZoom(Math.max(0.15, Math.min(3, z)));
  }, [design.width, design.height]);

  useEffect(() => { fitZoom(); }, [fitZoom]);

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom((z) => Math.max(0.15, Math.min(3, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  const exportPng = async () => {
    const node = canvasNodeRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, {
        width: design.width,
        height: design.height,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: design.background.color ?? "#ffffff",
      });
      const a = document.createElement("a");
      a.download = `medicology-canvas-${design.width}x${design.height}.png`;
      a.href = dataUrl;
      a.click();
      toast({ title: "Exported", description: `PNG saved — ${design.width}×${design.height}px (2× quality).` });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Could not export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const changePreset = (w: number, h: number) => {
    setSelectedId(null);
    commit(resizeCanvas(designRef.current, w, h));
  };

  const patchSelected = (patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    commit(updateElement(designRef.current, selectedId, patch));
  };

  const styleField = (label: string, node: React.ReactNode) => (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {node}
    </label>
  );

  const colorField = (label: string, value: string | undefined, onChangeVal: (v: string) => void) => (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value ?? "#0f172a"} onChange={(e) => onChangeVal(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border bg-background p-0.5" />
        <div className="flex flex-wrap gap-1">
          {SWATCHES.slice(0, 6).map((c) => (
            <button key={c} onClick={() => onChangeVal(c)} className={clsx("h-5 w-5 rounded-full border", value === c ? "border-primary ring-2 ring-primary/40" : "border-border")} style={{ background: c }} />
          ))}
        </div>
      </div>
    </label>
  );

  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-xl border border-border bg-muted/30">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.tool} title={t.label}
                onClick={() => setTool(t.tool === "select" ? "select" : t.tool)}
                className={clsx("rounded-md p-1.5 transition-colors", tool === t.tool ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon size={15} />
              </button>
            );
          })}
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <button onClick={undo} title="Undo (Ctrl+Z)" className={smallBtn}><Undo2 size={14} /></button>
        <button onClick={redo} title="Redo (Ctrl+Y)" className={smallBtn}><Redo2 size={14} /></button>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Alignment buttons — visible when 2+ elements selected via shift-click (future) or all when one selected */}
        {selectedId && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => commit(alignElements(designRef.current, [selectedId], "left", null))} title="Align left" className={smallBtn}><AlignLeft size={13} /></button>
            <button onClick={() => commit(alignElements(designRef.current, [selectedId], "center", null))} title="Align center" className={smallBtn}><AlignCenter size={13} /></button>
            <button onClick={() => commit(alignElements(designRef.current, [selectedId], "right", null))} title="Align right" className={smallBtn}><AlignRight size={13} /></button>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button onClick={() => commit(alignElements(designRef.current, [selectedId], null, "top"))} title="Align top" className={smallBtn}><AlignStartVertical size={13} /></button>
            <button onClick={() => commit(alignElements(designRef.current, [selectedId], null, "middle"))} title="Align middle" className={smallBtn}><AlignCenterVertical size={13} /></button>
            <button onClick={() => commit(alignElements(designRef.current, [selectedId], null, "bottom"))} title="Align bottom" className={smallBtn}><AlignEndVertical size={13} /></button>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button onClick={() => { const sameGroup = designRef.current.elements.filter((e) => e.groupId && e.groupId === designRef.current.elements.find((x) => x.id === selectedId)?.groupId); if (sameGroup.length > 1) { commit(ungroupElements(designRef.current, sameGroup[0].groupId!)); toast({ title: "Ungrouped" }); } else { const others = designRef.current.elements.filter((e) => e.id !== selectedId).slice(0, 4); if (others.length > 0) { commit(groupElements(designRef.current, [selectedId, ...others.map((e) => e.id)])); toast({ title: "Grouped" }); } } }} title="Group / ungroup" className={smallBtn}><Group size={13} /></button>
          </div>
        )}

        <select value={`${design.width}x${design.height}`}
          onChange={(e) => { const [w, h] = e.target.value.split("x").map(Number); changePreset(w, h); }}
          className={clsx(inputCls, "w-auto")} title="Canvas size">
          {CANVAS_PRESETS.map((p) => (
            <option key={p.id} value={`${p.w}x${p.h}`}>{p.label} · {p.w}×{p.h}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))} className={smallBtn}><ZoomOut size={14} /></button>
          <span className="w-12 text-center text-[11px] font-semibold text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.15))} className={smallBtn}><ZoomIn size={14} /></button>
          <button onClick={fitZoom} title="Fit" className={smallBtn}><Maximize2 size={14} /></button>
          <button onClick={() => setLayersOpen((s) => !s)} title="Layers" className={clsx(smallBtn, layersOpen && "text-primary border-primary/50")}><Layers size={14} /></button>
          <button onClick={() => void exportPng()} disabled={exporting} className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Download size={13} /> {exporting ? "Exporting…" : "Export PNG"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {layersOpen && (
          <div className="w-44 shrink-0 overflow-y-auto border-r border-border bg-card p-2">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <Layers size={11} /> Layers
            </p>
            <div className="space-y-1">
              {elements.length === 0 && <p className="text-[11px] text-muted-foreground">Nothing yet.</p>}
              {elements.map((el) => (
                <div key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={clsx("flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] cursor-pointer transition-colors",
                    selectedId === el.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                  <GripVertical size={11} className="opacity-50" />
                  <span className="flex-1 truncate font-medium capitalize">
                    {el.type === "arrow" ? "connector" : el.type === "math" ? "formula" : el.type}
                    {(el.type === "heading" || el.type === "text") && `: ${(el.content || "").slice(0, 14)}`}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); commit(bringForward(designRef.current, el.id)); }} title="Bring forward" className="text-muted-foreground hover:text-foreground"><ChevronUp size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); commit(sendBackward(designRef.current, el.id)); }} title="Send backward" className="text-muted-foreground hover:text-foreground"><ChevronDown size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={surfaceRef} className="min-w-0 flex-1 overflow-auto p-6" onWheel={onWheel}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div style={{ width: design.width * zoom, height: design.height * zoom, position: "relative", margin: "0 auto", flexShrink: 0 }}>
            <div
              ref={canvasNodeRef}
              className="shadow-2xl ring-1 ring-black/10"
              style={{
                width: design.width,
                height: design.height,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
                touchAction: "none",
                background:
                  design.background.gradientFrom && design.background.gradientTo
                    ? `linear-gradient(152deg, ${design.background.gradientFrom}, ${design.background.gradientTo})`
                    : design.background.image
                      ? `url(${design.background.image}) center / cover no-repeat`
                      : design.background.color ?? "#ffffff",
              }}
            >
              {elements.map((el) => (
                <CanvasSurfaceElement
                  key={el.id}
                  el={el}
                  selected={selectedId === el.id}
                  showHandles={selectedId === el.id && !exporting}
                  onPatch={(patch) => setDesign(updateElement(designRef.current, el.id, patch))}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="w-56 shrink-0 overflow-y-auto border-l border-border bg-card p-3">
          {!selected ? (
            <div className="space-y-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Canvas</p>
              {/* ── Templates ── */}
              <div>
                <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground"><Stamp size={11} className="mr-1 inline" /> Templates</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {CANVAS_TEMPLATES.map((tpl) => (
                    <button key={tpl.id} onClick={() => commit({ ...design, width: tpl.width, height: tpl.height, elements: tpl.elements.map((e) => ({ ...e, id: `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}` })), background: tpl.background ?? design.background })} className="rounded-lg border border-border bg-background p-2 text-left transition-all hover:border-primary/50 hover:shadow-sm">
                      <span className="block text-[10px] font-bold text-foreground">{tpl.name}</span>
                      <span className="block text-[9px] text-muted-foreground line-clamp-1">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Background ── */}
              {styleField("Background", (
                <div className="space-y-2">
                  {colorField("Color", design.background.color ?? "#ffffff", (c) => commit(updateBackground(designRef.current, { color: c })))}
                  <div className="grid grid-cols-2 gap-1.5">
                    <input className={inputCls} type="color" value={design.background.gradientFrom ?? "#0d9488"} onChange={(e) => commit(updateBackground(designRef.current, { gradientFrom: e.target.value, gradientTo: design.background.gradientTo ?? "#0f766e" }))} title="Gradient from" />
                    <input className={inputCls} type="color" value={design.background.gradientTo ?? "#0f766e"} onChange={(e) => commit(updateBackground(designRef.current, { gradientTo: e.target.value, gradientFrom: design.background.gradientFrom ?? "#0d9488" }))} title="Gradient to" />
                  </div>
                  <button onClick={() => { setMediaTarget("bg"); setMediaOpen(true); }} className="w-full rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary">
                    Background image…
                  </button>
                  <button onClick={() => commit(updateBackground(designRef.current, { image: undefined, gradientFrom: undefined, gradientTo: undefined, color: "#ffffff" }))} className="w-full rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:text-destructive">
                    Reset background
                  </button>
                </div>
              ))}

              {/* ── Pattern overlay ── */}
              <div>
                <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground"><Grid3X3 size={11} className="mr-1 inline" /> Pattern</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["none", "grid", "dots", "lines", "diagonal"] as const).map((p) => (
                    <button key={p} onClick={() => commit(updateBackground(designRef.current, { pattern: p === "none" ? undefined : p }))} className={clsx("rounded-md border px-2.5 py-1 text-[10px] font-medium capitalize", (design.background.pattern ?? "none") === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>{p}</button>
                  ))}
                </div>
              </div>

              {/* ── Branding ── */}
              <details className="group">
                <summary className="mb-1 flex cursor-pointer items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  <Stamp size={11} /> Branding
                </summary>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <input type="checkbox" checked={!!design.branding?.enabled} onChange={(e) => commit({ ...designRef.current, branding: { ...(designRef.current.branding ?? {}), enabled: e.target.checked } })} className="h-3.5 w-3.5" />
                    Show branding watermark
                  </label>
                  {design.branding?.enabled && (
                    <>
                      <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">Logo URL</span>
                        <input className={inputCls} value={design.branding?.logo ?? ""} onChange={(e) => commit({ ...designRef.current, branding: { ...designRef.current.branding!, logo: e.target.value } })} placeholder="https://…" />
                      </label>
                      <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">Name</span>
                        <input className={inputCls} value={design.branding?.name ?? ""} onChange={(e) => commit({ ...designRef.current, branding: { ...designRef.current.branding!, name: e.target.value } })} placeholder="Medicology" />
                      </label>
                      <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">Social handle</span>
                        <input className={inputCls} value={design.branding?.social ?? ""} onChange={(e) => commit({ ...designRef.current, branding: { ...designRef.current.branding!, social: e.target.value } })} placeholder="@medicologyworld" />
                      </label>
                      <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-muted-foreground">Position</span>
                        <select className={inputCls} value={design.branding?.position ?? "bottom-right"} onChange={(e) => commit({ ...designRef.current, branding: { ...designRef.current.branding!, position: e.target.value as any } })}>
                          <option value="top-left">Top left</option>
                          <option value="top-right">Top right</option>
                          <option value="bottom-left">Bottom left</option>
                          <option value="bottom-right">Bottom right</option>
                          <option value="bottom-center">Bottom center</option>
                        </select>
                      </label>
                      {styleField("Opacity", <input type="range" min={0} max={1} step={0.05} value={design.branding?.opacity ?? 0.7} onChange={(e) => commit({ ...designRef.current, branding: { ...designRef.current.branding!, opacity: Number(e.target.value) } })} className="w-full" />)}
                    </>
                  )}
                </div>
              </details>

              <div className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Pick a tool from the toolbar and click the canvas to place elements. Drag to move, use the handles to resize or rotate, and drag connector endpoints to draw arrows.
              </div>
            </div>
          ) : (
            <SelectedProps el={selected} design={design} patch={patchSelected} commit={commit} styleField={styleField} colorField={colorField}
              onRemove={() => { commit(removeElement(designRef.current, selected.id)); setSelectedId(null); }}
              onDuplicate={() => commit(duplicateElement(designRef.current, selected.id))}
              onOpenMedia={() => { setMediaTarget(selected.id); setMediaOpen(true); }}
              toast={toast}
            />
          )}
        </div>
      </div>

      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(m) => {
        if (mediaTarget === "bg") {
          commit(updateBackground(designRef.current, { image: m.url }));
        } else if (mediaTarget) {
          commit(updateElement(designRef.current, mediaTarget, { src: m.url, alt: m.altText || m.filename || "image" }));
        }
        setMediaOpen(false);
        setMediaTarget(null);
      }} />
    </div>
  );
}
