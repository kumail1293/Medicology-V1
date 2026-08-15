import { apiFetch } from "@/lib/api";

export type EmailBlockType =
  | "heading" | "text" | "image" | "button" | "divider" | "spacer"
  | "columns" | "social" | "qbankCard" | "resultSummary" | "footer"
  | "unsubscribe" | "custom";

export interface EmailBlock {
  id?: string;
  type: EmailBlockType;
  [key: string]: any;
}

export interface EmailTemplate {
  id: number;
  name: string;
  slug: string;
  category: "transactional" | "marketing" | "system";
  subject: string;
  preheader: string | null;
  senderName: string | null;
  senderEmail: string | null;
  bodyBlocks: EmailBlock[];
  status: "draft" | "published" | "archived";
  version: number;
  versions: any[];
  variables: string[];
  audience: string | null;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const res = await apiFetch("/api/admin/email/templates");
  if (!res.ok) throw new Error("Failed to load email templates");
  const data = await res.json();
  return data.templates ?? [];
}

export async function createEmailTemplate(input: Partial<EmailTemplate> & { name: string }): Promise<EmailTemplate> {
  const res = await apiFetch("/api/admin/email/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create template" }));
    throw new Error(err.error);
  }
  const data = await res.json();
  return data.template;
}

export async function updateEmailTemplate(id: number, input: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const res = await apiFetch(`/api/admin/email/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to save template" }));
    throw new Error(err.error);
  }
  const data = await res.json();
  return data.template;
}

export async function setTemplateStatus(id: number, status: "published" | "archived"): Promise<void> {
  await apiFetch(`/api/admin/email/templates/${id}/${status}`, { method: "POST" });
}

export async function restoreTemplateVersion(id: number, version: number): Promise<EmailTemplate> {
  const res = await apiFetch(`/api/admin/email/templates/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) throw new Error("Failed to restore version");
  const data = await res.json();
  return data.template;
}

export async function renderTemplatePreview(id: number): Promise<{ html: string; subject: string; preheader: string }> {
  const res = await apiFetch(`/api/admin/email/templates/${id}/preview`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to render preview");
  return res.json();
}

export async function sendTestEmail(id: number, to: string): Promise<{ result: any }> {
  const res = await apiFetch(`/api/admin/email/templates/${id}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to send test email" }));
    throw new Error(err.error);
  }
  return res.json();
}

export async function fetchEmailVariables(): Promise<{ variables: string[]; sampleData: Record<string, string> }> {
  const res = await apiFetch("/api/admin/email/variables");
  if (!res.ok) return { variables: [], sampleData: {} };
  return res.json();
}

export async function fetchEmailLogs(limit = 50): Promise<any[]> {
  const res = await apiFetch(`/api/admin/email/logs?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs ?? [];
}

// ---------------------------------------------------------------------------
// Block factory — the visual builder palette
// ---------------------------------------------------------------------------

export function blankBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "heading": return { id: uid(), type, text: "New heading", level: 2, align: "left" };
    case "text": return { id: uid(), type, html: "<p>Write your text here. Use <b>bold</b>, <i>italics</i> and {{user.name}} variables.</p>", align: "left" };
    case "image": return { id: uid(), type, url: "", alt: "", width: 480 };
    case "button": return { id: uid(), type, label: "Click here", url: "https://", style: "primary", align: "left" };
    case "divider": return { id: uid(), type, style: "solid" };
    case "spacer": return { id: uid(), type, height: 24 };
    case "columns": return { id: uid(), type, left: "Left column text", right: "Right column text", leftWidth: 50 };
    case "social": return { id: uid(), type, items: [{ platform: "instagram", url: "https://instagram.com/medicology" }, { platform: "x", url: "https://x.com/medicology" }] };
    case "qbankCard": return { id: uid(), type, name: "{{qbank.name}}", price: "{{qbank.price}}", url: "https://", image: "" };
    case "resultSummary": return { id: uid(), type, score: "{{result.score}}", total: "{{result.total}}", percentage: "{{result.percentage}}", passed: true };
    case "footer": return { id: uid(), type, text: "© 2026 {{platform.name}}. All rights reserved." };
    case "unsubscribe": return { id: uid(), type, label: "Unsubscribe" };
    case "custom": return { id: uid(), type, html: "<p>Custom HTML — sanitized on render.</p>" };
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const BLOCK_PALETTE: { type: EmailBlockType; label: string; desc: string }[] = [
  { type: "heading", label: "Heading", desc: "Section title (H1–H3)" },
  { type: "text", label: "Text", desc: "Rich text paragraph" },
  { type: "image", label: "Image", desc: "Picture or logo" },
  { type: "button", label: "Button", desc: "Call-to-action link" },
  { type: "divider", label: "Divider", desc: "Horizontal rule" },
  { type: "spacer", label: "Spacer", desc: "Vertical space" },
  { type: "columns", label: "Columns", desc: "Two-column text" },
  { type: "social", label: "Social links", desc: "Platform icons row" },
  { type: "qbankCard", label: "QBank card", desc: "Product highlight" },
  { type: "resultSummary", label: "Result summary", desc: "Score / pass card" },
  { type: "footer", label: "Footer", desc: "Small footer text" },
  { type: "unsubscribe", label: "Unsubscribe", desc: "Unsubscribe link" },
  { type: "custom", label: "Custom HTML", desc: "Sanitized HTML block" },
];
