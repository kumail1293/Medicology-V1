import { apiFetch } from "./api";

export const MEDIA_CATEGORIES = [
  "logo",
  "icon",
  "announcement",
  "qbank_cover",
  "flashcard",
  "rich_content",
  "seo",
  "other",
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_CATEGORY_LABELS: Record<string, string> = {
  logo: "Logos",
  icon: "Icons",
  announcement: "Announcements",
  qbank_cover: "QBank covers",
  flashcard: "Flashcards",
  rich_content: "Rich content",
  seo: "SEO / social",
  other: "Other",
};

export interface MediaItem {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  url: string;
  altText: string | null;
  category: MediaCategory;
  uploadedBy: number | null;
  createdAt: string;
}

export async function listMedia(params: { category?: string; search?: string } = {}): Promise<MediaItem[]> {
  const q = new URLSearchParams();
  if (params.category && params.category !== "all") q.set("category", params.category);
  if (params.search) q.set("search", params.search);
  const res = await apiFetch(`/api/storage/media?${q}`);
  if (!res.ok) throw new Error("Failed to load media library");
  const data = await res.json();
  return data.media ?? [];
}

export async function uploadMedia(file: File, opts: { category?: MediaCategory; altText?: string } = {}): Promise<MediaItem> {
  const form = new FormData();
  form.append("file", file);
  if (opts.category) form.append("category", opts.category);
  if (opts.altText) form.append("altText", opts.altText);
  const res = await apiFetch("/api/storage/media", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.media;
}

export async function updateMedia(id: number, patch: { altText?: string; category?: MediaCategory }): Promise<MediaItem> {
  const res = await apiFetch(`/api/storage/media/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to update media");
  return data.media;
}

export async function deleteMedia(id: number): Promise<void> {
  const res = await apiFetch(`/api/storage/media/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete media");
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
