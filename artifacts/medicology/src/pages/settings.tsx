import React, { useEffect, useState } from "react";
import { useSettings, AppTheme, FontFamily, FontSize } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Leaf, Monitor, Type, Palette, Check, Zap, User, Shield, Bell, Download, Trash2, Loader2, Smartphone, Globe, KeyRound, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  fetchSessions, revokeSession, revokeAllSessions, fetchSecurityEvents,
  saveNotificationPrefs, changePassword, exportMyData, deleteMyAccount,
  fetchStudyAim, saveStudyAim,
  SessionInfo, SecurityEvent, NotificationPrefs, StudyAim,
} from "@/lib/account";

type Tab = "appearance" | "profile" | "security" | "notifications" | "privacy" | "aim";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "profile", label: "Profile", icon: User },
  { id: "aim", label: "Study Aim", icon: Target },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy & Data", icon: Download },
];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-display">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, security, notifications and study environment.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              tab === id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-muted-foreground hover:bg-muted")}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "appearance" && <AppearanceTab settings={settings} update={update} />}
      {tab === "profile" && <ProfileTab />}
      {tab === "aim" && <StudyAimTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "privacy" && <PrivacyTab />}
    </div>
  );
}

/* ── Appearance (local preferences) ────────────────────────────────────── */

function AppearanceTab({ settings, update }: {
  settings: ReturnType<typeof useSettings>["settings"];
  update: (patch: Partial<ReturnType<typeof useSettings>["settings"]>) => void;
}) {
  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Theme</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <ThemeOption id="light" current={settings.theme} icon={<Sun className="h-5 w-5" />} label="Light" description="Clean & bright" preview="bg-white border-gray-200" textPreview="text-gray-900" onClick={() => update({ theme: "light" })} />
            <ThemeOption id="dark" current={settings.theme} icon={<Moon className="h-5 w-5" />} label="Dark" description="Easy at night" preview="bg-slate-900 border-slate-700" textPreview="text-slate-100" onClick={() => update({ theme: "dark" })} />
            <ThemeOption id="easy" current={settings.theme} icon={<Leaf className="h-5 w-5" />} label="Sepia" description="Easy on eyes" preview="bg-amber-50 border-amber-200" textPreview="text-amber-900" onClick={() => update({ theme: "easy" })} />
            <ThemeOption id="usmle" current={settings.theme} icon={<Monitor className="h-5 w-5" />} label="USMLE" description="Exam interface" preview="bg-gray-50 border-blue-300" textPreview="text-blue-700" onClick={() => update({ theme: "usmle" })} />
            <ThemeOption id="oled" current={settings.theme} icon={<Zap className="h-5 w-5" />} label="OLED" description="True black" preview="bg-black border-gray-700" textPreview="text-white" onClick={() => update({ theme: "oled" })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Font Family</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: "sans" as FontFamily, name: "DM Sans", label: "Sans-serif", desc: "Modern & readable", style: "font-sans" },
              { id: "serif" as FontFamily, name: "Merriweather", label: "Serif", desc: "Traditional academic", style: "font-serif" },
              { id: "mono" as FontFamily, name: "JetBrains", label: "Monospace", desc: "Structured & precise", style: "font-mono" },
            ]).map(({ id, name, label, desc, style }) => (
              <button key={id} onClick={() => update({ fontFamily: id })}
                className={cn("p-4 rounded-xl border-2 text-left transition-all", settings.fontFamily === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <p className={cn("text-lg font-bold mb-1", style)} style={id === "serif" ? { fontFamily: "Merriweather, serif" } : id === "mono" ? { fontFamily: "JetBrains Mono, monospace" } : {}}>Aa</p>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {settings.fontFamily === id && <Check className="h-3 w-3 text-primary mt-1" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Text Size</span>
          </div>
          <div className="flex gap-3">
            {([
              { id: "sm" as FontSize, label: "Small", size: "text-sm" },
              { id: "md" as FontSize, label: "Medium", size: "text-base" },
              { id: "lg" as FontSize, label: "Large", size: "text-lg" },
              { id: "xl" as FontSize, label: "X-Large", size: "text-xl" },
            ]).map(({ id, label, size }) => (
              <button key={id} onClick={() => update({ fontSize: id })}
                className={cn("flex-1 p-3 rounded-xl border-2 text-center transition-all", settings.fontSize === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <span className={cn("font-semibold block", size)}>A</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">Appearance is saved on this device. Account settings below are server-backed.</div>
    </div>
  );
}

function ThemeOption({ id, current, icon, label, description, preview, textPreview, onClick }: {
  id: AppTheme; current: AppTheme; icon: React.ReactNode; label: string; description: string; preview: string; textPreview: string; onClick: () => void;
}) {
  const isActive = current === id;
  return (
    <button onClick={onClick} className={cn("p-3 rounded-xl border-2 text-left transition-all relative", isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
      <div className={cn("w-full h-10 rounded-lg border mb-2 flex items-center justify-center", preview)}>
        <span className={cn("text-xs font-bold", textPreview)}>Aa</span>
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {isActive && <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
    </button>
  );
}

/* ── Profile (server-backed) ───────────────────────────────────────────── */

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [college, setCollege] = useState(user?.college ?? "");
  const [university, setUniversity] = useState(user?.university ?? "");
  const [year, setYear] = useState(user?.year ?? 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name); setEmail(user.email); setCollege(user.college);
      setUniversity(user.university ?? ""); setYear(user.year);
    }
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name, email, college, university: university || null, year: Number(year) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update profile" }));
        throw new Error(err.error);
      }
      const data = await res.json();
      if (data.token) localStorage.setItem("token", data.token);
      refreshUser();
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Email"><input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="College"><input className={input} value={college} onChange={(e) => setCollege(e.target.value)} required /></Field>
            <Field label="University"><input className={input} value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. UHS" /></Field>
            <Field label="Year">
              <select className={input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={15} />} Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ── Security (sessions, password, login history) ──────────────────────── */

function SecurityTab() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, e] = await Promise.all([fetchSessions(), fetchSecurityEvents()]);
      setSessions(s); setEvents(e);
    } catch { /* best-effort */ }
  };
  useEffect(() => { load(); }, []);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast({ title: "Password changed" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Change password</span>
          </div>
          <form onSubmit={handlePassword} className="space-y-3 max-w-md">
            <Field label="Current password"><input type="password" className={input} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></Field>
            <Field label="New password"><input type="password" className={input} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></Field>
            <Field label="Confirm new password"><input type="password" className={input} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></Field>
            <Button type="submit" disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound size={15} />} Update password</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Active sessions</span>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              await revokeAllSessions();
              toast({ title: "Other devices signed out" });
              load();
            }}>Sign out other devices</Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Globe size={14} className="text-muted-foreground" />
                      {s.userAgent || "Unknown device"}
                      {s.revoked && <Badge variant="secondary" className="text-[10px]">Revoked</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.ip ? `${s.ip} · ` : ""}Last seen {new Date(s.lastSeen).toLocaleString()}
                    </p>
                  </div>
                  {!s.revoked && (
                    <Button variant="outline" size="sm" onClick={async () => {
                      await revokeSession(s.id);
                      toast({ title: "Session revoked" });
                      load();
                    }}>Revoke</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Login history</span>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent logins.</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{e.userAgent || "Unknown device"}</span>
                  <span className="text-xs text-muted-foreground">{e.ip ? `${e.ip} · ` : ""}{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Notifications (server-backed prefs) ───────────────────────────────── */

function NotificationsTab() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs>({ email: {}, inApp: {} });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.notificationPrefs) setPrefs(d.notificationPrefs);
      })
      .catch(() => {});
  }, []);

  const toggle = (channel: "email" | "inApp", key: string) => {
    setPrefs((p) => {
      const next: NotificationPrefs = { ...p, [channel]: { ...(p[channel] ?? {}) } };
      (next[channel] as Record<string, boolean>)[key] = !(next[channel] as Record<string, boolean>)[key];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNotificationPrefs(prefs);
      toast({ title: "Preferences saved" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const rows: { channel: "email" | "inApp"; key: string; label: string }[] = [
    { channel: "email", key: "welcome", label: "Welcome emails" },
    { channel: "email", key: "purchase", label: "Purchase confirmations" },
    { channel: "email", key: "paymentFailure", label: "Payment failures" },
    { channel: "email", key: "qbankUnlock", label: "QBank unlocks" },
    { channel: "email", key: "qbankExpiry", label: "QBank expiry reminders" },
    { channel: "email", key: "announcements", label: "Announcements" },
    { channel: "email", key: "examReminders", label: "Exam reminders" },
    { channel: "email", key: "results", label: "Exam results" },
    { channel: "email", key: "security", label: "Security alerts" },
    { channel: "inApp", key: "announcements", label: "In-app announcements" },
    { channel: "inApp", key: "results", label: "In-app results" },
    { channel: "inApp", key: "system", label: "In-app system notices" },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-2">
          {rows.map(({ channel, key, label }) => (
            <label key={channel + key} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 cursor-pointer hover:border-primary/30 transition-colors">
              <span className="text-sm font-medium">{label}</span>
              <input type="checkbox" checked={Boolean((prefs[channel] as any)?.[key])}
                onChange={() => toggle(channel, key)}
                className="form-checkbox h-4 w-4 rounded border-border text-primary focus:ring-primary" />
            </label>
          ))}
        </div>
        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={15} />} Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Privacy & Data ────────────────────────────────────────────────────── */

function PrivacyTab() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    try {
      await exportMyData();
      toast({ title: "Download started", description: "Your data export is downloading." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteMyAccount();
      localStorage.removeItem("token");
      logout();
      setLocation("/login");
      toast({ title: "Account deleted", description: "Your account data has been anonymized." });
    } catch (err: any) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Download your data</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Get a JSON file with your profile, preferences, sessions and login history. Passwords and tokens are never included.</p>
          <Button variant="outline" onClick={handleExport} className="gap-2"><Download size={15} /> Export my data</Button>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-red-600">Delete account</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Permanently anonymize your account and sign out of every device. This cannot be undone.</p>
          {!confirming ? (
            <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:border-red-400" onClick={() => setConfirming(true)}>
              <Trash2 size={15} /> Delete my account
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-red-600">Are you absolutely sure?</p>
              <Button variant="destructive" disabled={busy} onClick={handleDelete} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={15} />} Yes, delete
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Study Aim (AMBOSS-style goal for the current subscription) ────────── */

const AIM_EXAM_OPTIONS = [
  "UHS MBBS 1st Year", "UHS MBBS 2nd Year", "UHS MBBS 3rd Year", "UHS MBBS 4th Year", "UHS MBBS Final Year",
  "KMU MBBS", "NUMS MBBS", "FCPS Part 1", "FCPS Part 2", "USMLE Step 1", "USMLE Step 2 CK", "PLAB 1", "PLAB 2", "NRE-1", "NRE-2",
];

function StudyAimTab() {
  const { toast } = useToast();
  const [aim, setAim] = useState<StudyAim>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    fetchStudyAim()
      .then((a) => { setAim(a); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const patch = (p: Partial<StudyAim>) => { setAim((prev) => ({ ...prev, ...p })); setChanged(true); };

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveStudyAim(aim);
      setAim(res.aim);
      setChanged(false);
      setConfirmReset(false);
      toast({
        title: res.progressReset ? "Aim updated — progress reset" : "Study aim saved",
        description: res.progressReset ? "Your sessions, per-question progress and daily challenges were cleared for a fresh start." : undefined,
        variant: res.progressReset ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><Target className="text-primary" size={22} /></div>
            <div>
              <h3 className="font-bold">Your Study Aim</h3>
              <p className="text-sm text-muted-foreground">
                Set the goal you're studying towards. Changing your aim starts a fresh
                session — your test history, per-question progress and daily challenges
                are reset so analytics reflect your new target (like AMBOSS).
              </p>
            </div>
          </div>

          {!loaded && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

          {loaded && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target exam / QBank">
                <select value={aim.targetExam ?? ""} onChange={(e) => patch({ targetExam: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select your target…</option>
                  {AIM_EXAM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Target exam date">
                <input type="date" value={aim.targetDate ?? ""} onChange={(e) => patch({ targetDate: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="Daily question goal">
                <input type="number" min={0} value={aim.dailyQuestions ?? ""} onChange={(e) => patch({ dailyQuestions: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g. 40" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="Weekly goal (questions)">
                <input type="number" min={0} value={aim.weeklyGoal ?? ""} onChange={(e) => patch({ weeklyGoal: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g. 200" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
            </div>
          )}

          {changed && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle size={16} /> Aim changes reset your progress
              </p>
              <p className="text-xs text-muted-foreground">
                Saving a different aim clears your test sessions, per-question progress and
                daily challenge history so your analytics start fresh. Bookmarks and notes are kept.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={save} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target size={14} />} Save & reset progress
                </Button>
                <Button size="sm" variant="outline" onClick={() => setChanged(false)} disabled={busy}>Discard</Button>
              </div>
            </div>
          )}

          {!changed && loaded && (
            <Button onClick={() => setChanged(true)} disabled={busy}>
              {aim.targetExam ? "Change my aim" : "Set my study aim"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
