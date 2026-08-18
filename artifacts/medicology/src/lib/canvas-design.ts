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
  /** element background gradient */
  backgroundGradient?: { from: string; to: string; angle?: number };
  /** shape / text-box border */
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "double";
  radius?: number;
  opacity?: number;
  /** CSS box-shadow */
  shadow?: string;
  /** CSS text-shadow (for text / heading elements) */
  textShadow?: string;
  /** padding inside text boxes / shapes with content */
  padding?: number;
}

export interface ImageFilters {
  brightness?: number;  // 0–2, default 1
  contrast?: number;    // 0–2, default 1
  saturate?: number;    // 0–2, default 1
  blur?: number;        // 0–20 px
  grayscale?: number;   // 0–1
  sepia?: number;       // 0–1
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
  /** image CSS filters */
  filters?: ImageFilters;
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
  /** group membership — elements with the same groupId are locked together */
  groupId?: string;
  /** user-assigned layer name */
  name?: string;
  /** lock element from selection / movement */
  locked?: boolean;
}

export interface CanvasBackground {
  color?: string;
  /** gradient — from → to, diagonal */
  gradientFrom?: string;
  gradientTo?: string;
  image?: string;
  /** overlay pattern */
  pattern?: "none" | "grid" | "dots" | "lines" | "diagonal";
  patternColor?: string;
  patternOpacity?: number;
}

export interface CanvasBranding {
  enabled: boolean;
  logo?: string;
  name?: string;
  social?: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "bottom-center";
  opacity?: number; // 0–1
}

export interface CanvasDesign {
  version: 1;
  width: number;
  height: number;
  background: CanvasBackground;
  elements: CanvasElement[];
  branding?: CanvasBranding;
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

// ---------------------------------------------------------------------------
// Alignment helpers
// ---------------------------------------------------------------------------

export type AlignH = "left" | "center" | "right";
export type AlignV = "top" | "middle" | "bottom";

export function alignElements(design: CanvasDesign, ids: string[], h: AlignH | null, v: AlignV | null): CanvasDesign {
  const els = design.elements.filter((e) => ids.includes(e.id));
  if (els.length < 2) return design;
  const minX = Math.min(...els.map((e) => e.x));
  const maxX = Math.max(...els.map((e) => e.x + e.w));
  const minY = Math.min(...els.map((e) => e.y));
  const maxY = Math.max(...els.map((e) => e.y + e.h));
  return {
    ...design,
    elements: design.elements.map((e) => {
      if (!ids.includes(e.id)) return e;
      let x = e.x, y = e.y;
      if (h === "left") x = minX;
      else if (h === "center") x = minX + (maxX - minX - e.w) / 2;
      else if (h === "right") x = maxX - e.w;
      if (v === "top") y = minY;
      else if (v === "middle") y = minY + (maxY - minY - e.h) / 2;
      else if (v === "bottom") y = maxY - e.h;
      return { ...e, x, y };
    }),
  };
}

export function groupElements(design: CanvasDesign, ids: string[]): CanvasDesign {
  const groupId = `g${Date.now().toString(36)}`;
  return {
    ...design,
    elements: design.elements.map((e) => ids.includes(e.id) ? { ...e, groupId } : e),
  };
}

export function ungroupElements(design: CanvasDesign, groupId: string): CanvasDesign {
  return {
    ...design,
    elements: design.elements.map((e) => e.groupId === groupId ? { ...e, groupId: undefined } : e),
  };
}

export function snapX(design: CanvasDesign, el: CanvasElement, snapThreshold = 5): number {
  const others = design.elements.filter((e) => e.id !== el.id);
  let best = el.x;
  let bestDist = snapThreshold + 1;
  for (const o of others) {
    for (const cx of [o.x, o.x + o.w / 2, o.x + o.w]) {
      const d = Math.abs(el.x + el.w / 2 - cx);
      if (d < bestDist) { bestDist = d; best = cx - el.w / 2; }
    }
  }
  return bestDist <= snapThreshold ? best : el.x;
}

export function snapY(design: CanvasDesign, el: CanvasElement, snapThreshold = 5): number {
  const others = design.elements.filter((e) => e.id !== el.id);
  let best = el.y;
  let bestDist = snapThreshold + 1;
  for (const o of others) {
    for (const cy of [o.y, o.y + o.h / 2, o.y + o.h]) {
      const d = Math.abs(el.y + el.h / 2 - cy);
      if (d < bestDist) { bestDist = d; best = cy - el.h / 2; }
    }
  }
  return bestDist <= snapThreshold ? best : el.y;
}

// ---------------------------------------------------------------------------
// Canvas templates
// ---------------------------------------------------------------------------

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  width: number;
  height: number;
  elements: CanvasElement[];
  background?: CanvasBackground;
}

function templateStyle(overrides: Partial<CanvasElementStyle> = {}): CanvasElementStyle {
  return {
    fontFamily: "DM Sans",
    fontSize: 28,
    fontWeight: 400,
    color: "#0f172a",
    textAlign: "left",
    lineHeight: 1.4,
    ...overrides,
  };
}

function templateEl(type: CanvasElementType, x: number, y: number, w: number, h: number, content: string, style: CanvasElementStyle = templateStyle()): CanvasElement {
  return { id: `tpl_${type}_${x}_${y}`, type, x, y, w, h, rotation: 0, z: 1, opacity: 1, style, content };
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "diagram-flow",
    name: "Flow Diagram",
    description: "Horizontal or vertical flow with numbered steps and arrows",
    width: 1080,
    height: 720,
    background: { color: "#f8fafc" },
    elements: [
      { ...templateEl("shape", 60, 200, 220, 140, "", { ...templateStyle({ background: "#2563eb", radius: 16 }), radius: 16 }), shape: "round" },
      templateEl("text", 60, 230, 220, 80, "Step 1\nIntroduction", templateStyle({ fontSize: 22, fontWeight: 700, color: "#ffffff", textAlign: "center" })),
      { ...templateEl("shape", 430, 200, 220, 140, "", { ...templateStyle({ background: "#16a34a", radius: 16 }), radius: 16 }), shape: "round" },
      templateEl("text", 430, 230, 220, 80, "Step 2\nProcess", templateStyle({ fontSize: 22, fontWeight: 700, color: "#ffffff", textAlign: "center" })),
      { ...templateEl("shape", 800, 200, 220, 140, "", { ...templateStyle({ background: "#d97706", radius: 16 }), radius: 16 }), shape: "round" },
      templateEl("text", 800, 230, 220, 80, "Step 3\nResult", templateStyle({ fontSize: 22, fontWeight: 700, color: "#ffffff", textAlign: "center" })),
      { ...templateEl("arrow", 282, 260, 146, 40, "", templateStyle({ borderColor: "#94a3b8", borderWidth: 3 })), x1: 0, y1: 20, x2: 146, y2: 20, arrowEnd: true },
      { ...templateEl("arrow", 652, 260, 146, 40, "", templateStyle({ borderColor: "#94a3b8", borderWidth: 3 })), x1: 0, y1: 20, x2: 146, y2: 20, arrowEnd: true },
    ],
  },
  {
    id: "comparison-table",
    name: "Comparison Layout",
    description: "Two-column comparison with a center divider",
    width: 1080,
    height: 900,
    background: { color: "#ffffff" },
    elements: [
      templateEl("heading", 40, 30, 1000, 80, "Comparison", templateStyle({ fontSize: 48, fontWeight: 800, fontFamily: "Outfit", textAlign: "center" })),
      { ...templateEl("shape", 40, 140, 490, 640, "", templateStyle({ background: "#eff6ff", borderWidth: 1, borderColor: "#dbeafe" })), shape: "round" },
      templateEl("heading", 60, 160, 450, 50, "Option A", templateStyle({ fontSize: 32, fontWeight: 700, color: "#2563eb" })),
      templateEl("text", 60, 220, 450, 400, "Feature 1\nFeature 2\nFeature 3", templateStyle({ fontSize: 24, lineHeight: 2 })),
      { ...templateEl("shape", 550, 140, 490, 640, "", templateStyle({ background: "#fef3c7", borderWidth: 1, borderColor: "#fde68a" })), shape: "round" },
      templateEl("heading", 570, 160, 450, 50, "Option B", templateStyle({ fontSize: 32, fontWeight: 700, color: "#d97706" })),
      templateEl("text", 570, 220, 450, 400, "Feature 1\nFeature 2\nFeature 3", templateStyle({ fontSize: 24, lineHeight: 2 })),
    ],
  },
  {
    id: "medical-note",
    name: "Medical Note",
    description: "High-yield note card with callout, heading, and key points",
    width: 1080,
    height: 1350,
    background: { gradientFrom: "#f0f9ff", gradientTo: "#ffffff" },
    elements: [
      templateEl("heading", 60, 40, 960, 100, "Topic Title", templateStyle({ fontSize: 52, fontWeight: 800, fontFamily: "Outfit", textAlign: "center", color: "#0f172a" })),
      { ...templateEl("shape", 60, 180, 960, 120, "", templateStyle({ background: "#ecfdf5", radius: 16, borderWidth: 1, borderColor: "#bbf7d0" })), shape: "round" },
      templateEl("text", 80, 195, 920, 90, "📌 High-Yield: Key concept or fact goes here", templateStyle({ fontSize: 24, fontWeight: 600, color: "#166534", lineHeight: 1.5 })),
      templateEl("heading", 60, 340, 960, 60, "Key Points", templateStyle({ fontSize: 36, fontWeight: 700 })),
      templateEl("text", 60, 420, 960, 250, "• Point one\n• Point two\n• Point three", templateStyle({ fontSize: 24, lineHeight: 2 })),
      { ...templateEl("shape", 60, 720, 960, 100, "", templateStyle({ background: "#fef2f2", radius: 12, borderWidth: 1, borderColor: "#fecaca" })), shape: "round" },
      templateEl("text", 80, 740, 920, 60, "⚠️ Common Trap: watch out for this distractor", templateStyle({ fontSize: 22, color: "#991b1b" })),
      templateEl("heading", 60, 880, 960, 60, "Summary", templateStyle({ fontSize: 32, fontWeight: 700 })),
      templateEl("text", 60, 960, 960, 200, "Brief summary paragraph with the most important takeaway.", templateStyle({ fontSize: 24, lineHeight: 1.6 })),
    ],
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Empty canvas — start from scratch",
    width: 1080,
    height: 1350,
    background: { color: "#ffffff" },
    elements: [],
  },
];

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

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
      branding: parsed.branding,
    };
  } catch {
    return null;
  }
}
