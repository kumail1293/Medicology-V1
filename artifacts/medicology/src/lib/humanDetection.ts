export function createHumanDetector() {
  let mouseEvents = 0;
  let keyEvents = 0;
  let touchEvents = 0;
  const startTime = Date.now();

  const onMouse = () => mouseEvents++;
  const onKey = () => keyEvents++;
  const onTouch = () => touchEvents++;

  document.addEventListener("mousemove", onMouse, { passive: true });
  document.addEventListener("keydown", onKey, { passive: true });
  document.addEventListener("touchstart", onTouch, { passive: true });

  return {
    isLikelyHuman(): boolean {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed < 10) return true;
      return (mouseEvents + touchEvents) > 0 || keyEvents > 0;
    },
    destroy() {
      document.removeEventListener("mousemove", onMouse);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchstart", onTouch);
    },
  };
}
