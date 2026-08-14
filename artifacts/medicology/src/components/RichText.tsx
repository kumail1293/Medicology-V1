import { cn } from "@/lib/utils";
import { sanitizeRichHtml, markdownImagesToHtml } from "@/lib/richText";

interface Props {
  html: string;
  className?: string;
}

/**
 * Render sanitized rich content (tables, images, flowcharts, formatting).
 * Content authored in the editor is stored as HTML and always passes through
 * the sanitizer before hitting the DOM.
 */
export default function RichText({ html, className }: Props) {
  const safe = sanitizeRichHtml(markdownImagesToHtml(html || ""));
  if (!safe) return null;
  return <div className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}
