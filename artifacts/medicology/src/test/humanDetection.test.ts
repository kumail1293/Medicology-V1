import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHumanDetector } from "../lib/humanDetection";

describe("createHumanDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true within the initial grace period (< 10s) even with zero events", () => {
    const detector = createHumanDetector();
    expect(detector.isLikelyHuman()).toBe(true);
    detector.destroy();
  });

  it("returns false after 10s if no mouse/key/touch events were triggered", () => {
    const detector = createHumanDetector();
    vi.advanceTimersByTime(11000);
    expect(detector.isLikelyHuman()).toBe(false);
    detector.destroy();
  });

  it("returns true after 10s if mousemove event occurred", () => {
    const detector = createHumanDetector();
    document.dispatchEvent(new MouseEvent("mousemove"));
    vi.advanceTimersByTime(11000);
    expect(detector.isLikelyHuman()).toBe(true);
    detector.destroy();
  });

  it("returns true after 10s if keydown event occurred", () => {
    const detector = createHumanDetector();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    vi.advanceTimersByTime(11000);
    expect(detector.isLikelyHuman()).toBe(true);
    detector.destroy();
  });

  it("returns true after 10s if touchstart event occurred", () => {
    const detector = createHumanDetector();
    document.dispatchEvent(new Event("touchstart"));
    vi.advanceTimersByTime(11000);
    expect(detector.isLikelyHuman()).toBe(true);
    detector.destroy();
  });

  it("stops tracking events after destroy is called", () => {
    const detector = createHumanDetector();
    detector.destroy();
    document.dispatchEvent(new MouseEvent("mousemove"));
    vi.advanceTimersByTime(11000);
    expect(detector.isLikelyHuman()).toBe(false);
  });
});
