// Shared rich-text helpers. Content authored in the RichText editor (questions,
// explanations, flashcards, announcements) is stored as sanitized HTML and
// rendered back through <RichText> — never raw innerHTML from a form field.

const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "strike", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "blockquote", "pre", "code", "hr",
  "sup", "sub", "small",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan", "style"]),
  td: new Set(["colspan", "rowspan", "style"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
  span: new Set(["style"]),
  p: new Set(["style"]),
  div: new Set(["style"]),
};

// Keep only safe text-align / background / width inline styles.
const SAFE_STYLE = /^(text-align|background-color|width|height|color|font-style|font-weight|text-decoration|vertical-align)\s*:/i;

/**
 * Sanitize editor-produced HTML: strips scripts, event handlers, iframes and
 * foreign tags; keeps tables, images, links and formatting. Image URLs are
 * allowed to be relative (/uploads/..., /api/storage/...) or https.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "iframe" || tag === "object" || tag === "embed" || tag === "form" || tag === "input" || tag === "button") {
        child.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap unknown tags (keep their text content).
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      // Attribute allowlist
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) { child.removeAttribute(attr.name); continue; }
        if (name === "style") {
          const safe = attr.value.split(";").filter((d) => d.trim() && SAFE_STYLE.test(d.trim())).join(";");
          safe ? child.setAttribute("style", safe) : child.removeAttribute("style");
          continue;
        }
        const allowed = ALLOWED_ATTRS[tag];
        if (!allowed || !allowed.has(name)) {
          child.removeAttribute(attr.name);
        }
      }
      if (tag === "a") {
        const href = child.getAttribute("href") || "";
        if (!/^(https?:|mailto:|tel:|\/)/.test(href)) {
          child.removeAttribute("href");
        } else {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      if (tag === "img") {
        const src = child.getAttribute("src") || "";
        if (!/^(https?:|data:image\/|\/)/.test(src)) {
          child.removeAttribute("src");
        } else {
          child.setAttribute("loading", "lazy");
        }
      }
      walk(child);
    }
  };
  walk(doc.body);

  return doc.body.innerHTML.trim();
}

/** True when a string contains HTML tags (editor content). */
export function isRichHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/** Convert markdown-style image links ![alt](url) into <img> tags so pasted
 * image links render (common when content is copied from markdown editors).
 * Accepts absolute https URLs and relative paths (/api/storage/...,
 * /uploads/...) — the flashcard study session resolves relative srcs against
 * the current origin before rendering. */
export function markdownImagesToHtml(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (_, alt, url) => {
    return `<img src="${url}" alt="${alt || ""}" loading="lazy" style="max-width:100%">`;
  });
}

/** Plain-text preview of rich content (for lists/search). */
export function richTextToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
