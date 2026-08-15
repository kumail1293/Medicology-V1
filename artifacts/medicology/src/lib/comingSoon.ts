import { apiFetch } from "./api";

export type ComingSoonCategory = "exam" | "qbank" | "feature" | "program" | "resource";
export type ComingSoonStatus = "planned" | "in_progress" | "launching";

export interface ComingSoonEntry {
  id: number;
  name: string;
  description: string | null;
  category: ComingSoonCategory;
  icon: string | null;
  imageUrl: string | null;
  expectedRelease: string | null;
  status: ComingSoonStatus;
  notifyMe: boolean;
  audience: string | null;
  ctaLabel: string;
  ctaUrl: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  interestCount?: number;
}

export const COMING_SOON_CATEGORY_LABELS: Record<ComingSoonCategory, string> = {
  exam: "Exam",
  qbank: "QBank",
  feature: "Feature",
  program: "Program",
  resource: "Resource",
};

export const COMING_SOON_STATUS_LABELS: Record<ComingSoonStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  launching: "Launching soon",
};

export async function listComingSoon(admin = false): Promise<ComingSoonEntry[]> {
  const res = await apiFetch(admin ? "/api/admin/coming-soon" : "/api/coming-soon");
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to load Coming Soon items");
  return res.json();
}

export async function createComingSoon(input: Partial<ComingSoonEntry>): Promise<ComingSoonEntry> {
  const res = await apiFetch("/api/admin/coming-soon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to create item");
  return res.json();
}

export async function updateComingSoon(id: number, input: Partial<ComingSoonEntry>): Promise<ComingSoonEntry> {
  const res = await apiFetch(`/api/admin/coming-soon/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to update item");
  return res.json();
}

export async function deleteComingSoon(id: number): Promise<void> {
  const res = await apiFetch(`/api/admin/coming-soon/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to delete item");
}

export async function notifyComingSoon(id: number, email?: string): Promise<{ alreadyRegistered?: boolean }> {
  const res = await apiFetch(`/api/coming-soon/${id}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to register interest");
  return res.json();
}
