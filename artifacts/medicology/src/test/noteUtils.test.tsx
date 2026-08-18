import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MarkdownNote from "@/components/MarkdownNote";
import {
  classifyCallout,
  splitCalloutLine,
  extractHeadings,
  getExcerpt,
  slugify,
  readingTime,
} from "@/lib/note-utils";
import { SHARE_PRESETS, getHandleFromUrl } from "@/lib/note-share";

describe("classifyCallout", () => {
  it("classifies bold-labeled callouts", () => {
    expect(classifyCallout("> **Trap:** X")?.tone).toBe("trap");
    expect(classifyCallout("> **High-yield trap:** X")?.tone).toBe("highYield");
    expect(classifyCallout("> **Tip:** X")?.tone).toBe("tip");
    expect(classifyCallout("> **Mnemonic:** X")?.tone).toBe("mnemonic");
    expect(classifyCallout("> **Clinical Pearl:** X")?.tone).toBe("pearl");
    expect(classifyCallout("> **Warning:** X")?.tone).toBe("warning");
  });

  it("classifies emoji-led callouts", () => {
    expect(classifyCallout("> 💡 Tip: X")?.tone).toBe("tip");
    expect(classifyCallout("> 🧠 Mnemonic: X")?.tone).toBe("mnemonic");
    expect(classifyCallout("> ⚠️ Trap: X")?.tone).toBe("trap");
    expect(classifyCallout("> 📌 High-Yield: X")?.tone).toBe("highYield");
  });

  it("returns null for plain quotes", () => {
    expect(classifyCallout("> Just a quote")).toBeNull();
    expect(classifyCallout("> Normal text here")).toBeNull();
  });

  it("keeps a friendly label", () => {
    expect(classifyCallout("> **Trap:** X")?.label).toBe("Trap");
    expect(classifyCallout("> **High-yield:** X")?.label).toBe("High-Yield");
  });
});

describe("splitCalloutLine", () => {
  it("splits marker from content", () => {
    expect(splitCalloutLine("> **Trap:** This is the trap").rest).toBe("This is the trap");
    expect(splitCalloutLine("> **🧠 Mnemonic:** Remember me").rest).toBe("Remember me");
    expect(splitCalloutLine("> Plain quote")).toBeTruthy();
  });
});

describe("extractHeadings", () => {
  it("extracts h2/h3 with slugs", () => {
    const md = "# Title\n\n## Phase 0 — Depolarization\n\n### Sub-point\n\n## Another\n";
    const h = extractHeadings(md);
    expect(h).toHaveLength(3);
    expect(h[0]).toEqual({ level: 2, text: "Phase 0 — Depolarization", id: "phase-0-depolarization" });
    expect(h[1].level).toBe(3);
    expect(h[2].id).toBe("another");
  });

  it("ignores fenced code blocks", () => {
    const md = "# T\n\n```mermaid\nflowchart TD\n## not a heading\n```\n\n## Real heading\n";
    const h = extractHeadings(md);
    expect(h.map((x) => x.text)).toEqual(["Real heading"]);
  });
});

describe("getExcerpt", () => {
  it("strips markdown and truncates", () => {
    const md = "# Title\n\n**First** paragraph with a [link](https://x.com) and `code`.\n\n## Next\n- bullet one\n- bullet two\n";
    const ex = getExcerpt(md, 200);
    expect(ex).not.toContain("**");
    expect(ex).not.toContain("[link]");
    expect(ex).toContain("First");
    expect(ex.length).toBeLessThanOrEqual(203);
  });

  it("respects char limit with word boundary", () => {
    const md = `# T\n\n${"word ".repeat(60)}`;
    const ex = getExcerpt(md, 100);
    expect(ex.length).toBeLessThanOrEqual(103);
    expect(ex.endsWith("…")).toBe(true);
  });
});

describe("slugify + readingTime", () => {
  it("slugifies headings", () => {
    expect(slugify("Approach to Chest Pain!")).toBe("approach-to-chest-pain");
    expect(slugify("RAAS  —  Pathway")).toBe("raas-pathway");
  });

  it("estimates reading time", () => {
    expect(readingTime("# T\n\n" + "word ".repeat(400))).toBe(2);
    expect(readingTime("tiny")).toBe(1);
  });
});

describe("MarkdownNote renderer", () => {
  it("renders marker blockquotes as callout cards and keeps plain quotes plain", () => {
    const md = [
      "> **Trap:** This is the trap content.",
      "",
      "> **🧠 Mnemonic:** Remember this.",
      "",
      "> Just a quote",
    ].join("\n");
    const { container } = render(<MarkdownNote content={md} />);
    expect(container.querySelectorAll(".callout").length).toBe(2);
    const text = container.textContent ?? "";
    expect(text).toContain("This is the trap content");
    expect(text).toContain("Remember this");
    expect(text).toContain("Just a quote");
  });

  it("renders GFM tables inside a styled wrapper", () => {
    const md = "| Feature | UMN | LMN |\n|---|---|---|\n| Tone | Spastic | Flaccid |";
    const { container } = render(<MarkdownNote content={md} />);
    expect(container.querySelectorAll(".note-table-wrap").length).toBe(1);
    expect(container.querySelectorAll(".note-th").length).toBe(3);
    expect(container.textContent).toContain("Spastic");
  });

  it("renders task lists with checkboxes", () => {
    const md = "- [x] Done\n- [ ] Not done";
    const { container } = render(<MarkdownNote content={md} />);
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });

  it("adds slug anchors to headings", () => {
    const { container } = render(<MarkdownNote content="## RAAS Pathway & Drug Targets" />);
    const h2 = container.querySelector("h2");
    expect(h2?.id).toBe("raas-pathway-drug-targets");
  });
});

describe("share presets", () => {
  it("covers major platforms with valid dimensions", () => {
    const ids = SHARE_PRESETS.map((p) => p.id);
    expect(ids).toContain("instagram-post");
    expect(ids).toContain("instagram-story");
    expect(ids).toContain("x");
    expect(ids).toContain("facebook");
    expect(ids).toContain("linkedin");
    for (const p of SHARE_PRESETS) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.scale).toBeCloseTo(p.width / 1080, 3);
    }
  });

  it("derives handles from profile URLs", () => {
    expect(getHandleFromUrl("https://instagram.com/medicologyworld")).toBe("@medicologyworld");
    expect(getHandleFromUrl("https://tiktok.com/@medicologyworld")).toBe("@medicologyworld");
    expect(getHandleFromUrl("https://x.com/medicologyworld/")).toBe("@medicologyworld");
  });
});
