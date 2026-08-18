import { useMemo, useRef, useState, useEffect } from "react";
import { X, Download, Loader2, Share2, Instagram, Twitter, Youtube, Music, Facebook, Linkedin, Check } from "lucide-react";
import { clsx } from "clsx";
import { usePlatformConfig } from "@/lib/platformConfig";
import { useToast } from "@/hooks/use-toast";
import { SHARE_PRESETS, downloadPng, getHandleFromUrl, type SharePreset } from "@/lib/note-share";
import { getExcerpt } from "@/lib/note-utils";

interface NoteLike {
  id: number;
  title: string;
  slug: string;
  subject: string;
  content: string;
  tags: string[];
}

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  instagram: Instagram, x: Twitter, twitter: Twitter, youtube: Youtube,
  tiktok: Music, facebook: Facebook, linkedin: Linkedin,
};

function shade(hex: string, percent: number): string {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return percent < 0 ? "#0b5f57" : "#149a8d";
  const num = parseInt(h, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function ShareCard({ note, preset, cardRef, excerptOverride }: { note: NoteLike; preset: SharePreset; cardRef: React.RefObject<HTMLDivElement | null>; excerptOverride?: string }) {
  const config = usePlatformConfig();
  const branding = config.branding ?? {};
  const primary = branding.primaryColor || "#0d9488";
  const logoUrl = branding.logoUrl || "/images/logo-colored.png";
  const brandName = config.general?.siteName || "Medicology";
  const tagline = config.general?.tagline || "Master your medical knowledge.";
  const socials = Array.isArray(config.footer?.socials) ? config.footer.socials : [];
  const keySocials = socials
    .filter((s) => ["instagram", "x", "twitter", "youtube", "tiktok", "facebook", "linkedin"].includes(s.platform))
    .slice(0, 4);

  // Custom selection wins; otherwise auto-derive from the note body.
  const excerpt = useMemo(() => {
    if (excerptOverride && excerptOverride.trim()) return excerptOverride.trim();
    return getExcerpt(note.content, preset.excerptChars);
  }, [note.content, preset.excerptChars, excerptOverride]);
  const title = note.title;
  const titleEm =
    title.length > 80 ? preset.titleSize * 0.72
      : title.length > 50 ? preset.titleSize * 0.88
        : preset.titleSize;
  const isTall = preset.height / preset.width > 1.3;
  const padEm = isTall ? 3.4 : 3;
  const fontSize = preset.scale * 16;

  const gradient = `linear-gradient(152deg, ${primary} 0%, ${shade(primary, -26)} 52%, ${shade(primary, -44)} 100%)`;

  return (
    <div
      ref={cardRef}
      style={{
        width: preset.width,
        height: preset.height,
        fontSize,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#ffffff",
        background: gradient,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: `${padEm}em ${padEm * 1.05}em`,
      }}
    >
      {/* Decorative glows */}
      <div style={{ position: "absolute", top: "-12%", right: "-14%", width: "46%", height: "34%", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,255,255,0.16), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-18%", left: "-10%", width: "52%", height: "40%", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,0,0,0.18), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "0", left: "0", right: "0", height: "0.35em", background: "rgba(255,255,255,0.28)" }} />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.1em", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1em", minWidth: 0 }}>
          <div style={{ width: "3em", height: "3em", borderRadius: "0.85em", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            <img src={logoUrl} alt="" style={{ width: "2.1em", height: "2.1em", objectFit: "contain" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.05em", letterSpacing: "0.16em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {brandName}
            </div>
            <div style={{ fontSize: "0.72em", color: "rgba(255,255,255,0.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "26em" }}>
              {tagline}
            </div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "999px", padding: "0.5em 1.1em", fontSize: "0.74em", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {note.subject}
        </div>
      </div>

      {/* Middle — title + excerpt */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "0.5em" }}>
        <div style={{ fontSize: "0.7em", fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.62)" }}>
          High-Yield Study Notes
        </div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: `${titleEm}em`, lineHeight: 1.08, margin: "0.55em 0 0", maxWidth: "94%" }}>
          {title}
        </h1>
        {excerpt && (
          <p style={{ margin: "1em 0 0", fontSize: excerptOverride ? "0.94em" : "1.02em", lineHeight: 1.6, color: "rgba(255,255,255,0.88)", maxWidth: "94%", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: excerptOverride ? preset.excerptLines + 3 : preset.excerptLines, overflow: "hidden" }}>
            {excerpt}
          </p>
        )}
        {Array.isArray(note.tags) && note.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6em", marginTop: "1.3em" }}>
            {note.tags.slice(0, 5).map((t) => (
              <span key={t} style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "999px", padding: "0.42em 0.95em", fontSize: "0.72em", fontWeight: 600 }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom — branding + socials */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.28)", paddingTop: "1.3em" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1em" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.18em", letterSpacing: "0.02em" }}>
            medicology.net
          </div>
          <div style={{ fontSize: "0.78em", color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
            Preparing tomorrow's doctors
          </div>
        </div>
        {keySocials.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.9em 1.4em", marginTop: "0.95em" }}>
            {keySocials.map((s) => {
              const Icon = SOCIAL_ICONS[s.platform] ?? Share2;
              return (
                <span key={s.platform} style={{ display: "inline-flex", alignItems: "center", gap: "0.5em", fontSize: "0.9em", fontWeight: 700, color: "#ffffff" }}>
                  <Icon size={18} style={{ color: "#ffffff" }} />
                  {getHandleFromUrl(s.url)}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NoteShareModal({ note, open, onClose, excerpt }: {
  note: NoteLike | null;
  open: boolean;
  onClose: () => void;
  /** Custom share text — when provided, the card shows this instead of the auto excerpt. */
  excerpt?: string | null;
}) {
  const { toast } = useToast();
  const [presetId, setPresetId] = useState("instagram-post");
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const preset = SHARE_PRESETS.find((p) => p.id === presetId) ?? SHARE_PRESETS[0];

  // Reset to a sensible default when opening for a new note.
  useEffect(() => {
    if (open) setPresetId("instagram-post");
  }, [open, note?.id]);

  const previewScale = Math.min(330 / preset.width, 430 / preset.height, 0.45);

  const handleDownload = async () => {
    if (!cardRef.current || !note) return;
    setDownloading(true);
    try {
      await downloadPng(cardRef.current, `medicology-${note.slug || note.id}-${preset.id}.png`);
      toast({ title: "Shared", description: `Image saved — ${preset.label} (${preset.width}×${preset.height}px).` });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Could not generate the image", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (!open || !note) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Share2 size={18} className="text-primary" /> Share as image
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {excerpt
                ? "Sharing your selected passage — branded with the Medicology logo, handles &amp; links."
                : "Branded card with the Medicology logo, handles &amp; links — sized for each platform."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[240px_1fr]">
          {/* Preset list */}
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto">
            {SHARE_PRESETS.map((p) => {
              const active = p.id === presetId;
              return (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  className={clsx(
                    "flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all lg:w-full",
                    active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {active ? <Check size={15} /> : <Instagram size={15} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{p.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {p.width}×{p.height} · {p.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 p-4">
              <div
                style={{ width: preset.width * previewScale, height: preset.height * previewScale, overflow: "hidden", position: "relative" }}
              >
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
                  <ShareCard note={note} preset={preset} cardRef={cardRef} excerptOverride={excerpt ?? undefined} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {preset.label} · {preset.width}×{preset.height}px · {preset.scale === 1 ? "2× quality on export" : `${Math.round(preset.scale * 100)}% scale`}
              </p>
              <button
                onClick={() => void handleDownload()}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {downloading ? "Generating…" : "Download PNG"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
