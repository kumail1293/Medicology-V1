import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils";

describe("utils -> cn", () => {
  it("merges class names correctly", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes", () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn("base", isTrue && "active", isFalse && "hidden")).toBe("base active");
  });

  it("resolves tailwind conflicts with twMerge", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles empty inputs, undefined, and null values", () => {
    expect(cn("", undefined, null, "btn")).toBe("btn");
  });
});
