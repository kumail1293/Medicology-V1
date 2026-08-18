// ============================================================================
// Canvas design model — the data behind the Canva-style note canvas editor.
//
// A design is a fixed-size canvas (pixel dimensions) holding absolutely
// positioned elements: text boxes, headings, images, shapes, arrows
// (connectors with draggable endpoints), math (LaTeX) and lists. The design
// is stored inside a note as a ```canvas fenced block and rendered at scale
// by CanvasRenderer in the student reader.
// ============================================================================

export type CanvasElementType =
  | "text"
  | "heading"
  | "image"
  | "shape"
  | "arrow"
  | "math"
  | "list";

export type CanvasShapeKind = "rect" | "round" | "circle" | "diamond" | "triangle" | "line";

export interface CanvasElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  /** shape / text-box background */
  background?: string;
  /** shape / text-box border */
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  opacity?: number;
}

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  opacity: number;
  style: CanvasElementStyle;
  /** text / heading / list content; latex for math */
  content: string;
  /** image */
  src?: string;
  alt?: string;
  /** shape */
  shape?: CanvasShapeKind;
  /** arrow geometry (canvas-relative) + arrowheads */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  arrowLabel?: string;
  /** list items (when type === "list") */
  items?: string[];
}

export interface CanvasBackground {
  color?: string;
  /** gradient — from → to, diagonal */
  gradientFrom?: string;
  gradientTo?: string;
  image?: string;
}

export interface CanvasDesign {
  version: 1;
  width: number;
  height: number;
  background: CanvasBackground;
  elements: CanvasElement[];
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

let _id = 0;
export function newElementId(): string {
  _id += 1;
  return `c${_id.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createCanvasDesign(width = 1080, height = 1350): CanvasDesign {
  return {
    version: 1,
    width,
    height,
    background: { color: "#ffffff" },
    elements: [],
  };
}

function baseStyle(): CanvasElementStyle {
  return {
    fontFamily: "DM Sans",
    fontSize: 28,
    fontWeight: 400,
    color: "#0f172a",
    textAlign: "left",
    lineHeight: 1.4,
  };
}

export function createElement(type: CanvasElementType, design: CanvasDesign): CanvasElement {
  const centerX = design.width / 2;
  const centerY = design.height / 2;
  const base: CanvasElement = {
    id: newElementId(),
    type,
    x: centerX - 200,
    y: centerY - 60,
    w: 400,
    h: 120,
    rotation: 0,
    z: design.elements.length + 1,
    opacity: 1,
    style: baseStyle(),
    content: "",
  };
  switch (type) {
    case "heading":
      base.content = "Add a heading";
      base.style.fontSize = 56;
      base.style.fontWeight = 800;
      base.style.fontFamily = "Outfit";
      base.style.textAlign = "center";
      base.h = 140;
      break;
    case "text":
      base.content = "Double-click to edit text";
      base.h = 90;
      break;
    case "image":
      base.src = "";
      base.alt = "image";
      base.h = 240;
      base.style.background = "#e2e8f0";
      break;
    case "shape":
      base.shape = "rect";
      base.content = "";
      base.style.background = "#0d9488";
      base.h = 160;
      base.w = 320;
      break;
    case "arrow":
      base.x = centerX - 200;
      base.y = centerY - 40;
      base.w = 400;
      base.h = 80;
      base.x1 = 0;
      base.y1 = 40;
      base.x2 = 400;
      base.y2 = 40;
      base.arrowEnd = true;
      base.style.borderColor = "#0f172a";
      base.style.borderWidth = 4;
      base.content = "";
      break;
    case "math":
      base.content = "E = mc^2";
      base.style.fontSize = 36;
      base.h = 100;
      break;
    case "list":
      base.items = ["First point", "Second point", "Third point"];
      base.content = "";
      base.h = 180;
      break;
  }
  return base;
}

export const CANVAS_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: "note", label: "Note card", w: 1080, h: 1350 },
  { id: "square", label: "Square", w: 1080, h: 1080 },
  { id: "story", label: "Story", w: 1080, h: 1920 },
  { id: "landscape", label: "Landscape", w: 1600, h: 900 },
  { id: "doc", label: "Document", w: 1240, h: 1754 },
];

// ---------------------------------------------------------------------------
// Immutable transform helpers
// ---------------------------------------------------------------------------

export function updateElement(design: CanvasDesign, id: string, patch: Partial<CanvasElement>): CanvasDesign {
  return {
    ...design,
    elements: design.elements.map((el) => (el.id === id ? { ...el, ...patch, id: el.id } : el)),
  };
}

export function moveElement(design: CanvasDesign, id: string, dx: number, dy: number): CanvasDesign {
  return updateElement(design, id, { x: design.elements.find((e) => e.id === id)!.x + dx, y: design.elements.find((e) => e.id === id)!.y + dy });
}

/** Resize an element from a given handle (nw/n/ne/e/se/s/sw/w) anchored at the opposite edge. */
export function resizeElement(
  design: CanvasDesign,
  id: string,
  handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
  dx: number,
  dy: number,
  min = 24
): CanvasDesign {
  const el = design.elements.find((e) => e.id === id);
  if (!el) return design;
  let { x, y, w, h } = el;
  if (handle.includes("e")) w = Math.max(min, w + dx);
  if (handle.includes("s")) h = Math.max(min, h + dy);
  if (handle.includes("w")) {
    const next = Math.max(min, w - dx);
    x += w - next;
    w = next;
  }
  if (handle.includes("n")) {
    const next = Math.max(min, h - dy);
    y += h - next;
    h = next;
  }
  return updateElement(design, id, { x, y, w, h });
}

export function bringForward(design: CanvasDesign, id: string): CanvasDesign {
  const el = design.elements.find((e) => e.id === id);
  if (!el) return design;
  const maxZ = Math.max(...design.elements.map((e) => e.z));
  return updateElement(design, id, { z: maxZ + 1 });
}

export function sendBackward(design: CanvasDesign, id: string): CanvasDesign {
  const el = design.elements.find((e) => e.id === id);
  if (!el) return design;
  const minZ = Math.min(...design.elements.map((e) => e.z));
  return updateElement(design, id, { z: minZ - 1 });
}

export function removeElement(design: CanvasDesign, id: string): CanvasDesign {
  return { ...design, elements: design.elements.filter((e) => e.id !== id) };
}

export function duplicateElement(design: CanvasDesign, id: string): CanvasDesign {
  const el = design.elements.find((e) => e.id === id);
  if (!el) return design;
  const copy: CanvasElement = { ...el, id: newElementId(), x: el.x + 24, y: el.y + 24, z: Math.max(...design.elements.map((e) => e.z)) + 1 };
  return { ...design, elements: [...design.elements, copy] };
}

/** Ordered for rendering — lowest z first. */
export function sortedElements(design: CanvasDesign): CanvasElement[] {
  return [...design.elements].sort((a, b) => a.z - b.z);
}

export function resizeCanvas(design: CanvasDesign, width: number, height: number): CanvasDesign {
  return { ...design, width, height };
}

export function serializeDesign(design: CanvasDesign): string {
  return JSON.stringify(design);
}

export function parseDesign(json: string): CanvasDesign | null {
  try {
    const parsed = JSON.parse(json) as CanvasDesign;
    if (!parsed || typeof parsed.width !== "number" || typeof parsed.height !== "number" || !Array.isArray(parsed.elements)) return null;
    return {
      version: 1,
      width: parsed.width,
      height: parsed.height,
      background: parsed.background ?? { color: "#ffffff" },
      elements: parsed.elements,
    };
  } catch {
    return null;
  }
}
