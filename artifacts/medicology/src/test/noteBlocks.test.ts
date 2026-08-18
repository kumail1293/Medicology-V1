import { describe, it, expect } from "vitest";
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
} from "@/lib/note-blocks";

const SAMPLE = `# Cardiac Action Potential

## Phase 0 — Depolarization

Na⁺ channels open; rapid upstroke. This is the **fast** phase.

> **💡 Tip:** Memorize the order: 0-1-2-3-4.

> **🧠 Mnemonic:** "Depolarize, early repolarize, plateau, repolarize, rest."

## The 5 phases

| Phase | Ion | Event |
|---|---|---|
| 0 | Na⁺ | Depolarization |
| 3 | K⁺ | Repolarization |

\`\`\`mermaid
flowchart TD
  A[Start] --> B[End]
\`\`\`

$$Anion\\ gap = Na^+ - (Cl^- + HCO_3^-)$$

- First item
- Second item

- [x] Done
- [ ] Pending

![Diagram](/media/diagram.png "A caption")

---

Some final paragraph.
`;

describe("parseNoteBlocks", () => {
  it("parses every block type from a rich note", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const types = blocks.map((b) => b.type);
    expect(types).toContain("heading");
    expect(types).toContain("paragraph");
    expect(types).toContain("callout");
    expect(types).toContain("table");
    expect(types).toContain("mermaid");
    expect(types).toContain("math");
    expect(types).toContain("list");
    expect(types).toContain("checklist");
    expect(types).toContain("image");
    expect(types).toContain("divider");
  });

  it("captures heading levels and text", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const h1 = blocks.find((b) => b.type === "heading" && b.level === 1);
    const h2 = blocks.find((b) => b.type === "heading" && b.level === 2);
    expect(h1?.text).toBe("Cardiac Action Potential");
    expect(h2?.text).toContain("Phase 0");
  });

  it("classifies callout tones and strips markers", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const callouts = blocks.filter((b) => b.type === "callout");
    expect(callouts).toHaveLength(2);
    expect(callouts[0].tone).toBe("tip");
    expect(callouts[1].tone).toBe("mnemonic");
    expect(callouts[0].text).not.toContain("Tip:");
    expect(callouts[1].text).toContain("Depolarize");
  });

  it("keeps table markdown verbatim", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const table = blocks.find((b) => b.type === "table");
    expect(table?.markdown).toContain("| Phase | Ion | Event |");
    expect(table?.markdown).toContain("| 0 | Na⁺ | Depolarization |");
  });

  it("captures mermaid source and math", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const mermaid = blocks.find((b) => b.type === "mermaid");
    expect(mermaid?.code).toContain("flowchart TD");
    const math = blocks.find((b) => b.type === "math");
    expect(math?.display).toBe(true);
    expect(math?.text).toContain("Anion");
  });

  it("distinguishes checklist from list and image caption", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const checklist = blocks.find((b) => b.type === "checklist");
    expect(checklist?.items).toHaveLength(2);
    expect(isChecked(checklist!.items![0])).toBe(true);
    expect(isChecked(checklist!.items![1])).toBe(false);
    const image = blocks.find((b) => b.type === "image");
    expect(image?.src).toBe("/media/diagram.png");
    expect(image?.caption).toBe("A caption");
  });
});

describe("serializeNoteBlocks", () => {
  it("round-trips a rich note to equivalent markdown", () => {
    const blocks = parseNoteBlocks(SAMPLE);
    const md = serializeNoteBlocks(blocks);
    const reparsed = parseNoteBlocks(md);
    // Same structure (types + key fields) after the round trip.
    expect(reparsed.map((b) => b.type)).toEqual(blocks.map((b) => b.type));
    for (let i = 0; i < blocks.length; i++) {
      const a = blocks[i];
      const b = reparsed[i];
      expect(b.text).toBe(a.text);
      expect(b.level).toBe(a.level);
      expect(b.ordered).toBe(a.ordered);
      expect(b.tone).toBe(a.tone);
      expect(b.display).toBe(a.display);
      expect(b.markdown).toBe(a.markdown);
      expect(b.code).toBe(a.code);
      expect(b.src).toBe(a.src);
      expect(b.caption).toBe(a.caption);
      expect(b.items).toEqual(a.items);
    }
  });

  it("serializes checklist with checked state", () => {
    const md = serializeNoteBlocks([
      { id: "x", type: "checklist", items: ["- [x] Done", "- [ ] Pending"] },
    ]);
    expect(md).toContain("- [x] Done");
    expect(md).toContain("- [ ] Pending");
  });

  it("serializes inline math with single dollars", () => {
    const md = serializeNoteBlocks([{ id: "x", type: "math", display: false, text: "Na^+" }]);
    expect(md.trim()).toBe("$Na^+$");
  });

  it("serializes callouts with the tone marker", () => {
    const md = serializeNoteBlocks([{ id: "x", type: "callout", tone: "trap", text: "Watch the distractor" }]);
    expect(md).toContain("> **⚠️ Trap:** Watch the distractor");
  });
});

describe("editor helpers", () => {
  const base = parseNoteBlocks("## A\n\nParagraph one.\n\n## B\n");

  it("updates a block in place", () => {
    const next = updateBlock(base, base[0].id, { text: "Changed" });
    expect(next[0].text).toBe("Changed");
    expect(base[0].text).not.toBe("Changed");
  });

  it("adds after a given block", () => {
    const next = addBlockAfter(base, base[1].id, { type: "divider" });
    expect(next).toHaveLength(base.length + 1);
    expect(next[2].type).toBe("divider");
  });

  it("appends when afterId is null", () => {
    const next = addBlockAfter(base, null, { type: "divider" });
    expect(next[next.length - 1].type).toBe("divider");
  });

  it("removes and duplicates blocks", () => {
    const fewer = removeBlock(base, base[0].id);
    expect(fewer).toHaveLength(base.length - 1);
    const more = duplicateBlock(base, base[1].id);
    expect(more).toHaveLength(base.length + 1);
    expect(more[2].text).toBe(base[1].text);
    expect(more[2].id).not.toBe(base[1].id);
  });

  it("moves blocks up and down within bounds", () => {
    const down = moveBlock(base, base[0].id, 1);
    expect(down[0].id).toBe(base[1].id);
    const clamped = moveBlock(base, base[base.length - 1].id, 1);
    expect(clamped.map((b) => b.id)).toEqual(base.map((b) => b.id));
  });

  it("toggles checklist items", () => {
    expect(setChecked("- [ ] Task", true)).toBe("- [x] Task");
    expect(setChecked("- [x] Task", false)).toBe("- [ ] Task");
  });
});

describe("flowchart builder", () => {
  const SOURCE = `flowchart TD
  A["Start"] -->|Yes| B{Decision}
  A --> C(End)
  B --> C`;

  it("parses nodes and edges with labels and shapes", () => {
    const model = parseFlowchart(SOURCE);
    expect(model).not.toBeNull();
    expect(model!.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);
    expect(model!.nodes.find((n) => n.id === "B")?.shape).toBe("diamond");
    expect(model!.nodes.find((n) => n.id === "C")?.shape).toBe("round");
    expect(model!.edges).toContainEqual({ from: "A", to: "B", label: "Yes" });
    expect(model!.edges).toContainEqual({ from: "A", to: "C", label: "" });
  });

  it("round-trips through buildFlowchart", () => {
    const model = parseFlowchart(SOURCE)!;
    const rebuilt = parseFlowchart(buildFlowchart(model));
    expect(rebuilt!.nodes.map((n) => n.id)).toEqual(model.nodes.map((n) => n.id));
    expect(rebuilt!.edges.map((e) => `${e.from}>${e.to}`)).toEqual(model.edges.map((e) => `${e.from}>${e.to}`));
    expect(rebuilt!.edges.find((e) => e.label === "Yes")).toBeTruthy();
  });

  it("returns null for unsupported syntax", () => {
    expect(parseFlowchart("sequenceDiagram\nA->>B: hi")).toBeNull();
    expect(parseFlowchart("")).toBeNull();
  });

  it("mutates the model immutably", () => {
    const model = parseFlowchart(SOURCE)!;
    const withD = upsertNode(model, { id: "D", label: "Extra", shape: "rect" });
    expect(withD.nodes).toHaveLength(4);
    expect(model.nodes).toHaveLength(3);
    const withoutA = removeNode(withD, "A");
    expect(withoutA.nodes.some((n) => n.id === "A")).toBe(false);
    expect(withoutA.edges.every((e) => e.from !== "A" && e.to !== "A")).toBe(true);
    const withLabel = upsertEdge(model, { from: "B", to: "C", label: "No" });
    expect(withLabel.edges.find((e) => e.from === "B" && e.to === "C")?.label).toBe("No");
    const removed = removeEdge(withLabel, "B", "C");
    expect(removed.edges.some((e) => e.from === "B" && e.to === "C")).toBe(false);
  });
});
