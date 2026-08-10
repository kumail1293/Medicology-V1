import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hashAnswers,
  storeChecksum,
  verifyChecksum,
  clearChecksum,
  createSessionToken,
} from "../lib/sessionIntegrity";

describe("sessionIntegrity", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("hashAnswers", () => {
    it("returns consistent hash for identical input", () => {
      const input = { q1: "A", q2: ["B", "C"] };
      expect(hashAnswers(input)).toBe(hashAnswers({ q1: "A", q2: ["B", "C"] }));
    });

    it("returns different hashes for different inputs", () => {
      expect(hashAnswers({ q1: "A" })).not.toBe(hashAnswers({ q1: "B" }));
    });

    it("handles empty objects", () => {
      expect(typeof hashAnswers({})).toBe("string");
    });
  });

  describe("storeChecksum & verifyChecksum", () => {
    it("returns true when verifyChecksum matches stored checksum", () => {
      const answers = { q1: "option_a" };
      storeChecksum(answers);
      expect(verifyChecksum(answers)).toBe(true);
    });

    it("returns false when answers change after storing checksum", () => {
      storeChecksum({ q1: "option_a" });
      expect(verifyChecksum({ q1: "option_b" })).toBe(false);
    });

    it("returns true if no checksum stored in sessionStorage", () => {
      expect(verifyChecksum({ q1: "anything" })).toBe(true);
    });

    it("handles sessionStorage getItem exception gracefully", () => {
      const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage failure");
      });
      expect(verifyChecksum({ q1: "test" })).toBe(true);
      spy.mockRestore();
    });
  });

  describe("clearChecksum", () => {
    it("removes checksum from sessionStorage", () => {
      storeChecksum({ q1: "option_a" });
      clearChecksum();
      expect(sessionStorage.getItem("_medi_si")).toBeNull();
    });

    it("handles storage errors silently", () => {
      const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("Storage disabled");
      });
      expect(() => clearChecksum()).not.toThrow();
      spy.mockRestore();
    });
  });

  describe("createSessionToken", () => {
    it("returns a valid base64 encoded token with session id", () => {
      const token = createSessionToken("session_123");
      const decoded = atob(token);
      expect(decoded).toContain("session_123");
    });
  });
});
