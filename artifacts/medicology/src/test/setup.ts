import "@testing-library/jest-dom";

// jsdom does not provide ResizeObserver — needed by MarkdownNote's canvas
// container sizing hook. A minimal stub that immediately fires the callback
// on observation so tests see the initial width.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    callback: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.callback = cb; }
    observe(target: Element) {
      this.callback([{ contentRect: { width: 800, height: 0, top: 0, left: 0 } } as any], this as any);
    }
    unobserve() {}
    disconnect() {}
  } as any;
}
