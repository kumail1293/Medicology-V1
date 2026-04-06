import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  stripHtmlTags,
  sanitizeInput,
  isValidEmail,
  isStrongPassword,
  clientRateLimit,
} from "../lib/security";

// stripHtmlTags removes HTML tags but preserves text content
describe("stripHtmlTags", () => {
  it("removes HTML tags, keeps inner text", () => {
    expect(stripHtmlTags("<b>Hello</b>")).toBe("Hello");
  });
  it("removes script tags but keeps inner text", () => {
    // Only tags are removed — text nodes remain
    expect(stripHtmlTags("<script>alert(1)</script>foo")).toBe("alert(1)foo");
  });
  it("removes nested tags", () => {
    expect(stripHtmlTags("<div><span>Text</span></div>")).toBe("Text");
  });
  it("leaves plain text unchanged", () => {
    expect(stripHtmlTags("plain text")).toBe("plain text");
  });
  it("trims surrounding whitespace", () => {
    expect(stripHtmlTags("  hi  ")).toBe("hi");
  });
});

// sanitizeInput HTML-encodes dangerous characters and slices at 5000 chars
describe("sanitizeInput", () => {
  it("HTML-encodes angle brackets", () => {
    expect(sanitizeInput("<b>name</b>")).toContain("&lt;");
    expect(sanitizeInput("<b>name</b>")).toContain("&gt;");
  });
  it("HTML-encodes ampersand", () => {
    expect(sanitizeInput("a & b")).toBe("a &amp; b");
  });
  it("limits length to 5000 chars", () => {
    const long = "a".repeat(6000);
    expect(sanitizeInput(long).length).toBeLessThanOrEqual(5000);
  });
  it("handles empty string", () => {
    expect(sanitizeInput("")).toBe("");
  });
  it("encodes quotes and slashes", () => {
    const result = sanitizeInput(`"it's a test"`);
    expect(result).toContain("&quot;");
    expect(result).toContain("&#x27;");
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user+tag@sub.domain.org")).toBe(true);
  });
  it("rejects missing @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });
  it("rejects missing TLD", () => {
    expect(isValidEmail("user@nodomain")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
  it("rejects @ at start", () => {
    expect(isValidEmail("@nodomain.com")).toBe(false);
  });
});

// isStrongPassword: min 8 chars + at least one uppercase + at least one digit
describe("isStrongPassword", () => {
  it("accepts passwords with uppercase + digit, length >= 8", () => {
    expect(isStrongPassword("Secure1!")).toBe(true);
    expect(isStrongPassword("Admin123")).toBe(true);
    expect(isStrongPassword("ALLUPPERCASE1")).toBe(true);
  });
  it("rejects passwords shorter than 8 chars", () => {
    expect(isStrongPassword("Sh0rt")).toBe(false);
    expect(isStrongPassword("")).toBe(false);
  });
  it("rejects passwords with no uppercase letter", () => {
    expect(isStrongPassword("alllowercase1")).toBe(false);
  });
  it("rejects passwords with no digit", () => {
    expect(isStrongPassword("NoNumbers!")).toBe(false);
  });
});

describe("clientRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(clientRateLimit(`underLimit_${Math.random()}`, 5)).toBe(true);
    }
  });

  it("blocks when count reaches maxPerMinute", () => {
    const key = `block_${Date.now()}`;
    for (let i = 0; i < 5; i++) clientRateLimit(key, 5);
    expect(clientRateLimit(key, 5)).toBe(false);
  });

  it("resets after one minute elapses", () => {
    const key = `reset_${Date.now()}`;
    for (let i = 0; i < 5; i++) clientRateLimit(key, 5);
    expect(clientRateLimit(key, 5)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(clientRateLimit(key, 5)).toBe(true);
  });
});
