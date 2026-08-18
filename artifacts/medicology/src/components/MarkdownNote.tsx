import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";
import MermaidDiagram from "./MermaidDiagram";
import {
  classifyCallout,
  slugify,
  type CalloutInfo,
  type CalloutTone,
} from "@/lib/note-utils";
import {
  Lightbulb,
  Brain,
  AlertTriangle,
  Target,
  Stethoscope,
  ShieldAlert,
  Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// MarkdownNote — renders a study-note markdown body with a textbook-quality
// typography layer:
//   • GFM tables (remark-gfm) with card styling
//   • Blockquotes that open with a marker word/emoji become colored callouts
//     (Tip / Mnemonic / Trap / High-Yield / Clinical Pearl / Warning)
//   • ```mermaid fenced blocks render as live diagrams
//   • Images render rounded with optional captions, lazy-loaded
//   • h2/h3 get slug anchors for the table of contents
//   • Task lists render with real checkboxes
// ---------------------------------------------------------------------------

const TONE_STYLES: Record<
  CalloutTone,
  { chip: string; box: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  tip: {
    chip: "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/25",
    box: "border-blue-500/25 bg-blue-500/[0.06]",
    icon: Lightbulb,
  },
  mnemonic: {
    chip: "bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/25",
    box: "border-purple-500/25 bg-purple-500/[0.06]",
    icon: Brain,
  },
  trap: {
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    box: "border-amber-500/30 bg-amber-500/[0.07]",
    icon: AlertTriangle,
  },
  highYield: {
    chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    box: "border-emerald-500/25 bg-emerald-500/[0.06]",
    icon: Target,
  },
  pearl: {
    chip: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/25",
    box: "border-cyan-500/25 bg-cyan-500/[0.06]",
    icon: Stethoscope,
  },
  warning: {
    chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25",
    box: "border-rose-500/25 bg-rose-500/[0.06]",
    icon: ShieldAlert,
  },
  note: {
    chip: "bg-slate-500/12 text-slate-600 dark:text-slate-300 border-slate-500/25",
    box: "border-slate-500/25 bg-slate-500/[0.06]",
    icon: Info,
  },
};

/* ── Flatten React children to plain text ─────────────────────────────────── */
function flattenText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (React.isValidElement(node)) {
    return flattenText((node.props as any).children);
  }
  return "";
}

function toArray(node: React.ReactNode): React.ReactNode[] {
  return Array.isArray(node) ? node : [node];
}

// The paragraph / strong renderers used by the components map below. We
// compare element identity against these (rather than the "p"/"strong" tag
// strings) because react-markdown v10 substitutes the custom component as the
// element type inside nested structures like blockquotes.
const P = ({ children }: any) => <p className="note-p">{children}</p>;
const Strong = ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>;

function isType(node: React.ReactNode, type: React.ElementType): boolean {
  return React.isValidElement(node) && (node as React.ReactElement).type === type;
}

function firstParagraph(children: React.ReactNode): React.ReactElement | null {
  for (const c of toArray(children)) {
    if (isType(c, P)) return c as React.ReactElement;
  }
  return null;
}

function detectCallout(children: React.ReactNode): CalloutInfo | null {
  const p = firstParagraph(children);
  if (!p) return null;
  return classifyCallout(flattenText((p.props as any).children));
}

/** Drop the marker (emoji + label) from the first paragraph of a callout. */
function stripMarker(children: React.ReactNode): React.ReactNode {
  const arr = toArray(children);
  const idx = arr.findIndex((c) => isType(c, P));
  if (idx === -1) return children;
  const p = arr[idx] as React.ReactElement<{ children?: React.ReactNode }>;
  let pChildren = toArray(p.props.children ?? []);

  // 1. Leading emoji text node → remove just the emoji.
  const first = pChildren[0];
  if (typeof first === "string" && /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+/u.test(first.trim())) {
    const rest = first.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+\s*/u, "");
    pChildren = [rest, ...pChildren.slice(1)];
  }
  // 2. Leading <strong>Label:</strong> node → drop it.
  if (pChildren[0] && isType(pChildren[0], Strong)) {
    if (classifyCallout(flattenText(pChildren[0]))) {
      pChildren = pChildren.slice(1);
    }
  }
  // 3. Plain "Label: …" text → strip the label if it classifies as a marker.
  if (typeof pChildren[0] === "string") {
    const m = pChildren[0].match(/^([A-Za-z][A-Za-z -]*?):\s*/);
    if (m && classifyCallout(m[1])) {
      pChildren[0] = pChildren[0].slice(m[0].length);
    }
  }
  // 4. Clean up stray leading punctuation.
  if (typeof pChildren[0] === "string") {
    pChildren[0] = pChildren[0].replace(/^[:,\s]+/, "");
  }

  // If the whole first paragraph was just the marker, drop the empty <p>.
  if (pChildren.length === 0 || (pChildren.length === 1 && typeof pChildren[0] === "string" && pChildren[0].trim() === "")) {
    const next = [...arr];
    next.splice(idx, 1);
    return next;
  }

  const next = [...arr];
  next[idx] = React.cloneElement(p, {
    children: pChildren.length === 1 ? pChildren[0] : pChildren,
  });
  return next;
}

function CalloutBlock({ children }: { children?: React.ReactNode }) {
  const info = detectCallout(children);
  if (!info) {
    return (
      <blockquote className="my-4 border-l-4 border-border bg-card rounded-r-xl px-4 py-3 text-muted-foreground">
        {children}
      </blockquote>
    );
  }
  const tone = TONE_STYLES[info.tone];
  const Icon = tone.icon;
  return (
    <div className={clsx("callout my-4 rounded-xl border px-4 py-3.5", tone.box)}>
      <div className="flex items-start gap-2.5">
        <span className={clsx("mt-0.5 shrink-0 rounded-md border p-1", tone.chip)}>
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p className={clsx("mb-1 text-[11px] font-extrabold uppercase tracking-wider", tone.chip.split(" ").slice(0, 3).join(" "))}>
            {info.label}
          </p>
          <div className="callout-body [&>p]:my-0">{stripMarker(children)}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Heading with slug anchor ─────────────────────────────────────────────── */
function Heading({ level, children, className }: { level: 2 | 3; children?: React.ReactNode; className?: string }) {
  const id = slugify(flattenText(children));
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag id={id} className={className}>{children}</Tag>;
}

const components: any = {
  h2: ({ children }: any) => (
    <Heading level={2} className="note-h2 scroll-mt-28">{children}</Heading>
  ),
  h3: ({ children }: any) => (
    <Heading level={3} className="note-h3 scroll-mt-28">{children}</Heading>
  ),
  p: P,
  strong: Strong,
  em: ({ children }: any) => <em>{children}</em>,
  del: ({ children }: any) => <del className="text-muted-foreground">{children}</del>,
  hr: () => <hr className="my-6 border-border" />,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
      {children}
    </a>
  ),
  ul: ({ children, className }: any) => (
    <ul className={clsx("note-ul", className)}>{children}</ul>
  ),
  ol: ({ children }: any) => <ol className="note-ol">{children}</ol>,
  li: ({ children, className }: any) => (
    <li className={clsx("note-li", className)}>{children}</li>
  ),
  blockquote: ({ children }: any) => <CalloutBlock>{children}</CalloutBlock>,
  table: ({ children }: any) => (
    <div className="note-table-wrap my-4 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="note-table w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: any) => <th className="note-th">{children}</th>,
  td: ({ children }: any) => <td className="note-td">{children}</td>,
  img: ({ src, alt, title }: any) => (
    <figure className="my-4">
      <img
        src={src}
        alt={alt ?? ""}
        title={title}
        loading="lazy"
        className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl border border-border shadow-sm"
      />
      {title && <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{title}</figcaption>}
    </figure>
  ),
  pre: ({ children }: any) => {
    const child = React.Children.toArray(children)[0] as React.ReactElement | undefined;
    const childProps = (child?.props ?? {}) as any;
    const lang = /language-(\w+)/.exec(String(childProps.className ?? ""))?.[1];
    if (lang === "mermaid") {
      return <MermaidDiagram code={String(childProps.children ?? "").replace(/\n$/, "")} />;
    }
    return <pre className="my-4 overflow-x-auto rounded-xl border border-border bg-muted/50 p-4 text-[13px] leading-relaxed">{children}</pre>;
  },
  code: ({ className, children }: any) => {
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    if (lang === "mermaid") {
      return <MermaidDiagram code={String(children ?? "").replace(/\n$/, "")} />;
    }
    return <code className="note-inline-code">{children}</code>;
  },
  input: ({ checked, disabled }: any) => (
    <input type="checkbox" checked={!!checked} disabled={disabled} className="mr-2 h-3.5 w-3.5 rounded border-border accent-[var(--color-primary)] align-middle" readOnly />
  ),
};

export default function MarkdownNote({ content, className }: { content: string; className?: string }) {
  return (
    <div className={clsx("note-body", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
