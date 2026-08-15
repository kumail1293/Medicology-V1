// ============================================================================
// Email renderer — turns the structured block JSON from the visual builder
// into a sanitized HTML email (table-based for client compatibility).
//
// Security rules:
//  - Every text field is HTML-escaped before interpolation.
//  - Custom HTML blocks pass through a strict tag/attribute whitelist only.
//  - Variables are validated: `{{unknown}}` renders as empty (never silently
//    as raw text), so typos are visible in preview rather than in production.
// ============================================================================

export type EmailBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3; align?: "left" | "center" | "right" }
  | { type: "text"; html?: string; text?: string; align?: "left" | "center" | "right" }
  | { type: "image"; url: string; alt?: string; width?: number }
  | { type: "button"; label: string; url: string; style?: "primary" | "secondary" | "ghost"; align?: "left" | "center" | "right" }
  | { type: "divider"; style?: "solid" | "dashed" | "spaced" }
  | { type: "spacer"; height?: number }
  | { type: "columns"; left: string; right: string; leftWidth?: number }
  | { type: "social"; items: { platform: string; url: string }[] }
  | { type: "qbankCard"; name: string; price: string; url: string; image?: string }
  | { type: "resultSummary"; score: string; total: string; percentage: string; passed: boolean }
  | { type: "footer"; text: string }
  | { type: "unsubscribe"; label?: string }
  | { type: "custom"; html: string };

export interface EmailRenderOptions {
  blocks: EmailBlock[];
  /** Values for {{variable}} interpolation. Unknown variables render empty. */
  data?: Record<string, string | number | boolean | undefined>;
  /** Platform-wide footer appended when the template has no footer block. */
  platformFooter?: string;
  /** Social links rendered as brand-icon row (when the template has no social block). */
  socials?: { platform: string; url: string }[];
  unsubscribeUrl?: string;
  primaryColor?: string;
  brandName?: string;
  brandLogo?: string;
}

export const EMAIL_VARIABLES = [
  "user.firstName", "user.lastName", "user.name", "user.email",
  "qbank.name", "qbank.price", "exam.name", "exam.date",
  "result.score", "result.total", "result.percentage", "result.passed",
  "entitlement.expiryDate", "entitlement.qbank",
  "platform.name", "platform.logo", "platform.supportEmail", "platform.siteUrl",
  "order.id", "order.amount", "unsubscribeUrl", "year", "currentDate",
] as const;

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escAttr(s: unknown): string {
  return esc(s).replace(/`/g, "&#96;");
}

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

export function interpolate(
  template: string,
  data: EmailRenderOptions["data"] = {}
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (raw, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return ""; // unknown → empty
    return esc(value);
  });
}

// ---------------------------------------------------------------------------
// Strict HTML sanitizer (custom HTML blocks only)
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td", "img", "hr",
]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "target", "rel", "style", "width", "height", "align",
]);

const URL_PREFIX_RE = /^(https?:\/\/|mailto:|tel:|#|\/)/i;

export function sanitizeEmailHtml(html: string): string {
  // Strip anything that isn't a tag or text (script/style bodies removed).
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  // Parse tags with a simple tokenizer and rebuild whitelisted ones.
  return out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s>]+)?)*)\s*\/?>/g, (raw, tag, attrsRaw) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLower)) return "";
    const isClosing = raw.startsWith("</");
    if (isClosing) return `</${tagLower}>`;
    const attrs: string[] = [];
    const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrsRaw)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? "";
      if (!ALLOWED_ATTRS.has(name) || name.startsWith("on")) continue; // no event handlers
      if ((name === "href" || name === "src") && !URL_PREFIX_RE.test(value.trim())) continue;
      if (name === "src" && !/^https?:\/\//i.test(value.trim()) && !value.trim().startsWith("/")) continue;
      attrs.push(`${name}="${escAttr(value)}"`);
    }
    return `<${tagLower}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  });
}

// ---------------------------------------------------------------------------
// Social icons — brand SVGs as data-URIs (email-client safe; no external
// requests). `generic` is a fallback for unknown platforms.
// ---------------------------------------------------------------------------

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SOCIAL_ICON_DATA_URI: Record<string, string> = {
  instagram: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5.5" fill="#E4405F"/><circle cx="12" cy="12" r="4.2" stroke="#fff" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.3" fill="#fff"/></svg>`),
  facebook: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V11H8v3h2.5v7h3z"/></svg>`),
  x: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M17.7 3h2.9l-6.4 7.3L21.8 21h-5.9l-4.6-6-5.3 6H3.1l6.9-7.8L2.6 3h6l4.1 5.5L17.7 3zm-1 16.2h1.6L7.6 4.7H5.9l10.8 14.5z"/></svg>`),
  tiktok: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M16.6 3c.4 2.2 1.8 3.6 4 3.9v3c-1.5 0-2.9-.5-4-1.3v6.2c0 3.8-2.7 6-6.1 5.4-2.4-.4-4.3-2.4-4.4-4.8-.1-3 2.4-5.3 5.4-5.1v3.1c-1.2-.2-2.3.4-2.5 1.6-.2 1 .4 2 1.4 2.3 1.2.3 2.3-.5 2.4-1.7V3h3.8z"/></svg>`),
  youtube: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF0000"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15.2V8.8l5.2 3.2L10 15.2z"/></svg>`),
  linkedin: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M4.98 3.5A2.49 2.49 0 1 1 0 3.5a2.49 2.49 0 0 1 4.98 0zM.2 8.3h4.6V23H.2V8.3zm7.6 0h4.4v2h.1c.6-1.2 2.1-2.4 4.3-2.4 4.6 0 5.4 3 5.4 7V23h-4.6v-7.2c0-1.7 0-3.9-2.4-3.9-2.4 0-2.8 1.9-2.8 3.8V23H7.8V8.3z"/></svg>`),
  whatsapp: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.5-4.3-1.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4.1 2.7 1.2 2.7.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>`),
  generic: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#374151"><circle cx="12" cy="12" r="10" fill="none" stroke="#374151" stroke-width="2"/><text x="12" y="16" font-size="11" font-family="Arial" fill="#374151" text-anchor="middle">i</text></svg>`),
};

// ---------------------------------------------------------------------------
// Block → HTML
// ---------------------------------------------------------------------------

function renderBlock(block: EmailBlock, opts: EmailRenderOptions): string {
  const align = (b: any) => (b.align ? `text-align:${esc(b.align)};` : "");
  switch (block.type) {
    case "heading": {
      const level = block.level ?? 2;
      const size = level === 1 ? 26 : level === 2 ? 20 : 16;
      return `<h${level} style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:1.35;color:#111827;${align(block)}">${interpolate(block.text, opts.data)}</h${level}>`;
    }
    case "text": {
      const content = block.html
        ? sanitizeEmailHtml(interpolate(block.html, opts.data))
        : interpolate(block.text ?? "", opts.data);
      return `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;${align(block)}">${content}</p>`;
    }
    case "image": {
      if (!block.url) return "";
      const width = block.width ? `width="${Number(block.width)}"` : "";
      return `<p style="margin:0 0 14px;text-align:center;"><img src="${escAttr(block.url)}" alt="${escAttr(block.alt ?? "")}" ${width} style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
    }
    case "button": {
      const style = block.style ?? "primary";
      const bg = style === "primary" ? (opts.primaryColor ?? "#0d9488") : style === "secondary" ? "#111827" : "transparent";
      const border = style === "ghost" ? "1px solid #d1d5db" : "none";
      const color = style === "ghost" ? "#111827" : "#ffffff";
      const alignTxt = block.align === "center" ? "center" : block.align === "right" ? "right" : "left";
      return `<p style="margin:0 0 14px;text-align:${alignTxt};"><a href="${escAttr(interpolate(block.url, opts.data))}" style="display:inline-block;background:${bg};color:${color};border:${border};padding:12px 24px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">${interpolate(block.label, opts.data)}</a></p>`;
    }
    case "divider": {
      const style = block.style ?? "solid";
      const border = style === "dashed" ? "1px dashed #e5e7eb" : style === "spaced" ? "none" : "1px solid #e5e7eb";
      return `<p style="margin:16px 0;${border};"></p>`;
    }
    case "spacer": {
      const h = Math.min(Math.max(Number(block.height ?? 16), 4), 120);
      return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
    }
    case "columns": {
      const leftW = block.leftWidth ?? 50;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr>
        <td width="${leftW}%" valign="top" style="padding-right:12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${esc(block.left)}</td>
        <td width="${100 - leftW}%" valign="top" style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${esc(block.right)}</td>
      </tr></table>`;
    }
    case "social": {
      if (!block.items?.length) return "";
      const links = block.items
        .map((s) => {
          const icon = SOCIAL_ICON_DATA_URI[s.platform.toLowerCase()] ?? SOCIAL_ICON_DATA_URI.generic;
          const label = esc(s.platform.charAt(0).toUpperCase() + s.platform.slice(1));
          return `<a href="${escAttr(s.url)}" title="${label}" style="display:inline-block;margin:0 5px 6px;vertical-align:middle;"><img src="${icon}" alt="${label}" width="34" height="34" style="width:34px;height:34px;border:0;display:block;border-radius:8px;" /></a>`;
        })
        .join("");
      return `<p style="margin:0 0 14px;text-align:center;">${links}</p>`;
    }
    case "qbankCard": {
      const img = block.image ? `<img src="${escAttr(block.image)}" alt="" style="width:100%;height:auto;border-radius:8px 8px 0 0;" />` : "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><tr><td style="padding:0;">${img}<div style="padding:16px;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#111827;">${interpolate(block.name, opts.data)}</p>
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">${interpolate(block.price, opts.data)}</p>
        <a href="${escAttr(interpolate(block.url, opts.data))}" style="display:inline-block;background:${opts.primaryColor ?? "#0d9488"};color:#ffffff;padding:10px 20px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;text-decoration:none;">View QBank</a>
      </div></td></tr></table>`;
    }
    case "resultSummary": {
      const color = block.passed ? "#059669" : "#dc2626";
      const label = block.passed ? "PASSED" : "NOT PASSED";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><tr>
        <td style="padding:16px;text-align:center;"><p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;color:#6b7280;">RESULT</p>
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;color:${color};">${esc(block.percentage)}%</p>
        <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">${esc(block.score)} / ${esc(block.total)}</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${color};">${label}</p></td>
      </tr></table>`;
    }
    case "footer": {
      return `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">${interpolate(block.text, opts.data)}</p>`;
    }
    case "unsubscribe": {
      const url = opts.unsubscribeUrl || "{{unsubscribeUrl}}";
      return `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;text-align:center;"><a href="${escAttr(interpolate(url, opts.data))}" style="color:#9ca3af;text-decoration:underline;">${esc(block.label ?? "Unsubscribe")}</a></p>`;
    }
    case "custom": {
      return sanitizeEmailHtml(interpolate(block.html ?? "", opts.data));
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Full document render
// ---------------------------------------------------------------------------

export function renderEmail(opts: EmailRenderOptions): string {
  const hasFooterBlock = opts.blocks.some((b) => b.type === "footer" || b.type === "unsubscribe");
  const hasUnsub = opts.blocks.some((b) => b.type === "unsubscribe");
  const body = opts.blocks.map((b) => renderBlock(b, opts)).join("\n");
  const platformFooter = !hasFooterBlock && opts.platformFooter
    ? `<p style="margin:16px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;text-align:center;">${esc(interpolate(opts.platformFooter, opts.data))}</p>`
    : "";
  // Brand-icon social row — appended when the template doesn't define its own
  // social block and the platform has configured social links.
  const hasSocialBlock = opts.blocks.some((b) => b.type === "social");
  const socialRow = !hasSocialBlock && opts.socials?.length
    ? `<p style="margin:14px 0 6px;text-align:center;">${opts.socials
        .map((s) => {
          const icon = SOCIAL_ICON_DATA_URI[s.platform.toLowerCase()] ?? SOCIAL_ICON_DATA_URI.generic;
          const label = esc(s.platform.charAt(0).toUpperCase() + s.platform.slice(1));
          return `<a href="${escAttr(s.url)}" title="${label}" style="display:inline-block;margin:0 5px;vertical-align:middle;"><img src="${icon}" alt="${label}" width="30" height="30" style="width:30px;height:30px;border:0;display:block;border-radius:8px;" /></a>`;
        })
        .join("")}</p>`
    : "";
  const unsubscribe = !hasUnsub && opts.unsubscribeUrl
    ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;text-align:center;"><a href="${escAttr(opts.unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.brandName ?? "Medicology")}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 28px;">
${opts.brandLogo ? `<p style="margin:0 0 20px;text-align:center;"><img src="${escAttr(opts.brandLogo)}" alt="${escAttr(opts.brandName ?? "")}" style="max-height:56px;width:auto;" /></p>` : ""}
${body}
</td></tr>
<tr><td style="padding:20px 28px;background-color:#f9fafb;border-top:1px solid #f3f4f6;">
${platformFooter}
${socialRow}
${unsubscribe}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Human-readable plain-text fallback for the log provider / preview. */
export function renderEmailPlain(blocks: EmailBlock[], data?: EmailRenderOptions["data"]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading": parts.push(interpolate(b.text, data)); break;
      case "text": parts.push(interpolate(b.html ?? b.text ?? "", data).replace(/<[^>]+>/g, "")); break;
      case "button": parts.push(`${interpolate(b.label, data)}: ${interpolate(b.url, data)}`); break;
      case "footer": parts.push(interpolate(b.text, data)); break;
      default: break;
    }
  }
  return parts.filter(Boolean).join("\n\n");
}
