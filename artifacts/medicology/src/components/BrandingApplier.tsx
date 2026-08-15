import { useEffect } from "react";
import { fetchPublicSettings, PublicSettings } from "@/lib/adminSettings";

/** #rrggbb → "h s% l%" triplet, matching the CSS design tokens. */
export function hexToHslTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBranding(s: Pick<PublicSettings, "general" | "branding">) {
  const root = document.documentElement;
  const { branding, general } = s;

  // Site name + meta
  document.title = general.siteName;
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = general.tagline || "";

  // Favicon
  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (favicon && branding.faviconUrl) favicon.href = branding.faviconUrl;

  // Design tokens (inline style wins over theme classes)
  const primary = hexToHslTriplet(branding.primaryColor);
  const accent = hexToHslTriplet(branding.accentColor);
  if (primary) root.style.setProperty("--primary", primary);
  if (accent) root.style.setProperty("--accent", accent);
  root.style.setProperty("--brand-radius", `${branding.borderRadius}px`);
  root.style.setProperty("--brand-content-width", `${branding.contentMaxWidth}px`);

  // Font — only when the user hasn't picked a personal font override.
  try {
    const raw = localStorage.getItem("medicology_settings");
    const userFont = raw ? JSON.parse(raw).fontFamily : undefined;
    if (!userFont || userFont === "sans") {
      const map = { sans: "DM Sans, sans-serif", serif: "Merriweather, serif", mono: "JetBrains Mono, monospace" } as const;
      root.style.setProperty("--font-sans", map[branding.fontFamily]);
    }
  } catch { /* ignore */ }
}

/** Fetches public branding and applies it once. Kept as a tiny component so it
 * can mount inside the app tree and re-run on visibility/route changes. */
export default function BrandingApplier() {
  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then(({ settings }) => { if (!cancelled) applyBranding(settings); })
      .catch(() => { /* non-fatal: keep defaults */ });
    return () => { cancelled = true; };
  }, []);
  return null;
}
