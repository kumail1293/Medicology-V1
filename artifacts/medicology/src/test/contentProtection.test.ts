import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createWatermarkCanvas,
  blockCaptureShortcuts,
  blurOnFocusLoss,
  reportSuspiciousActivity,
} from "../lib/contentProtection";

describe("contentProtection", () => {
  describe("createWatermarkCanvas", () => {
    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        clearRect: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillText: vi.fn(),
        globalAlpha: 0.04,
        fillStyle: "#000000",
        font: "13px sans-serif",
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,mock");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns a data URL string", () => {
      const result = createWatermarkCanvas("Test Watermark");
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^data:image\//);
    });
  });

  describe("blockCaptureShortcuts", () => {
    let removeListener: () => void;

    afterEach(() => {
      if (removeListener) removeListener();
    });

    it("prevents default for PrintScreen key", () => {
      removeListener = blockCaptureShortcuts();
      const event = new KeyboardEvent("keydown", { key: "PrintScreen", cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it("prevents default for F12 key", () => {
      removeListener = blockCaptureShortcuts();
      const event = new KeyboardEvent("keydown", { key: "F12", cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it("prevents default for Ctrl+Shift+I", () => {
      removeListener = blockCaptureShortcuts();
      const event = new KeyboardEvent("keydown", { key: "I", ctrlKey: true, shiftKey: true, cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it("allows standard regular keys like 'a'", () => {
      removeListener = blockCaptureShortcuts();
      const event = new KeyboardEvent("keydown", { key: "a", cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("blurOnFocusLoss", () => {
    it("applies blur filter on window blur and removes on focus", () => {
      const el = document.createElement("div");
      const cleanup = blurOnFocusLoss(el, 10);

      window.dispatchEvent(new Event("blur"));
      expect(el.style.filter).toBe("blur(10px)");

      window.dispatchEvent(new Event("focus"));
      expect(el.style.filter).toBe("");

      cleanup();
    });
  });

  describe("reportSuspiciousActivity", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sends report request without throwing error", async () => {
      await expect(reportSuspiciousActivity("session_123", "screenshot_attempt")).resolves.not.toThrow();
    });

    it("handles fetch rejection gracefully", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
      await expect(reportSuspiciousActivity("session_123", "devtools")).resolves.not.toThrow();
    });
  });
});
