import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { GitBranch, Loader2, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Renders a fenced ```mermaid block as an SVG diagram. Mermaid is loaded
// lazily (dynamic import) so it never bloats the initial bundle, and it is
// themed to match the app's light/dark mode. Reduced-motion users get static
// diagrams (animations are killed via CSS in index.css).
// ---------------------------------------------------------------------------

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default);
  }
  return mermaidPromise;
}

export default function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId();
  const id = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const renderRef = useRef(0);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(mql.matches || document.documentElement.classList.contains("dark"));
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = renderRef.current + 1;
    renderRef.current = run;
    setSvg(null);
    setError(null);

    (async () => {
      try {
        const mermaid = await loadMermaid();
        if (cancelled || renderRef.current !== run) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDark ? "dark" : "base",
          themeVariables: {
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            primaryColor: isDark ? "#134e4a" : "#ccfbf1",
            primaryTextColor: isDark ? "#ccfbf1" : "#134e4a",
            primaryBorderColor: isDark ? "#2dd4bf" : "#14b8a6",
            lineColor: isDark ? "#5eead4" : "#0d9488",
            secondaryColor: isDark ? "#1e293b" : "#f0fdfa",
            tertiaryColor: isDark ? "#0f172a" : "#ffffff",
            background: "transparent",
          },
        });
        const { svg } = await mermaid.render(id, code);
        if (cancelled || renderRef.current !== run) return;
        setSvg(svg);
      } catch (err: any) {
        if (cancelled || renderRef.current !== run) return;
        setError(err?.message ?? "Diagram failed to render");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, isDark, id]);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 my-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-destructive mb-2">
          <AlertTriangle size={14} /> Could not render diagram
        </p>
        <pre className="text-[11px] whitespace-pre-wrap font-mono text-muted-foreground">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card my-4 py-10 text-xs text-muted-foreground">
        <Loader2 size={15} className="animate-spin" /> Rendering diagram…
      </div>
    );
  }

  return (
    <figure className={clsx("mermaid-diagram rounded-xl border border-border bg-card my-4 overflow-x-auto", isDark ? "" : "")}>
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground rounded-t-xl">
        <GitBranch size={11} /> Diagram
      </div>
      <div className="p-4 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}
