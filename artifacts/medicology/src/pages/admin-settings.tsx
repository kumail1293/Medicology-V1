import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Palette, BookOpen, UserPlus, Bell, Shield, CreditCard,
  Database, Plug, Save, RotateCcw, Loader2, ChevronRight, Globe, LayoutDashboard,
  FileText, Type, Ruler, Flag, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS, PlatformSettings, SettingsGroup,
  fetchAdminSettings, saveAdminSettings, resetSettingsGroup,
  fetchSettingsHistory, restoreSettings,
} from "@/lib/adminSettings";
import { applyBranding } from "@/components/BrandingApplier";
import { hexToHslTriplet } from "@/components/BrandingApplier";

/* ── Small form primitives ─────────────────────────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-4.5" : "left-0.5")} style={{ left: checked ? 18 : 2 }} />
      </button>
      <div>
        <span className="font-medium">{label}</span>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </label>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-lg">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ── Group definitions (WordPress-style settings sections) ─────────────── */

// "history" is a read-only pseudo-group (audit trail), not a settings key.
const GROUPS: { id: SettingsGroup | "history"; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; blurb: string }[] = [
  { id: "general", label: "General", icon: Settings, blurb: "Site identity, homepage and regional defaults." },
  { id: "branding", label: "Branding & Design", icon: Palette, blurb: "Elementor-style design tokens — colors, fonts, radius, logo." },
  { id: "content", label: "Content & QBanks", icon: BookOpen, blurb: "Default statuses and content workflow rules." },
  { id: "registration", label: "Users & Registration", icon: UserPlus, blurb: "Registration policy and default roles." },
  { id: "notifications", label: "Notifications", icon: Bell, blurb: "Which events trigger email alerts." },
  { id: "security", label: "Security", icon: Shield, blurb: "MFA, sessions, passwords and maintenance mode." },
  { id: "payments", label: "Payments", icon: CreditCard, blurb: "Currency, provider and pricing policy." },
  { id: "storage", label: "Storage & Uploads", icon: Database, blurb: "Upload limits and allowed file types." },
  { id: "integrations", label: "Integrations", icon: Plug, blurb: "Analytics, SEO meta and custom head code." },
  { id: "featureFlags", label: "Feature Flags", icon: Flag, blurb: "Toggle protected capabilities platform-wide (enforced server-side)." },
  { id: "history", label: "Activity & History", icon: History, blurb: "Audit trail of settings changes with one-click restore." },
];

/* ── Feature Flags ─────────────────────────────────────────────────────── */

const FEATURE_FLAG_LABELS: Record<string, { label: string; desc: string }> = {
  flashcards: { label: "Flashcards", desc: "Spaced-repetition flashcards + admin decks." },
  richContent: { label: "Rich Content Editing", desc: "TipTap WYSIWYG editing (tables, images, flowcharts)." },
  pastPapers: { label: "Past Papers", desc: "Past-paper question sets." },
  aiTutor: { label: "AI Tutor", desc: "AI-powered tutor assistance." },
  aiQuestionReview: { label: "AI Question Review", desc: "AI-assisted review of submitted questions." },
  spacedRepetition: { label: "Spaced Repetition", desc: "Mastery + spaced repetition engine." },
  studyBuddies: { label: "Study Buddies", desc: "Friend/study-group features." },
  dailyChallenge: { label: "Daily Challenge", desc: "Daily question challenge." },
  payments: { label: "Payments", desc: "Purchases and entitlements." },
  waitlist: { label: "Waitlist / Coming Soon", desc: "Notify-me for unavailable QBanks." },
  newExamEngine: { label: "New Exam Engine", desc: "P1 exam simulator features." },
};

function FeatureFlagsSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["featureFlags"]>) => void }) {
  const flags = draft.featureFlags;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Disabling a flag hides it in the UI <em>and</em> blocks the matching API routes server-side (503). Protected
        capabilities are never gated by the frontend alone.
      </p>
      {Object.entries(flags).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
          <div>
            <div className="text-sm font-semibold">{FEATURE_FLAG_LABELS[key]?.label ?? key}</div>
            <div className="text-xs text-muted-foreground">{FEATURE_FLAG_LABELS[key]?.desc}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={() => set({ [key]: !value } as any)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              value ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              value ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Activity & History (restore from audit trail) ────────────────────── */

function HistorySection() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<{ id: number; action: string; summary: string; actorName: string | null; actorEmail: string | null; createdAt: string; oldValues: Record<string, any> }[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await fetchSettingsHistory(50);
      setLogs(data.logs);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load history", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async (id: number) => {
    if (!window.confirm("Restore the settings snapshot from this entry? Current values will be replaced.")) return;
    setRestoring(id);
    try {
      await restoreSettings(id);
      toast({ title: "Restored", description: "Settings restored from history." });
      void load();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to restore", variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading history…</div>;
  }
  if (logs.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No settings changes recorded yet.</div>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Every settings change is audit-logged with the pre-change snapshot, so any saved configuration can be restored.
      </p>
      {logs.map((log) => (
        <div key={log.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">{log.summary}</div>
            <div className="text-xs text-muted-foreground">
              {log.action} · {log.actorName || log.actorEmail || "admin"} · {new Date(log.createdAt).toLocaleString()}
            </div>
            {log.oldValues && Object.keys(log.oldValues).length > 0 && (
              <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                before: {JSON.stringify(log.oldValues).slice(0, 120)}
              </div>
            )}
          </div>
          {log.action !== "settings.restore" && log.oldValues && Object.keys(log.oldValues).length > 0 && (
            <button
              onClick={() => void restore(log.id)}
              disabled={restoring === log.id}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {restoring === log.id ? <Loader2 className="animate-spin" size={13} /> : <RotateCcw size={13} className="mr-1 inline" />}
              Restore
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Branding & Design (Elementor-like) with live preview ─────────────── */

function BrandingSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["branding"]>) => void }) {
  const b = draft.branding;
  const previewStyle = useMemo(() => {
    const primary = hexToHslTriplet(b.primaryColor);
    return {
      "--p": primary || "175 70% 35%",
      "--r": `${b.borderRadius}px`,
      "--font": b.fontFamily === "serif" ? "Merriweather, serif" : b.fontFamily === "mono" ? "JetBrains Mono, monospace" : "DM Sans, sans-serif",
    } as React.CSSProperties;
  }, [b.primaryColor, b.borderRadius, b.fontFamily]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card title="Identity">
          <Field label="Logo URL" hint="Shown in the header and login screen.">
            <TextInput value={b.logoUrl} onChange={(v) => set({ logoUrl: v })} placeholder="/images/logo-colored.png" />
          </Field>
          <Field label="Favicon URL">
            <TextInput value={b.faviconUrl} onChange={(v) => set({ faviconUrl: v })} placeholder="/favicon.ico" />
          </Field>
        </Card>

        <Card title="Color Palette" description="Applied platform-wide as the brand color — like Elementor global colors.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary color">
              <div className="flex items-center gap-2">
                <input type="color" value={b.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background" />
                <TextInput value={b.primaryColor} onChange={(v) => set({ primaryColor: v })} />
              </div>
            </Field>
            <Field label="Accent color">
              <div className="flex items-center gap-2">
                <input type="color" value={b.accentColor} onChange={(e) => set({ accentColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-background" />
                <TextInput value={b.accentColor} onChange={(v) => set({ accentColor: v })} />
              </div>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {["#0d9488", "#2563eb", "#7c3aed", "#dc2626", "#ea580c", "#16a34a", "#0f172a"].map((c) => (
              <button key={c} onClick={() => set({ primaryColor: c })}
                className="h-7 w-7 rounded-full border border-border transition-transform hover:scale-110" style={{ background: c }} title={c} />
            ))}
          </div>
        </Card>

        <Card title="Typography & Layout" description="Font, base text size, corner radius and content width.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Font family">
              <SelectInput value={b.fontFamily} onChange={(v) => set({ fontFamily: v as any })}
                options={[{ value: "sans", label: "Sans (DM Sans)" }, { value: "serif", label: "Serif (Merriweather)" }, { value: "mono", label: "Mono (JetBrains Mono)" }]} />
            </Field>
            <Field label="Base text size">
              <SelectInput value={b.fontSizeScale} onChange={(v) => set({ fontSizeScale: v as any })}
                options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium (default)" }, { value: "lg", label: "Large" }]} />
            </Field>
          </div>
          <Field label={`Corner radius — ${b.borderRadius}px`}>
            <input type="range" min={0} max={32} value={b.borderRadius} onChange={(e) => set({ borderRadius: Number(e.target.value) })}
              className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>Sharp</span><span>Rounded</span></div>
          </Field>
          <Field label={`Content max width — ${b.contentMaxWidth}px`}>
            <input type="range" min={640} max={1920} step={40} value={b.contentMaxWidth} onChange={(e) => set({ contentMaxWidth: Number(e.target.value) })}
              className="w-full accent-primary" />
          </Field>
        </Card>
      </div>

      {/* Live preview */}
      <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Ruler size={13} /> Live preview</p>
        <div className="rounded-2xl border border-border bg-background p-5" style={previewStyle as React.CSSProperties}>
          <div className="rounded-xl border border-border bg-card p-4" style={{ borderRadius: "var(--r)", fontFamily: "var(--font)" }}>
            <div className="mb-3 flex items-center gap-2">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt="logo" className="h-6 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : <Globe size={18} />}
              <span className="text-sm font-bold" style={{ color: "hsl(var(--p))" }}>{draft.general.siteName || "Medicology"}</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: "hsl(var(--p))" }}>Question 1 — Clinical vignette</p>
            <p className="mt-1 text-sm text-muted-foreground">A 45-year-old presents with chest pain…</p>
            <div className="mt-3 space-y-1.5">
              {["Option A", "Option B", "Option C"].map((o, i) => (
                <div key={o} className={cn("rounded-lg border px-3 py-1.5 text-xs", i === 0 ? "border-transparent" : "border-border")}
                  style={i === 0 ? { background: "hsl(var(--p) / 0.12)", color: "hsl(var(--p))" } : undefined}>
                  {o}
                </div>
              ))}
            </div>
            <button className="mt-3 w-full rounded-lg py-2 text-xs font-semibold text-white"
              style={{ background: "hsl(var(--p))", borderRadius: "var(--r)" }}>
              Start Exam
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Preview reflects your draft. Save to apply platform-wide.</p>
      </div>
    </div>
  );
}

/* ── Section renderers ─────────────────────────────────────────────────── */

function GeneralSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["general"]>) => void }) {
  const g = draft.general;
  return (
    <Card title="General Settings" description="Site identity and regional defaults (WordPress → Settings → General).">
      <Field label="Site name"><TextInput value={g.siteName} onChange={(v) => set({ siteName: v })} /></Field>
      <Field label="Tagline" hint="Short description shown in meta and the login screen.">
        <TextInput value={g.tagline} onChange={(v) => set({ tagline: v })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Support email"><TextInput type="email" value={g.supportEmail} onChange={(v) => set({ supportEmail: v })} /></Field>
        <Field label="Timezone"><TextInput value={g.timezone} onChange={(v) => set({ timezone: v })} placeholder="Asia/Karachi" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Locale / language"><TextInput value={g.locale} onChange={(v) => set({ locale: v })} placeholder="en" /></Field>
        <Field label="Date format"><TextInput value={g.dateFormat} onChange={(v) => set({ dateFormat: v })} placeholder="MMM d, yyyy" /></Field>
        <Field label="Default home page">
          <SelectInput value={g.homePage} onChange={(v) => set({ homePage: v as any })}
            options={[{ value: "dashboard", label: "Dashboard" }, { value: "store", label: "QBank Store" }, { value: "practice", label: "Practice" }]} />
        </Field>
      </div>
    </Card>
  );
}

function ContentSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["content"]>) => void }) {
  const c = draft.content;
  return (
    <Card title="Content & QBank Workflow" description="Defaults applied when content is created, and publishing rules.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default question status">
          <SelectInput value={c.defaultQuestionStatus} onChange={(v) => set({ defaultQuestionStatus: v as any })}
            options={[{ value: "draft", label: "Draft" }, { value: "pending_review", label: "Pending review" }, { value: "published", label: "Published" }]} />
        </Field>
        <Field label="Default QBank status">
          <SelectInput value={c.defaultQbankStatus} onChange={(v) => set({ defaultQbankStatus: v as any })}
            options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }]} />
        </Field>
      </div>
      <Field label="Questions per page">
        <NumberInput value={c.questionsPerPage} onChange={(v) => set({ questionsPerPage: v })} min={5} max={100} />
      </Field>
      <Toggle checked={c.requireReviewBeforePublish} onChange={(v) => set({ requireReviewBeforePublish: v })}
        label="Require medical review before publish" hint="Questions must pass the review queue before going live." />
    </Card>
  );
}

function RegistrationSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["registration"]>) => void }) {
  const r = draft.registration;
  return (
    <Card title="Users & Registration" description="WordPress → Settings → General (Membership) style controls.">
      <Toggle checked={r.openRegistration} onChange={(v) => set({ openRegistration: v })}
        label="Anyone can register" hint="Disable to make the platform invite-only." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default role for new users">
          <SelectInput value={r.defaultRole} onChange={(v) => set({ defaultRole: v as any })}
            options={[{ value: "user", label: "User (student)" }, { value: "editor", label: "Editor" }, { value: "teacher", label: "Teacher" }]} />
        </Field>
        <Field label="Admin email"><TextInput type="email" value={r.adminEmail} onChange={(v) => set({ adminEmail: v })} /></Field>
      </div>
      <Toggle checked={r.requireEmailVerification} onChange={(v) => set({ requireEmailVerification: v })}
        label="Require email verification" hint="New accounts must confirm their email before access." />
    </Card>
  );
}

function NotificationsSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["notifications"]>) => void }) {
  const n = draft.notifications;
  const items: { key: keyof PlatformSettings["notifications"]; label: string; hint: string }[] = [
    { key: "emailNewUser", label: "New user registered", hint: "Email admins when someone signs up." },
    { key: "emailNewQuestion", label: "New question submitted", hint: "Email admins when content is created." },
    { key: "emailNewReview", label: "Question awaiting review", hint: "Notify reviewers when items enter the queue." },
    { key: "emailNewPurchase", label: "New purchase", hint: "Confirm orders to the buyer and admins." },
    { key: "emailAnnouncements", label: "Announcement broadcasts", hint: "Email all users when an announcement is published." },
  ];
  return (
    <Card title="Email Notifications" description="Which events trigger email alerts (WordPress → Settings → Discussion style).">
      {items.map((it) => (
        <Toggle key={it.key} checked={n[it.key]} onChange={(v) => set({ [it.key]: v } as any)} label={it.label} hint={it.hint} />
      ))}
    </Card>
  );
}

function SecuritySection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["security"]>) => void }) {
  const s = draft.security;
  return (
    <Card title="Security" description="Authentication, sessions and maintenance.">
      <Toggle checked={s.requireMFA} onChange={(v) => set({ requireMFA: v })}
        label="Require multi-factor authentication" hint="Enforce MFA for all admin users." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Session timeout (minutes)"><NumberInput value={s.sessionTimeoutMinutes} onChange={(v) => set({ sessionTimeoutMinutes: v })} min={1} max={1440} /></Field>
        <Field label="Min password length"><NumberInput value={s.passwordMinLength} onChange={(v) => set({ passwordMinLength: v })} min={4} max={64} /></Field>
        <Field label="Max login attempts"><NumberInput value={s.maxLoginAttempts} onChange={(v) => set({ maxLoginAttempts: v })} min={1} max={50} /></Field>
      </div>
      <Toggle checked={s.passwordRequireComplexity} onChange={(v) => set({ passwordRequireComplexity: v })}
        label="Require complex passwords" hint="Mixed case, numbers and symbols." />
      <Toggle checked={s.maintenanceMode} onChange={(v) => set({ maintenanceMode: v })}
        label="Maintenance mode" hint="Disable access for non-admin users while you work." />
    </Card>
  );
}

function PaymentsSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["payments"]>) => void }) {
  const p = draft.payments;
  return (
    <Card title="Payments" description="Currency, provider and pricing policy.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency"><TextInput value={p.currency} onChange={(v) => set({ currency: v.toUpperCase().slice(0, 3) })} placeholder="USD" /></Field>
        <Field label="Provider">
          <SelectInput value={p.provider} onChange={(v) => set({ provider: v as any })}
            options={[{ value: "dev", label: "Development (mock)" }, { value: "stripe", label: "Stripe" }, { value: "jazzcash", label: "JazzCash" }, { value: "easypaisa", label: "EasyPaisa" }]} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tax rate (%)"><NumberInput value={p.taxRatePercent} onChange={(v) => set({ taxRatePercent: v })} min={0} max={50} step={0.5} /></Field>
        <Field label="Refund policy (days)"><NumberInput value={p.refundPolicyDays} onChange={(v) => set({ refundPolicyDays: v })} min={0} max={365} /></Field>
      </div>
    </Card>
  );
}

function StorageSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["storage"]>) => void }) {
  const st = draft.storage;
  const toggleType = (t: string) =>
    set({ allowedImageTypes: st.allowedImageTypes.includes(t) ? st.allowedImageTypes.filter((x) => x !== t) : [...st.allowedImageTypes, t] });
  return (
    <Card title="Storage & Uploads" description="WordPress → Settings → Media style controls.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Max upload size (MB)"><NumberInput value={st.maxUploadSizeMB} onChange={(v) => set({ maxUploadSizeMB: v })} min={1} max={500} /></Field>
        <Field label="Storage backend">
          <SelectInput value={st.storageBackend} onChange={(v) => set({ storageBackend: v as any })}
            options={[{ value: "local", label: "Local disk" }, { value: "s3", label: "S3-compatible" }]} />
        </Field>
      </div>
      <Field label="Allowed image types">
        <div className="flex flex-wrap gap-2 pt-1">
          {["jpg", "jpeg", "png", "gif", "webp", "svg"].map((t) => (
            <button key={t} onClick={() => toggleType(t)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                st.allowedImageTypes.includes(t) ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
              {t}
            </button>
          ))}
        </div>
      </Field>
    </Card>
  );
}

function IntegrationsSection({ draft, set }: { draft: PlatformSettings; set: (patch: Partial<PlatformSettings["integrations"]>) => void }) {
  const i = draft.integrations;
  return (
    <Card title="Integrations & SEO" description="Analytics, search meta and custom head code.">
      <Field label="Google Analytics ID" hint="e.g. G-XXXXXXXXXX">
        <TextInput value={i.googleAnalyticsId} onChange={(v) => set({ googleAnalyticsId: v })} placeholder="G-" />
      </Field>
      <Field label="Meta description" hint="Default description for search engines.">
        <TextInput value={i.metaDescription} onChange={(v) => set({ metaDescription: v })} />
      </Field>
      <Field label="Custom head code" hint="Snippets injected into <head> (analytics, verification, fonts).">
        <textarea value={i.customHeadCode} onChange={(e) => set({ customHeadCode: e.target.value })} rows={5}
          className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </Field>
    </Card>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [defaults, setDefaults] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [active, setActive] = useState<string>("general");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    try {
      const data = await fetchAdminSettings();
      setSettings(data.settings);
      setDefaults(data.defaults);
      setDraft(data.settings);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load settings", variant: "destructive" });
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => JSON.stringify((draft as any)[active]) !== JSON.stringify((settings as any)[active]), [draft, settings, active]);

  const setGroup = (patch: Partial<PlatformSettings[SettingsGroup]>) =>
    setDraft((prev) => ({ ...prev, [active as SettingsGroup]: { ...(prev as any)[active], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await saveAdminSettings({ [active as SettingsGroup]: (draft as any)[active] } as any);
      setSettings(updated);
      setDraft(updated);
      // Apply branding immediately (not just on next page load).
      if (active === "branding" || active === "general") {
        applyBranding({ general: updated.general, branding: updated.branding });
      }
      toast({ title: "Saved", description: `${GROUPS.find((g) => g.id === active)?.label} settings updated.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset "${GROUPS.find((g) => g.id === active)?.label}" settings to defaults?`)) return;
    setResetting(true);
    try {
      const updated = await resetSettingsGroup(active as SettingsGroup);
      setSettings(updated);
      setDraft(updated);
      if (active === "branding" || active === "general") applyBranding({ general: updated.general, branding: updated.branding });
      toast({ title: "Reset", description: "Settings restored to defaults." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reset", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const ActiveSection = () => {
    switch (active) {
      case "general": return <GeneralSection draft={draft} set={setGroup as any} />;
      case "branding": return <BrandingSection draft={draft} set={setGroup as any} />;
      case "content": return <ContentSection draft={draft} set={setGroup as any} />;
      case "registration": return <RegistrationSection draft={draft} set={setGroup as any} />;
      case "notifications": return <NotificationsSection draft={draft} set={setGroup as any} />;
      case "security": return <SecuritySection draft={draft} set={setGroup as any} />;
      case "payments": return <PaymentsSection draft={draft} set={setGroup as any} />;
      case "storage": return <StorageSection draft={draft} set={setGroup as any} />;
      case "integrations": return <IntegrationsSection draft={draft} set={setGroup as any} />;
      case "featureFlags": return <FeatureFlagsSection draft={draft} set={setGroup as any} />;
      case "history": return <HistorySection />;
      default: return null;
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center p-24 text-muted-foreground">
        <Loader2 className="animate-spin" size={22} />
        <span className="ml-2 text-sm">Loading settings…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Settings size={22} className="text-primary" /> Admin Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          WordPress-style platform configuration — grouped, validated and stored in the database.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Section nav */}
        <nav className="lg:w-60 shrink-0 space-y-1">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            return (
              <button key={g.id} onClick={() => setActive(g.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  active === g.id ? "border-primary/40 bg-primary/5 font-semibold text-primary" : "border-transparent hover:bg-muted/60",
                )}>
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{g.label}</span>
                <ChevronRight size={14} className={cn("text-muted-foreground", active === g.id && "text-primary")} />
              </button>
            );
          })}
          <div className="pt-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1"><Database size={12} /> Stored in the database</p>
            <p className="flex items-center gap-1"><Shield size={12} /> Admin-only access</p>
          </div>
        </nav>

        {/* Active section */}
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{GROUPS.find((g) => g.id === active)?.label}</h3>
              <p className="text-sm text-muted-foreground">{GROUPS.find((g) => g.id === active)?.blurb}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {active !== "history" && (
                <button onClick={() => void reset()} disabled={resetting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
                  <RotateCcw size={14} /> {resetting ? "Resetting…" : "Reset"}
                </button>
              )}
              {active !== "history" && (
                <button onClick={() => void save()} disabled={!dirty || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
                </button>
              )}
            </div>
          </div>

          <ActiveSection />

          {dirty && (
            <div className="fixed bottom-6 right-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
              Unsaved changes in “{GROUPS.find((g) => g.id === active)?.label}”. Click Save Changes to apply.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
