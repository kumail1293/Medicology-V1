import { useMemo } from "react";
import katex from "katex";
import { sortedElements, type CanvasDesign, type CanvasElement } from "@/lib/canvas-design";

// ============================================================================
// CanvasRenderer — renders a CanvasDesign at a fixed pixel size scaled to fit
// its container. Used by the student reader (```canvas blocks), the admin
// note preview and the canvas editor's export surface.
// ============================================================================

function ShapeView({ el }: { el: CanvasElement }) {
  const s = el.style;
  const fill = s.background ?? "#0d9488";
  const stroke = s.borderColor ?? "transparent";
  const strokeW = s.borderWidth ?? 0;
  const radius = s.radius ?? 0;
  switch (el.shape ?? "rect") {
    case "rect":
      return (
        <div style={{ width: "100%", height: "100%", background: fill, borderRadius: 0, border: `${strokeW}px solid ${stroke}` }} />
      );
    case "round":
      return (
        <div style={{ width: "100%", height: "100%", background: fill, borderRadius: radius, border: `${strokeW}px solid ${stroke}` }} />
      );
    case "circle":
      return (
        <div style={{ width: "100%", height: "100%", background: fill, borderRadius: "50%", border: `${strokeW}px solid ${stroke}` }} />
      );
    case "diamond":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,4 96,50 50,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        </svg>
      );
    case "triangle":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="50,4 96,96 4,96" fill={fill} stroke={stroke} strokeWidth={strokeW} />
        </svg>
      );
    case "line":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke={stroke || "#0f172a"} strokeWidth={Math.max(2, strokeW)} />
        </svg>
      );
    default:
      return null;
  }
}

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

function ElementView({ el }: { el: CanvasElement }) {
  const s = el.style;
  const common: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "center",
    opacity: el.opacity,
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
            markerEnd={el.arrowEnd ? `url(#arrow-${el.id})` : undefined}
            markerStart={el.arrowStart ? `url(#arrow-${el.id})` : undefined}
          />
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
    return (
      <div style={common} className="canvas-img" >
        {el.src ? (
          <img src={el.src} alt={el.alt ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: s.radius ?? 0, border: `${s.borderWidth ?? 0}px solid ${s.borderColor ?? "transparent"}` }} />
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
      <div style={{ ...common, overflow: "hidden" }}>
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
  return (
    <div
      style={{
        ...common,
        overflow: "hidden",
        display: "flex",
        alignItems: isHeading ? "center" : "flex-start",
        justifyContent: s.textAlign === "center" ? "center" : s.textAlign === "right" ? "flex-end" : "flex-start",
        padding: "0.1em",
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
        }}
      >
        {el.content}
      </div>
    </div>
  );
}

export default function CanvasRenderer({ design, scale, style }: {
  design: CanvasDesign;
  /** 0–1 scale factor — rendered size = design.size × scale. */
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
        {elements.map((el) => <ElementView key={el.id} el={el} />)}
      </div>
    </div>
  );
}
