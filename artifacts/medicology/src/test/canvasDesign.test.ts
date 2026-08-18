import { describe, it, expect } from "vitest";
import {
  createCanvasDesign,
  createElement,
  updateElement,
  moveElement,
  resizeElement,
  bringForward,
  sendBackward,
  removeElement,
  duplicateElement,
  sortedElements,
  serializeDesign,
  parseDesign,
} from "@/lib/canvas-design";
import { parseNoteBlocks, serializeNoteBlocks } from "@/lib/note-blocks";

describe("canvas design factories", () => {
  it("creates a blank design with the given dimensions", () => {
    const d = createCanvasDesign(1080, 1350);
    expect(d.version).toBe(1);
    expect(d.width).toBe(1080);
    expect(d.height).toBe(1350);
    expect(d.elements).toHaveLength(0);
    expect(d.background.color).toBe("#ffffff");
  });

  it("creates every element type with sensible defaults", () => {
    const d = createCanvasDesign();
    for (const type of ["text", "heading", "image", "shape", "arrow", "math", "list"] as const) {
      const el = createElement(type, d);
      expect(el.type).toBe(type);
      expect(el.id).toBeTruthy();
      expect(el.rotation).toBe(0);
      expect(el.opacity).toBe(1);
      expect(el.w).toBeGreaterThan(0);
      expect(el.h).toBeGreaterThan(0);
    }
    const arrow = createElement("arrow", d);
    expect(arrow.x1).toBe(0);
    expect(arrow.arrowEnd).toBe(true);
    expect(arrow.style.borderWidth).toBe(4);
    const shape = createElement("shape", d);
    expect(shape.shape).toBe("rect");
    const math = createElement("math", d);
    expect(math.content).toBeTruthy();
    const list = createElement("list", d);
    expect(list.items).toHaveLength(3);
  });

  it("gives every element a unique id and z grows with element count", () => {
    const d = createCanvasDesign();
    const ids = new Set<string>();
    const els = [];
    for (let i = 0; i < 5; i++) {
      const el = createElement("text", d);
      ids.add(el.id);
      els.push(el);
      d.elements.push(el);
    }
    expect(ids.size).toBe(5);
    expect(els[0].z).toBe(1);
    expect(els[4].z).toBe(5);
  });
});

describe("canvas transform helpers", () => {
  it("updates an element immutably by id", () => {
    const d = createCanvasDesign();
    const el = createElement("text", d);
    const d2 = { ...d, elements: [el] };
    const next = updateElement(d2, el.id, { content: "Changed" });
    expect(next.elements[0].content).toBe("Changed");
    expect(d2.elements[0].content).not.toBe("Changed");
  });

  it("moves an element by delta", () => {
    const d = createCanvasDesign();
    const el = createElement("text", d);
    const d2 = { ...d, elements: [el] };
    const next = moveElement(d2, el.id, 50, -20);
    expect(next.elements[0].x).toBe(el.x + 50);
    expect(next.elements[0].y).toBe(el.y - 20);
  });

  it("resizes from each handle, anchoring the opposite edge", () => {
    const d = createCanvasDesign();
    const el = createElement("shape", d);
    const base = { ...d, elements: [{ ...el, x: 100, y: 100, w: 200, h: 100 }] };
    // se: grows right/down
    const se = resizeElement(base, el.id, "se", 50, 30);
    expect(se.elements[0].w).toBe(250);
    expect(se.elements[0].h).toBe(130);
    expect(se.elements[0].x).toBe(100);
    // nw: shrinks from top-left, keeping bottom-right anchored
    const nw = resizeElement(base, el.id, "nw", 40, 30);
    expect(nw.elements[0].w).toBe(160);
    expect(nw.elements[0].h).toBe(70);
    expect(nw.elements[0].x).toBe(140);
    expect(nw.elements[0].y).toBe(130);
    // e: width only
    const e = resizeElement(base, el.id, "e", -10, 0);
    expect(e.elements[0].w).toBe(190);
    expect(e.elements[0].h).toBe(100);
  });

  it("never shrinks below the minimum size", () => {
    const d = createCanvasDesign();
    const el = createElement("shape", d);
    const base = { ...d, elements: [{ ...el, x: 100, y: 100, w: 40, h: 40 }] };
    const next = resizeElement(base, el.id, "nw", 1000, 1000, 24);
    expect(next.elements[0].w).toBe(24);
    expect(next.elements[0].h).toBe(24);
  });

  it("reorders z via bringForward / sendBackward", () => {
    const d = createCanvasDesign();
    const a = createElement("text", d);
    const b = { ...createElement("shape", d), z: 2 };
    const base = { ...d, elements: [a, b] };
    const fwd = bringForward(base, a.id);
    expect(fwd.elements.find((e) => e.id === a.id)!.z).toBeGreaterThan(b.z);
    const back = sendBackward(base, b.id);
    expect(back.elements.find((e) => e.id === b.id)!.z).toBeLessThan(a.z);
    // sortedElements renders lowest z first
    const sorted = sortedElements(base);
    expect(sorted[0].id).toBe(a.id);
  });

  it("removes and duplicates elements", () => {
    const d = createCanvasDesign();
    const a = createElement("text", d);
    const b = createElement("shape", d);
    const base = { ...d, elements: [a, b] };
    const fewer = removeElement(base, a.id);
    expect(fewer.elements).toHaveLength(1);
    const more = duplicateElement(base, b.id);
    expect(more.elements).toHaveLength(3);
    const copy = more.elements[2];
    expect(copy.id).not.toBe(b.id);
    expect(copy.content).toBe(b.content);
    expect(copy.x).toBe(b.x + 24);
    expect(copy.z).toBeGreaterThan(b.z);
  });
});

describe("canvas serialization", () => {
  it("round-trips a design through JSON", () => {
    const d = createCanvasDesign(1080, 1350);
    d.elements = [
      createElement("heading", d),
      createElement("arrow", d),
      createElement("math", d),
    ];
    const parsed = parseDesign(serializeDesign(d));
    expect(parsed).not.toBeNull();
    expect(parsed!.width).toBe(1080);
    expect(parsed!.height).toBe(1350);
    expect(parsed!.elements).toHaveLength(3);
    expect(parsed!.elements[0].type).toBe("heading");
    expect(parsed!.elements[1].arrowEnd).toBe(true);
    expect(parsed!.elements[2].content).toBe("E = mc^2");
  });

  it("returns null for invalid JSON and non-design shapes", () => {
    expect(parseDesign("not json")).toBeNull();
    expect(parseDesign("{}")).toBeNull();
    expect(parseDesign('{"width":"x","height":1,"elements":[]}')).toBeNull();
  });
});

describe("canvas block in note markdown", () => {
  const DESIGN = serializeDesign((() => {
    const d = createCanvasDesign(1080, 1350);
    d.elements = [createElement("heading", d), createElement("arrow", d)];
    return d;
  })());

  it("parses a ```canvas fence into a canvas block", () => {
    const blocks = parseNoteBlocks(`# Note title\n\n\`\`\`canvas\n${DESIGN}\n\`\`\`\n`);
    const canvas = blocks.find((b) => b.type === "canvas");
    expect(canvas).toBeTruthy();
    const parsed = parseDesign(canvas!.design!);
    expect(parsed).not.toBeNull();
    expect(parsed!.elements.some((e) => e.type === "heading")).toBe(true);
  });

  it("round-trips the canvas block losslessly", () => {
    const blocks = parseNoteBlocks(`# Note title\n\n\`\`\`canvas\n${DESIGN}\n\`\`\`\n`);
    const md = serializeNoteBlocks(blocks);
    const reparsed = parseNoteBlocks(md);
    const canvas = reparsed.find((b) => b.type === "canvas");
    expect(canvas).toBeTruthy();
    expect(canvas!.design).toBe(DESIGN);
  });
});
