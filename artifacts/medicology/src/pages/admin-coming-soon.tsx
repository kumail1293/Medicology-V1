import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, Eye, EyeOff, Users, Rocket, BookOpen, GraduationCap, Package, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import {
  ComingSoonEntry, ComingSoonCategory,
  COMING_SOON_CATEGORY_LABELS, COMING_SOON_STATUS_LABELS,
  listComingSoon, createComingSoon, updateComingSoon, deleteComingSoon,
} from "@/lib/comingSoon";

const CATEGORY_ICONS: Record<ComingSoonCategory, React.ReactNode> = {
  exam: <GraduationCap size={18} />,
  qbank: <BookOpen size={18} />,
  feature: <Sparkles size={18} />,
  program: <Package size={18} />,
  resource: <Rocket size={18} />,
};

interface FormState {
  name: string;
  description: string;
  category: ComingSoonCategory;
  icon: string;
  imageUrl: string;
  expectedRelease: string;
  status: "planned" | "in_progress" | "launching";
  notifyMe: boolean;
  audience: string;
  ctaLabel: string;
  ctaUrl: string;
  sortOrder: number;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "feature",
  icon: "",
  imageUrl: "",
  expectedRelease: "",
  status: "planned",
  notifyMe: true,
  audience: "",
  ctaLabel: "Notify Me",
  ctaUrl: "",
  sortOrder: 0,
  active: true,
};

function formFrom(entry: ComingSoonEntry): FormState {
  return {
    name: entry.name,
    description: entry.description ?? "",
    category: entry.category,
    icon: entry.icon ?? "",
    imageUrl: entry.imageUrl ?? "",
    expectedRelease: entry.expectedRelease ? entry.expectedRelease.slice(0, 10) : "",
    status: entry.status,
    notifyMe: entry.notifyMe,
    audience: entry.audience ?? "",
    ctaLabel: entry.ctaLabel,
    ctaUrl: entry.ctaUrl ?? "",
    sortOrder: entry.sortOrder,
    active: entry.active,
  };
}

export default function AdminComingSoonPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ComingSoonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ComingSoonEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setEntries(await listComingSoon(true));
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (entry: ComingSoonEntry) => { setEditing(entry); setForm(formFrom(entry)); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Give the item a name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        expectedRelease: form.expectedRelease ? new Date(form.expectedRelease).toISOString() : null,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await updateComingSoon(editing.id, payload);
        toast({ title: "Updated", description: `"${form.name}" saved.` });
      } else {
        await createComingSoon(payload);
        toast({ title: "Created", description: `"${form.name}" added to the catalogue.` });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: ComingSoonEntry) => {
    if (!window.confirm(`Delete "${entry.name}"? This also removes its Notify Me registrations.`)) return;
    try {
      await deleteComingSoon(entry.id);
      toast({ title: "Deleted", description: `"${entry.name}" removed.` });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    }
  };

  const totalInterest = entries.reduce((sum, e) => sum + (e.interestCount ?? 0), 0);

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {node}
      {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground/70">{hint}</span>}
    </label>
  );

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
  const textareaCls = `${inputCls} min-h-[70px] resize-y`;

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Coming Soon</h2>
          <p className="text-sm text-muted-foreground">
            Admin-created future exams, QBanks, features, programs and resources — with Notify Me demand tracking.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={16} /> New item
        </button>
      </div>

      {!loading && entries.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
            <Package size={14} /> {entries.length} items
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
            <Users size={14} /> {totalInterest} Notify Me registrations
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No Coming Soon items yet. Create your first one — e.g. <span className="font-medium text-foreground">FCPS → Coming Soon → Notify Me</span>.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <div key={entry.id} className={clsx("flex flex-col rounded-xl border bg-card p-5", entry.active ? "border-border" : "border-border/50 opacity-70")}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {entry.icon ? <span className="text-lg">{entry.icon}</span> : CATEGORY_ICONS[entry.category]}
                </span>
                <span className={clsx(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  entry.active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                )}>
                  {entry.active ? <Eye size={11} className="mr-1 inline" /> : <EyeOff size={11} className="mr-1 inline" />}
                  {COMING_SOON_STATUS_LABELS[entry.status]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{entry.name}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {COMING_SOON_CATEGORY_LABELS[entry.category]}
                </span>
              </div>
              {entry.audience && <p className="mt-0.5 text-xs text-muted-foreground">For {entry.audience}</p>}
              {entry.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{entry.description}</p>}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                {entry.expectedRelease && (
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {new Date(entry.expectedRelease).toLocaleDateString()}</span>
                )}
                <span className="inline-flex items-center gap-1"><Users size={12} /> {entry.interestCount ?? 0} interested</span>
              </div>
              <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <button onClick={() => openEdit(entry)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary">
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={() => remove(entry)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400/40">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editing ? "Edit item" : "New Coming Soon item"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Name *", <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="FCPS Part II" />)}
                {field("Category", (
                  <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ComingSoonCategory })}>
                    {Object.entries(COMING_SOON_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                ))}
              </div>
              {field("Description", <textarea className={textareaCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this, and who is it for?" />)}
              <div className="grid gap-4 sm:grid-cols-3">
                {field("Icon (emoji)", <input className={inputCls} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🎓" />)}
                {field("Status", (
                  <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}>
                    {Object.entries(COMING_SOON_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                ))}
                {field("Expected release", <input type="date" className={inputCls} value={form.expectedRelease} onChange={(e) => setForm({ ...form, expectedRelease: e.target.value })} />)}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Image URL", <input className={inputCls} value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="/api/storage/uploads/… or https://…" />)}
                {field("Audience", <input className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="FCPS candidates" />)}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("CTA label", <input className={inputCls} value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} />)}
                {field("CTA URL (optional)", <input className={inputCls} value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder="https://…" />)}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {field("Sort order", <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />)}
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" checked={form.notifyMe} onChange={(e) => setForm({ ...form, notifyMe: e.target.checked })} />
                  <span className="text-sm">Offer Notify Me</span>
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  <span className="text-sm">Visible publicly</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving…" : editing ? "Save changes" : "Create item"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
