import { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchPublicSettings, AnimationsSettings } from "@/lib/adminSettings";

// Effect name → CSS @keyframes identifier (defined in index.css).
export const ANIMATION_KEYFRAMES: Record<string, string> = {
  none: "anim-none",
  fade: "anim-fade",
  slide: "anim-slide",
  scale: "anim-scale",
  zoom: "anim-zoom",
  bounce: "anim-bounce",
  shimmer: "anim-shimmer",
  pulse: "anim-pulse",
  marquee: "anim-marquee",
  typewriter: "anim-typewriter",
};

const DEFAULT_ANIMATIONS: AnimationsSettings = {
  enabled: true,
  defaultEffect: "fade",
  durationMs: 400,
  delayMs: 0,
  repeat: "once",
  trigger: "on_load",
};

interface AnimationContextValue {
  animations: AnimationsSettings;
  /** True when the user has reduced motion on (OS preference) or animations disabled. */
  disabled: boolean;
  reducedMotion: boolean;
}

const AnimationContext = createContext<AnimationContextValue>({
  animations: DEFAULT_ANIMATIONS,
  disabled: false,
  reducedMotion: false,
});

export function useAnimations() {
  return useContext(AnimationContext);
}

function mediaQueryReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Applies the platform animation settings to CSS variables on <html> and
 * drives the `.anim` utility class. Hard rules:
 *   - prefers-reduced-motion (OS) ALWAYS wins — animations are disabled.
 *   - the admin "enabled" master switch disables animations for everyone else.
 * The class list on <html> (anim-on/anim-off + anim-<effect>) is what the CSS
 * actually keys off.
 */
export function applyAnimations(animations: AnimationsSettings, reducedMotion = mediaQueryReducedMotion()) {
  const root = document.documentElement;
  const disabled = reducedMotion || !animations.enabled || animations.defaultEffect === "none";

  root.classList.toggle("anim-off", disabled);
  root.classList.toggle("anim-on", !disabled);

  // Remove any previous effect class.
  root.classList.forEach((c) => {
    if (c.startsWith("anim-effect-")) root.classList.remove(c);
  });
  if (!disabled) root.classList.add(`anim-effect-${animations.defaultEffect}`);

  const iterations = animations.repeat === "infinite" ? "infinite" : animations.repeat === "once" ? "1" : "0";
  root.style.setProperty("--anim-duration", `${animations.durationMs}ms`);
  root.style.setProperty("--anim-delay", `${animations.delayMs}ms`);
  root.style.setProperty("--anim-iterations", iterations);
}

export default function AnimationProvider({ children }: { children: ReactNode }) {
  const [animations, setAnimations] = useState<AnimationsSettings>(DEFAULT_ANIMATIONS);
  const [reducedMotion, setReducedMotion] = useState(false);
  const animationsRef = useRef(animations);
  animationsRef.current = animations;

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then(({ settings }) => {
        if (cancelled) return;
        const merged = { ...DEFAULT_ANIMATIONS, ...(settings.animations ?? {}) };
        setAnimations(merged);
        applyAnimations(merged, mediaQueryReducedMotion());
      })
      .catch(() => { /* non-fatal: keep defaults */ });

    // React to OS-level reduced-motion changes at runtime.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      const rm = mq.matches;
      setReducedMotion(rm);
      applyAnimations(animationsRef.current, rm);
    };
    mq.addEventListener?.("change", onChange);
    return () => {
      cancelled = true;
      mq.removeEventListener?.("change", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ animations, disabled: reducedMotion || !animations.enabled || animations.defaultEffect === "none", reducedMotion }),
    [animations, reducedMotion]
  );

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>;
}
