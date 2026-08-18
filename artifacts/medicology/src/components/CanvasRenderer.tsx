import { useMemo } from "react";
import katex from "katex";
import { sortedElements, type CanvasDesign, type CanvasElement } from "@/lib/canvas-design";

// ============================================================================
// CanvasRenderer — renders a CanvasDesign at a fixed pixel size scaled to fit
// its container. Supports shadows, image filters, background patterns,
// border styles, and an optional branded watermark overlay.
// ============================================================================

// ── Background pattern overlay ─────────────────────────────────────────────

function PatternOverlay({ pattern, color, opacity }: { pattern?: string; color?: string; opacity?: number }) {
  if (!pattern || pattern === "none") return null;
  const c = color ?? "#000000";
  const o = opacity ?? 0.06;
  const svgPatterns: Record<string, string> = {
    grid: `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M0 40V0h40" fill="none" stroke="${c}" stroke-width="1" opacity="${o}"/></svg>`,
    dots: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="1.5" fill="${c}" opacity="${o}"/></svg>`,
    lines: `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M0 20L20 0" stroke="${c}" stroke-width="1" opacity="${o}"/></svg>`,
    diagonal: `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M0 16L16 0" stroke="${c}" stroke-width="1" opacity="${o * 1.5}"/></svg>`,
  };
  const svg = svgPatterns[pattern];
  if (!svg) return null;
  const encoded = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return <div style={{ position: "absolute", inset: 0, backgroundImage: encoded, pointerEvents: "none" }} />;
}

// ── Branding watermark ─────────────────────────────────────────────────────

function BrandingOverlay({ branding }: { branding?: CanvasDesign["branding"] }) {
  if (!branding?.enabled) return null;
  const pos = branding.position ?? "bottom-right";
  const op = branding.opacity ?? 0.7;
  const posStyle: React.CSSProperties = {};
  if (pos.includes("top")) posStyle.top = 12;
  if (pos.includes("bottom")) posStyle.bottom = 12;
  if (pos.includes("left")) posStyle.left = 16;
  if (pos.includes("right")) posStyle.right = 16;
  if (pos === "bottom-center") { posStyle.bottom = 12; posStyle.left = "50%"; posStyle.transform = "translateX(-50%)"; }
  return (
    <div style={{ position: "absolute", ...posStyle, display: "flex", alignItems: "center", gap: 8, opacity: op, pointerEvents: "none", zIndex: 9999 }}>
      {branding.logo && <img src={branding.logo} alt="Medicology" style={{ height: 28, objectFit: "contain" }} />}
      {branding.name && <span style={{ fontFamily: "Outfit", fontSize: 14, fontWeight: 700, color: "#0f172a", background: "rgba(255,255,255,0.85)", padding: "3px 10px", borderRadius: 8 }}>{branding.name}</span>}
      {branding.social && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: 6 }}>{branding.social}</span>}
    </div>
  );
}

// ── Shape views ────────────────────────────────────────────────────────────

function ShapeView({ el }: { el: CanvasElement }) {
  const s = el.style;
  const fill = s.background ?? "#0d9488";
  const stroke = s.borderColor ?? "transparent";
  const strokeW = s.borderWidth ?? 0;
  const strokeDash = s.borderStyle === "dashed" ? "8,4" : s.borderStyle === "dotted" ? "3,3" : s.borderStyle === "double" ? undefined : undefined;
  const radius = s.radius ?? 0;
  const shadow = s.shadow ?? "none";
  const borderStyle = s.borderStyle ?? "solid";

  const divStyle: React.CSSProperties = {
    width: "100%", height: "100%", background: fill,
    borderRadius: el.shape === "line" ? 0 : radius,
    border: `${strokeW}px ${borderStyle} ${stroke}`,
    boxShadow: shadow,
  };

  if (s.backgroundGradient) {
    divStyle.background = `linear-gradient(${s.backgroundGradient.angle ?? 135}deg, ${s.backgroundGradient.from}, ${s.backgroundGradient.to})`;
  }

  switch (el.shape ?? "rect") {
    case "rect":
      return <div style={divStyle} />;
    case "round":
      return <div style={{ ...divStyle, borderRadius: radius || 16 }} />;
    case "circle":
      return <div style={{ ...divStyle, borderRadius: "50%" }} />;
    case "diamond":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,4 96,50 50,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={strokeDash} />
        </svg>
      );
    case "triangle":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,4 96,96 4,96" fill={fill} stroke={stroke} strokeWidth={strokeW} strokeDasharray={strokeDash} />
        </svg>
      );
    case "line":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke={stroke || "#0f172a"} strokeWidth={Math.max(2, strokeW)} strokeDasharray={strokeDash} />
        </svg>
      );
    default:
      return null;
  }
}

// ── Math view ──────────────────────────────────────────────────────────────

function MathView({ latex, fontSize }: { latex: string; fontSize: number }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false, output: "html" });
    } catch {
      return `<code>${latex}</code>`;
    }
  }, [latex]);
  return <div className="katex-wrap" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Image filter CSS ───────────────────────────────────────────────────────

function imageFilterCSS(filters?: Record<string, number>): string {
  if (!filters) return "none";
  const parts: string[] = [];
  if (filters.brightness != null && filters.brightness !== 1) parts.push(`brightness(${filters.brightness})`);
  if (filters.contrast != null && filters.contrast !== 1) parts.push(`contrast(${filters.contrast})`);
  if (filters.saturate != null && filters.saturate !== 1) parts.push(`saturate(${filters.saturate})`);
  if (filters.blur != null && filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  if (filters.grayscale != null && filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale})`);
  if (filters.sepia != null && filters.sepia > 0) parts.push(`sepia(${filters.sepia})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

// ── Element view ───────────────────────────────────────────────────────────

function ElementView({ el }: { el: CanvasElement }) {
  const s = el.style;
  const shadow = s.shadow ?? "none";
  const common: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "center",
    opacity: el.opacity,
    boxShadow: shadow,
  };

  if (el.type === "arrow") {
    const x1 = (el.x1 ?? 0) + el.x;
    const y1 = (el.y1 ?? 0) + el.y;
    const x2 = (el.x2 ?? el.w) + el.x;
    const y2 = (el.y2 ?? el.h) + el.y;
    const stroke = s.borderColor ?? "#0f172a";
    const width = Math.max(2, s.borderWidth ?? 4);
    return (
      <div style={{ ...common, pointerEvents: "none" }}>
        <svg width={el.w} height={el.h} style={{ overflow: "visible", position: "absolute", left: 0, top: 0 }}>
          <defs>
            <marker id={`arrow-${el.id}`} markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L8,4 L0,8 Z" fill={stroke} />
            </marker>
          </defs>
          <line
            x1={x1 - el.x} y1={y1 - el.y} x2={x2 - el.x} y2={y2 - el.y}
            stroke={stroke} strokeWidth={width}
            strokeDasharray={s.borderStyle === "dashed" ? "8,4" : s.borderStyle === "dotted" ? "3,3" : undefined}
            markerEnd={el.arrowEnd ? `url(#arrow-${el.id})` : undefined}
            markerStart={el.arrowStart ? `url(#arrow-${el.id})` : undefined} />
        </svg>
        {el.arrowLabel && (
          <div
            style={{
              position: "absolute",
              left: (x1 + x2) / 2 - el.x,
              top: (y1 + y2) / 2 - el.y - 14,
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.85)",
              padding: "2px 8px",
              borderRadius: 8,
              fontSize: Math.max(12, (s.fontSize ?? 20) * 0.6),
              fontWeight: 700,
              color: s.color ?? "#0f172a",
              whiteSpace: "nowrap",
            }}
          >
            {el.arrowLabel}
          </div>
        )}
      </div>
    );
  }

  if (el.type === "image") {
    const filterStr = imageFilterCSS(el.filters as Record<string, number> | undefined);
    const imgShadow = s.shadow ?? "none";
    return (
      <div style={common} className="canvas-img">
        {el.src ? (
          <img src={el.src} alt={el.alt ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: s.radius ?? 0, border: `${s.borderWidth ?? 0}px solid ${s.borderColor ?? "transparent"}`, filter: filterStr, boxShadow: imgShadow }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: s.background ?? "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>Image</div>
        )}
      </div>
    );
  }

  if (el.type === "shape") {
    return <div style={common}><ShapeView el={el} /></div>;
  }

  if (el.type === "math") {
    return (
      <div style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <MathView latex={el.content} fontSize={s.fontSize ?? 36} />
      </div>
    );
  }

  if (el.type === "list") {
    return (
      <div style={{ ...common, overflow: "hidden", boxShadow: shadow }}>
        <ul style={{ margin: 0, paddingLeft: "1.2em", fontFamily: s.fontFamily, fontSize: s.fontSize ?? 26, fontWeight: s.fontWeight ?? 500, color: s.color ?? "#0f172a", lineHeight: s.lineHeight ?? 1.5, letterSpacing: s.letterSpacing ?? 0 }}>
          {(el.items ?? []).map((it, i) => (
            <li key={i} style={{ marginBottom: "0.25em" }}>{it}</li>
          ))}
        </ul>
      </div>
    );
  }

  // text / heading
  const isHeading = el.type === "heading";
  const textShadow = s.textShadow ?? "none";
  return (
    <div
      style={{
        ...common,
        overflow: "hidden",
        display: "flex",
        alignItems: isHeading ? "center" : "flex-start",
        justifyContent: s.textAlign === "center" ? "center" : s.textAlign === "right" ? "flex-end" : "flex-start",
        padding: s.padding ? `${s.padding}px` : "0.1em",
      }}
    >
      <div
        style={{
          width: "100%",
          fontFamily: s.fontFamily ?? "DM Sans",
          fontSize: s.fontSize ?? (isHeading ? 56 : 26),
          fontWeight: s.fontWeight ?? (isHeading ? 800 : 400),
          fontStyle: s.fontStyle ?? "normal",
          color: s.color ?? "#0f172a",
          textAlign: s.textAlign ?? (isHeading ? "center" : "left"),
          lineHeight: s.lineHeight ?? 1.25,
          letterSpacing: s.letterSpacing ?? 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textShadow,
        }}
      >
        {el.content}
      </div>
    </div>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────

export default function CanvasRenderer({ design, scale, style }: {
  design: CanvasDesign;
  scale: number;
  style?: React.CSSProperties;
}) {
  const elements = useMemo(() => sortedElements(design), [design]);
  const w = Math.round(design.width * scale);
  const h = Math.round(design.height * scale);

  let background: React.CSSProperties = {};
  if (design.background.gradientFrom && design.background.gradientTo) {
    background = { background: `linear-gradient(152deg, ${design.background.gradientFrom}, ${design.background.gradientTo})` };
  } else if (design.background.image) {
    background = { backgroundImage: `url(${design.background.image})`, backgroundSize: "cover", backgroundPosition: "center" };
  } else {
    background = { background: design.background.color ?? "#ffffff" };
  }

  return (
    <div style={{ width: w, height: h, overflow: "hidden", position: "relative", flexShrink: 0, ...background, ...style }}>
      <div style={{ width: design.width, height: design.height, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        <PatternOverlay pattern={design.background.pattern} color={design.background.patternColor} opacity={design.background.patternOpacity} />
        {elements.map((el) => <ElementView key={el.id} el={el} />)}
        <BrandingOverlay branding={design.branding} />
      </div>
    </div>
  );
}
