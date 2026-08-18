// ============================================================================
// Server-side study-note export.
//
// Renders a note's markdown into a branded, self-contained HTML document
// (KaTeX math rendered server-side; mermaid diagrams hydrate client-side from
// the CDN; header/footer branding pulled from platform settings), or returns
// the raw markdown for download. Used by GET /api/study-notes/:id/export.
// ============================================================================

import { marked } from 'marked';
import katex from 'katex';
import { db } from '../db.js';
import { appSettingsTable } from '@workspace/db';
import { mergeSettings } from './settings-defaults.js';

// ---------------------------------------------------------------------------
// Callout classification (mirrors the frontend note-utils classifier).
// ---------------------------------------------------------------------------

interface CalloutInfo {
  label: string;
  tone: string;
  emoji: string;
}

const EMOJI_TONES: Record<string, string> = {
  '💡': 'tip', '🧠': 'mnemonic', '⚠️': 'trap', '❗': 'trap',
  '📌': 'high-yield', '🔑': 'high-yield', '🩺': 'pearl', '🔴': 'warning',
};

const TONE_LABELS: Record<string, string> = {
  tip: 'Tip', mnemonic: 'Mnemonic', trap: 'Trap', 'high-yield': 'High-Yield',
  pearl: 'Clinical Pearl', warning: 'Warning', note: 'Note',
};

const TONE_COLORS: Record<string, string> = {
  tip: '#0ea5e9', mnemonic: '#a855f7', trap: '#f59e0b', 'high-yield': '#10b981',
  pearl: '#06b6d4', warning: '#f43f5e', note: '#64748b',
};

function classifyCallout(firstLine: string): CalloutInfo | null {
  const line = firstLine.replace(/^>\s?/, '').replace(/\*\*/g, '').trim();
  if (!line) return null;
  const emojiMatch = line.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+)/u);
  if (emojiMatch) {
    const emoji = emojiMatch[1].trim();
    for (const [key, tone] of Object.entries(EMOJI_TONES)) {
      if (emoji.includes(key)) return { label: TONE_LABELS[tone], tone, emoji: key };
    }
  }
  const text = line.replace(/[^a-zA-Z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, tone, label] of [
    [/mnemonic/i, 'mnemonic', 'Mnemonic'],
    [/high[\s-]?yield/i, 'high-yield', 'High-Yield'],
    [/trap|pitfall/i, 'trap', 'Trap'],
    [/tip/i, 'tip', 'Tip'],
    [/clinical\s?pearl/i, 'pearl', 'Clinical Pearl'],
    [/warning|caution/i, 'warning', 'Warning'],
  ] as Array<[RegExp, string, string]>) {
    if (re.test(text)) {
      const emoji = Object.entries(EMOJI_TONES).find(([, t]) => t === tone)?.[0] ?? '💬';
      return { label, tone, emoji };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Markdown → HTML pipeline (math + callouts pre-rendered, HTML escaped).
// ---------------------------------------------------------------------------

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode: display, throwOnError: false, output: 'html' });
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeHref(href: string): string {
  return /^(https?:|mailto:|tel:|#)/i.test(href) ? href : '#';
}

/**
 * Render a note's markdown body to safe HTML. Fenced code (mermaid), display
 * math and callout blockquotes are extracted first and replaced by rendered
 * placeholders; the remaining text is HTML-escaped so arbitrary content can
 * never inject markup, then passed through marked (GFM) for tables/lists/etc.
 */
export function renderNoteHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const placeholders: Record<string, string> = {};
  let ph = 0;
  const token = () => `@@MEDN${ph++}@@`;

  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();

    // Fenced code — mermaid kept for client-side render; other code escaped.
    const fence = /^```(\S*)\s*$/.exec(t);
    if (fence) {
      const lang = fence[1];
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      const code = body.join('\n');
      if (lang === 'mermaid') {
        placeholders[token()] = `<pre class="mermaid">${escapeHtml(code)}</pre>`;
      } else {
        placeholders[token()] = `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
      }
      out.push(token());
      continue;
    }

    // Display math — $$ ... $$ (fenced or single-line).
    if (t === '$$') {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '$$') {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      placeholders[token()] = renderMath(body.join('\n'), true);
      out.push(token());
      continue;
    }
    const singleMath = /^\$\$(.+)\$\$\s*$/.exec(t);
    if (singleMath) {
      placeholders[token()] = renderMath(singleMath[1], true);
      out.push(token());
      i += 1;
      continue;
    }

    // Blockquote → callout card.
    if (t.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      const first = quote[0] ?? '';
      const info = classifyCallout(first) ?? { label: 'Note', tone: 'note', emoji: '💬' };
      const rest = first
        .replace(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+)\s*/u, '')
        .replace(/^\*\*[^*]+:?\*\*\s*/, '')
        .replace(/^([A-Za-z][A-Za-z -]*?):\s*/, '');
      const body = [rest, ...quote.slice(1)].join(' ').trim();
      const color = TONE_COLORS[info.tone] ?? '#64748b';
      placeholders[token()] =
        `<div class="callout" style="border-left:4px solid ${color};background:${color}14;border-radius:0 10px 10px 0;padding:10px 14px;margin:12px 0;page-break-inside:avoid">` +
        `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${color};margin-bottom:4px">${info.emoji} ${info.label}</div>` +
        `<div style="font-size:13px;line-height:1.6;color:#334155">${escapeHtml(body)}</div></div>`;
      out.push(token());
      continue;
    }

    // Ordinary line — escape and keep.
    out.push(escapeHtml(lines[i]));
    i += 1;
  }

  let text = out.join('\n');

  // Inline math — $...$ (single line, no `$` inside).
  text = text.replace(/\$([^$\n]+)\$/g, (_m, latex: string) => renderMath(latex, false));

  let html = marked.parse(text, { gfm: true, breaks: false }) as string;

  // Restore pre-rendered placeholders.
  for (const [key, value] of Object.entries(placeholders)) {
    html = html.split(key).join(value);
  }

  // Href sanitization pass.
  html = html.replace(/href="([^"]*)"/g, (_m, href: string) => `href="${sanitizeHref(href)}"`);
  return html;
}

// ---------------------------------------------------------------------------
// Branded document shell.
// ---------------------------------------------------------------------------

async function loadBranding(): Promise<{
  siteName: string;
  tagline: string;
  supportEmail: string;
  logoUrl: string;
  socials: { platform: string; url: string }[];
}> {
  try {
    const rows = await db.select().from(appSettingsTable);
    const map: Record<string, any> = {};
    for (const row of rows) map[row.key] = row.value;
    const merged = mergeSettings(map) as any;
    return {
      siteName: merged?.general?.siteName ?? 'Medicology',
      tagline: merged?.general?.tagline ?? 'Master your medical knowledge.',
      supportEmail: merged?.general?.supportEmail ?? 'support@medicology.net',
      logoUrl: merged?.branding?.logoUrl ?? '/images/logo-colored.png',
      socials: Array.isArray(merged?.footer?.socials) ? merged.footer.socials : [],
    };
  } catch {
    return {
      siteName: 'Medicology',
      tagline: 'Master your medical knowledge.',
      supportEmail: 'support@medicology.net',
      logoUrl: '/images/logo-colored.png',
      socials: [],
    };
  }
}

export function buildNoteDocument(opts: {
  title: string;
  subject: string;
  tags: string[];
  bodyHtml: string;
  branding: Awaited<ReturnType<typeof loadBranding>>;
  domain?: string;
}): string {
  const { title, subject, tags, bodyHtml, branding } = opts;
  const domain = opts.domain ?? 'medicology.net';
  const socialsHtml = branding.socials
    .slice(0, 5)
    .map((s) => {
      const handle = s.url.replace(/\/+$/, '').split('/').pop() ?? '';
      return `<a href="${sanitizeHref(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(handle.startsWith('@') ? handle : `@${handle}`)}</a>`;
    })
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — ${escapeHtml(branding.siteName)}</title>
<meta name="description" content="${escapeHtml(tags.slice(0, 4).join(', '))}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 20mm 15mm 18mm; }
  html, body { margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, 'Segoe UI', sans-serif; color: #0f172a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-header { position: fixed; top: 0; left: 0; right: 0; height: 14mm; display: flex; align-items: center; gap: 10px; padding: 0 15mm; border-bottom: 2px solid #0d9488; background: #fff; z-index: 10; }
  .doc-header img { height: 9mm; width: auto; object-fit: contain; }
  .doc-header .brand { font-weight: 800; font-size: 13px; letter-spacing: 0.06em; color: #0d9488; text-transform: uppercase; }
  .doc-header .doc-title { margin-left: auto; font-size: 11px; color: #475569; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doc-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 15mm; border-top: 1px solid #e2e8f0; background: #fff; font-size: 10px; color: #475569; z-index: 10; }
  .doc-footer a { color: #0d9488; text-decoration: none; font-weight: 600; }
  .doc-content { padding: 6mm 0 4mm; }
  .doc-title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; line-height: 1.2; color: #0f172a; margin: 0 0 6px; }
  .doc-meta { font-size: 11px; color: #0d9488; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
  .doc-body { font-size: 12.5px; line-height: 1.65; }
  .doc-body h1, .doc-body h2 { font-family: 'Outfit', sans-serif; color: #0f172a; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .doc-body h1 { font-size: 19px; } .doc-body h2 { font-size: 17px; } .doc-body h3 { font-size: 14px; }
  .doc-body p { margin: 0 0 10px; }
  .doc-body ul, .doc-body ol { margin: 0 0 10px; padding-left: 20px; }
  .doc-body table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 11.5px; page-break-inside: avoid; }
  .doc-body th { background: #f0fdfa; color: #134e4a; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #ccfbf1; }
  .doc-body td { padding: 5px 8px; border: 1px solid #e2e8f0; }
  .doc-body tr:nth-child(even) td { background: #f8fafc; }
  .doc-body pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; overflow-x: auto; }
  .doc-body code { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .doc-body img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; }
  .doc-body .mermaid { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin: 10px 0 14px; text-align: center; }
  .doc-body .katex-display { overflow-x: auto; overflow-y: hidden; padding: 6px 0; }
  .print-hint { display: none; }
  @media print { .print-hint { display: none; } }
</style>
</head>
<body>
  <div class="doc-header">
    <img src="${escapeHtml(branding.logoUrl)}" alt="" onerror="this.remove()" />
    <span class="brand">${escapeHtml(branding.siteName)}</span>
    <span class="doc-title">${escapeHtml(title)}</span>
  </div>
  <div class="doc-content">
    <div class="doc-title">${escapeHtml(title)}</div>
    <div class="doc-meta">${escapeHtml(subject)} · High-Yield Study Notes</div>
    <div class="doc-body">${bodyHtml}</div>
  </div>
  <div class="doc-footer">
    <span><strong style="color:#0d9488">${escapeHtml(domain)}</strong> &nbsp;·&nbsp; ${escapeHtml(branding.supportEmail)}</span>
    <span>Follow us: ${socialsHtml || escapeHtml(branding.siteName)}</span>
    <span>© ${new Date().getFullYear()} ${escapeHtml(branding.siteName)}</span>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
  <script>
    if (window.mermaid) { mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'strict' }); }
    window.onload = function () {
      if (document.querySelector('.mermaid')) {
        setTimeout(function () { if (window.mermaid) mermaid.run(); }, 200);
      }
    };
  </script>
</body>
</html>`;
}

/** Render the full branded export document for a note row. */
export async function renderNoteExport(row: any): Promise<string> {
  const branding = await loadBranding();
  const tags = (() => {
    try {
      const parsed = JSON.parse(row.tags ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((t: unknown) => typeof t === 'string') : [];
    } catch {
      return String(row.tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  })();
  return buildNoteDocument({
    title: row.title,
    subject: row.subject,
    tags,
    bodyHtml: renderNoteHtml(row.content),
    branding,
  });
}
