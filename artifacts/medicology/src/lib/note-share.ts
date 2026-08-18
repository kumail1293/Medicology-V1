import { toPng } from "html-to-image";

// ============================================================================
// Note export — share cards sized per social platform and branded PDF export.
// The share card is authored at real pixel dimensions (em-based scaling) and
// rasterized with html-to-image; the PDF opens a dedicated print window with a
// light, branded layout so output is identical in light/dark app themes.
// ============================================================================

export interface SharePreset {
  id: string;
  label: string;
  hint: string;
  width: number;
  height: number;
  excerptChars: number;
  /** Font-scale relative to the 1080px design base. */
  scale: number;
  titleSize: number; // em, at base scale
  excerptLines: number;
}

export const SHARE_PRESETS: SharePreset[] = [
  {
    id: "instagram-post", label: "Instagram Post", hint: "4:5 feed post", width: 1080, height: 1350,
    excerptChars: 300, scale: 1, titleSize: 2.35, excerptLines: 7,
  },
  {
    id: "instagram-story", label: "Instagram Story", hint: "9:16 full screen", width: 1080, height: 1920,
    excerptChars: 460, scale: 1, titleSize: 2.9, excerptLines: 11,
  },
  {
    id: "x", label: "X / Twitter", hint: "16:9 card", width: 1200, height: 675,
    excerptChars: 190, scale: 1.111, titleSize: 1.9, excerptLines: 4,
  },
  {
    id: "facebook", label: "Facebook", hint: "1.91:1 link card", width: 1200, height: 630,
    excerptChars: 200, scale: 1.111, titleSize: 1.9, excerptLines: 4,
  },
  {
    id: "linkedin", label: "LinkedIn", hint: "1.91:1 post", width: 1200, height: 627,
    excerptChars: 200, scale: 1.111, titleSize: 1.9, excerptLines: 4,
  },
  {
    id: "square", label: "Square", hint: "1:1 — WhatsApp & stories", width: 1080, height: 1080,
    excerptChars: 260, scale: 1, titleSize: 2.2, excerptLines: 6,
  },
];

/** Derive the @handle from a social profile URL. */
export function getHandleFromUrl(url: string): string {
  const clean = url.replace(/\/+$/, "");
  const parts = clean.split("/");
  let handle = parts[parts.length - 1] || parts[parts.length - 2] || "";
  if (!handle.startsWith("@")) handle = `@${handle}`;
  return handle;
}

export function downloadPng(node: HTMLElement, fileName: string) {
  return toPng(node, {
    width: node.offsetWidth,
    height: node.offsetHeight,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#0d9488",
  }).then((dataUrl) => {
    const a = document.createElement("a");
    a.download = fileName;
    a.href = dataUrl;
    a.click();
  });
}

// ---------------------------------------------------------------------------
// Branded PDF — opens a dedicated print window with a light theme so the PDF
// looks identical regardless of the app's dark/light mode. The fully-rendered
// note HTML (including mermaid SVGs) is cloned from the live reading view,
// absolutized, and written into a self-contained document with a branded
// header (logo + title) and footer (domain, socials, copyright).
// ---------------------------------------------------------------------------

export interface PdfExportOptions {
  title: string;
  subject: string;
  brandName: string;
  tagline: string;
  domain: string;
  logoUrl: string;
  supportEmail: string;
  copyright: string;
  socialHandles: { platform: string; handle: string; url: string }[];
  bodySource: HTMLElement;
}

function absolutize(root: ParentNode) {
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src");
    if (src && !/^(https?:|data:|blob:)/i.test(src)) {
      img.setAttribute("src", new URL(src, window.location.origin).toString());
    }
  }
  for (const a of Array.from(root.querySelectorAll("a"))) {
    const href = a.getAttribute("href");
    if (href && !/^(https?:|mailto:|tel:)/i.test(href)) {
      a.setAttribute("href", new URL(href, window.location.origin).toString());
    }
  }
}

export function exportNotePdf(opts: PdfExportOptions) {
  const printWin = window.open("", "_blank", "width=960,height=1180");
  if (!printWin) return false;

  const body = opts.bodySource.cloneNode(true) as HTMLElement;
  absolutize(body);

  const socialsHtml = opts.socialHandles
    .map(
      (s) =>
        `<a href="${escapeHtml(s.url)}" style="color:#475569;text-decoration:none">${escapeHtml(s.handle)}</a>`
    )
    .join("&nbsp;&nbsp;·&nbsp;&nbsp;");

  const css = `
    * { box-sizing: border-box; }
    @page { size: A4; margin: 20mm 15mm 18mm; }
    html, body { margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, 'Segoe UI', sans-serif; color: #0f172a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pdf-header { position: fixed; top: 0; left: 0; right: 0; height: 14mm; display: flex; align-items: center; gap: 10px; padding: 0 15mm; border-bottom: 2px solid #0d9488; background: #fff; z-index: 10; }
    .pdf-header img { height: 9mm; width: auto; object-fit: contain; }
    .pdf-header .brand { font-weight: 800; font-size: 13px; letter-spacing: 0.06em; color: #0d9488; text-transform: uppercase; }
    .pdf-header .doc-title { margin-left: auto; font-size: 11px; color: #475569; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pdf-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 15mm; border-top: 1px solid #e2e8f0; background: #fff; font-size: 10px; color: #475569; z-index: 10; }
    .pdf-footer a { color: #0d9488; text-decoration: none; font-weight: 600; }
    .pdf-content { padding: 6mm 0 4mm; }
    .pdf-title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; line-height: 1.2; color: #0f172a; margin: 0 0 6px; }
    .pdf-meta { font-size: 11px; color: #0d9488; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
    .pdf-body { font-size: 12.5px; line-height: 1.65; }
    .pdf-body h2 { font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; color: #0f172a; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .pdf-body h3 { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: #0f172a; margin: 14px 0 6px; }
    .pdf-body p { margin: 0 0 10px; }
    .pdf-body ul, .pdf-body ol { margin: 0 0 10px; padding-left: 20px; }
    .pdf-body li { margin-bottom: 3px; }
    .pdf-body strong { color: #0f172a; }
    .pdf-body a { color: #0d9488; text-decoration: none; }
    .pdf-body table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 11.5px; page-break-inside: avoid; }
    .pdf-body th { background: #f0fdfa; color: #134e4a; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #ccfbf1; }
    .pdf-body td { padding: 5px 8px; border: 1px solid #e2e8f0; }
    .pdf-body tr:nth-child(even) td { background: #f8fafc; }
    .pdf-body blockquote, .callout { margin: 10px 0 14px; padding: 8px 12px; border-left: 4px solid #0d9488; background: #f0fdfa; border-radius: 0 8px 8px 0; page-break-inside: avoid; }
    .pdf-body blockquote p, .callout p { margin: 0; }
    .pdf-body code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 4px; }
    .pdf-body pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; overflow-x: auto; page-break-inside: avoid; }
    .pdf-body pre code { background: none; border: none; padding: 0; }
    .pdf-body img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; }
    .pdf-body svg { max-width: 100%; height: auto; }
    .pdf-body hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
    .pdf-body .mermaid-diagram { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin: 10px 0 14px; background: #fff; page-break-inside: avoid; }
    .pdf-body input[type="checkbox"] { margin-right: 6px; }
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)} — ${escapeHtml(opts.brandName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
  <div class="pdf-header">
    ${opts.logoUrl ? `<img src="${escapeHtml(absUrl(opts.logoUrl))}" alt="" onerror="this.remove()" />` : ""}
    <span class="brand">${escapeHtml(opts.brandName)}</span>
    <span class="doc-title">${escapeHtml(opts.title)}</span>
  </div>
  <div class="pdf-content">
    <div class="pdf-title">${escapeHtml(opts.title)}</div>
    <div class="pdf-meta">${escapeHtml(opts.subject)} · High-Yield Study Notes</div>
    <div class="pdf-body">${body.innerHTML}</div>
  </div>
  <div class="pdf-footer">
    <span><strong style="color:#0d9488">${escapeHtml(opts.domain)}</strong> &nbsp;·&nbsp; ${escapeHtml(opts.supportEmail)}</span>
    <span>Follow us: ${socialsHtml}</span>
    <span>${escapeHtml(opts.copyright)}</span>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 350);
    };
  <\/script>
</body>
</html>`;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  return true;
}

function absUrl(u: string): string {
  return /^(https?:|data:|blob:)/i.test(u) ? u : new URL(u, window.location.origin).toString();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
