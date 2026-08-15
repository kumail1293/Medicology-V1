import { apiFetch } from "@/lib/api";

export interface SessionInfo {
  id: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeen: string;
  revoked: boolean;
}

export interface SecurityEvent {
  id: number;
  type: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
}

export interface StudyAim {
  targetExam?: string;
  targetQbankId?: number;
  targetDate?: string;
  dailyQuestions?: number;
  weeklyGoal?: number;
  setAt?: string;
}

export async function fetchStudyAim(): Promise<StudyAim> {
  const res = await apiFetch("/api/auth/me/aim");
  if (!res.ok) throw new Error("Failed to load study aim");
  const data = await res.json();
  return data.aim ?? {};
}

export async function saveStudyAim(aim: StudyAim): Promise<{ aim: StudyAim; progressReset: boolean }> {
  const res = await apiFetch("/api/auth/me/aim", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aim),
  });
  if (!res.ok) throw new Error("Failed to save study aim");
  return res.json();
}

export interface NotificationPrefs {
  email?: {
    welcome?: boolean;
    purchase?: boolean;
    paymentFailure?: boolean;
    qbankUnlock?: boolean;
    qbankExpiry?: boolean;
    announcements?: boolean;
    examReminders?: boolean;
    results?: boolean;
    security?: boolean;
  };
  inApp?: {
    announcements?: boolean;
    results?: boolean;
    system?: boolean;
  };
}

export async function fetchSessions(): Promise<SessionInfo[]> {
  const res = await apiFetch("/api/auth/me/sessions");
  if (!res.ok) throw new Error("Failed to load sessions");
  const data = await res.json();
  return data.sessions ?? [];
}

export async function revokeSession(id: number): Promise<void> {
  const res = await apiFetch(`/api/auth/me/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to revoke session");
}

export async function revokeAllSessions(): Promise<void> {
  const res = await apiFetch("/api/auth/me/sessions", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to revoke sessions");
}

export async function fetchSecurityEvents(): Promise<SecurityEvent[]> {
  const res = await apiFetch("/api/auth/me/security-events");
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? [];
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs> {
  const res = await apiFetch("/api/auth/me/notification-prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefs }),
  });
  if (!res.ok) throw new Error("Failed to save preferences");
  const data = await res.json();
  return data.prefs;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch("/api/auth/me/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to change password" }));
    throw new Error(err.error);
  }
}

export async function exportMyData(): Promise<void> {
  const res = await apiFetch("/api/auth/me/data");
  if (!res.ok) throw new Error("Failed to export data");
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "medicology-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteMyAccount(): Promise<void> {
  const res = await apiFetch("/api/auth/me", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete account");
}
