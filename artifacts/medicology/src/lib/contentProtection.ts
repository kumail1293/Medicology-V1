import { apiFetch } from "@/lib/api";

export function createWatermarkCanvas(text: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 400, 300);
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#000000";
  ctx.font = "13px sans-serif";
  ctx.translate(200, 150);
  ctx.rotate(-Math.PI / 6);
  for (let y = -300; y < 300; y += 80) {
    for (let x = -400; x < 400; x += 200) {
      ctx.fillText(text, x, y);
    }
  }
  return canvas.toDataURL();
}

export function blockCaptureShortcuts(): () => void {
  const blocked = new Set(["PrintScreen", "F12"]);
  const handler = (e: KeyboardEvent) => {
    if (blocked.has(e.key)) { e.preventDefault(); return; }
    if (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(e.key)) {
      e.preventDefault(); return;
    }
    if (e.metaKey && e.shiftKey && e.key === "S") { e.preventDefault(); return; }
    if (e.metaKey && e.altKey && e.key === "R") { e.preventDefault(); return; }
    if (e.key === "F12") { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) {
      e.preventDefault(); return;
    }
    if (e.ctrlKey && e.key === "u") { e.preventDefault(); return; }
    if (e.ctrlKey && e.key === "s") { e.preventDefault(); return; }
    if (e.ctrlKey && e.key === "p") { e.preventDefault(); return; }
  };
  document.addEventListener("keydown", handler, { capture: true });
  return () => document.removeEventListener("keydown", handler, { capture: true });
}

export function detectDevTools(onDetected: () => void): () => void {
  let devtoolsOpen = false;
  const threshold = 100;
  const id = setInterval(() => {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const elapsed = performance.now() - start;
    if (elapsed > threshold && !devtoolsOpen) {
      devtoolsOpen = true;
      onDetected();
    } else if (elapsed < threshold) {
      devtoolsOpen = false;
    }
  }, 2000);
  return () => clearInterval(id);
}

export function blurOnFocusLoss(element: HTMLElement, blurAmount = 8): () => void {
  const handleBlur = () => {
    element.style.filter = `blur(${blurAmount}px)`;
    element.style.userSelect = "none";
  };
  const handleFocus = () => {
    element.style.filter = "";
    element.style.userSelect = "none";
  };
  window.addEventListener("blur", handleBlur);
  window.addEventListener("focus", handleFocus);
  return () => {
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("focus", handleFocus);
  };
}

export async function reportSuspiciousActivity(
  sessionId: string,
  type: "tab_hidden" | "devtools" | "screenshot_attempt" | "focus_lost"
) {
  try {
    await apiFetch("/api/sessions/security-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        type,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });
  } catch { /* silent — don't break the exam */ }
}
