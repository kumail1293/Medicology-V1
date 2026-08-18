import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import MarkdownNote from "@/components/MarkdownNote";
import NoteBlockEditor from "@/components/NoteBlockEditor";
import CanvasEditor from "@/components/CanvasEditor";
import CanvasRenderer from "@/components/CanvasRenderer";
import { parseNoteBlocks, serializeNoteBlocks, addBlockAfter } from "@/lib/note-blocks";
import { createCanvasDesign, serializeDesign, parseDesign } from "@/lib/canvas-design";
import { blocksToCanvas, canvasToBlocks } from "@/lib/canvas-converter";
import {
  BookOpen, Plus, Pencil, Trash2, Search, Star, StarOff, Eye, EyeOff,
  Loader2, FileText, X, Eye as PreviewIcon, PenLine, LayoutTemplate,
} from "lucide-react";
import { clsx } from "clsx";
import { apiFetch } from "@/lib/api";

interface StudyNote {
  id: number;
  title: string;
  slug: string;
  subject: string;
  content: string;
  tags: string[];
  status: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

const SUBJECTS = [
  "Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology",
  "Microbiology", "Forensic Medicine", "Community Medicine", "Medicine",
  "Surgery", "Gynecology & Obstetrics", "Pediatrics", "ENT",
  "Ophthalmology", "Dermatology", "Psychiatry", "Radiology", "Neurology",
  "Immunology", "Endocrinology", "Hematology",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

export default function AdminNotesPage() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<StudyNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview" | "canvas">("write");

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subject, setSubject] = useState("Medicine");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("published");
  const [featured, setFeatured] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/study-notes");
      if (!res.ok) throw new Error("Failed to load study notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setTitle(""); setSlug(""); setSubject("Medicine"); setContent(""); setTags(""); setStatus("published"); setFeatured(false);
    setEditorTab("write");
    setShowForm(true);
  };

  const openEdit = (n: StudyNote) => {
    setEditing(n);
    setTitle(n.title); setSlug(n.slug); setSubject(n.subject); setContent(n.content);
    setTags((n.tags ?? []).join(", ")); setStatus(n.status); setFeatured(n.featured);
    setEditorTab("write");
    setShowForm(true);
  };

  // ── Canvas tab — Canva-style free-form design editor. The design is stored
  // as a ```canvas fenced block inside the note content; the student reader
  // renders it at full quality, scaled to fit. ──────────────────────────────
  const canvasTab = (() => {
    const blocks = parseNoteBlocks(content);
    const canvasBlock = blocks.find((b) => b.type === "canvas");
    const design = canvasBlock?.design ? parseDesign(canvasBlock.design) : null;

    const updateDesign = (json: string) => {
      // Re-place the (first) canvas block's design and re-serialize.
      const next = parseNoteBlocks(content);
      const idx = next.findIndex((b) => b.type === "canvas");
      if (idx === -1) {
        setContent(serializeNoteBlocks(addBlockAfter(next, null, { type: "canvas", design: json })));
      } else {
        next[idx] = { ...next[idx], design: json };
        setContent(serializeNoteBlocks(next));
      }
    };

    if (!canvasBlock) {
      const hasBlocks = parseNoteBlocks(content).some((b) => b.type !== "canvas");
      return (
        <div className="rounded-xl border-2 border-dashed border-border bg-background p-10 text-center">
          <LayoutTemplate className="mx-auto mb-3 text-primary" size={36} />
          <h4 className="text-base font-bold mb-1">Canvas design</h4>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground mb-4">
            Design a free-form visual (text, shapes, connectors, formulas, images) on a fixed-size canvas — rendered at full quality for students and exportable as a branded PNG.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => updateDesign(serializeDesign(createCanvasDesign()))}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus size={15} /> Blank canvas
            </button>
            {hasBlocks && (
              <button
                onClick={() => {
                  const blocks = parseNoteBlocks(content);
                  const canvasDesign = blocksToCanvas(blocks);
                  updateDesign(serializeDesign(canvasDesign));
                  toast({ title: "Imported", description: `Converted ${blocks.length} blocks to canvas elements.` });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
              >
                <Plus size={15} /> Import from blocks
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <CanvasEditor value={canvasBlock.design ?? "{}"} onChange={updateDesign} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-muted-foreground">
              Canvas is saved as a <code className="font-mono">```canvas</code> block in the note — students see it scaled to fit, and it exports to PNG at full resolution.
            </p>
            <button
              onClick={() => {
                if (!confirm("Convert canvas elements to structured blocks? The canvas block will be replaced.")) return;
                const design = parseDesign(canvasBlock!.design ?? "{}");
                if (!design) return;
                const newBlocks = canvasToBlocks(design);
                const otherBlocks = parseNoteBlocks(content).filter((b) => b.type !== "canvas");
                setContent(serializeNoteBlocks([...otherBlocks, ...newBlocks]));
                toast({ title: "Converted", description: `${newBlocks.length} blocks created from canvas elements.` });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
            >
              Convert to blocks
            </button>
          </div>
          {design && (
            <div className="shrink-0 rounded-lg border border-border bg-background p-1">
              <CanvasRenderer design={design} scale={0.18} />
            </div>
          )}
        </div>
      </div>
    );
  })();

  const save = async () => {
    if (!title.trim() || !subject.trim() || !content.trim()) {
      toast({ title: "Required fields missing", description: "Title, subject and content are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      subject: subject.trim(),
      content,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      status,
      featured,
    };
    try {
      const res = await apiFetch(editing ? `/api/admin/study-notes/${editing.id}` : "/api/admin/study-notes", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Save failed");
      toast({ title: editing ? "Note updated" : "Note created", description: `"${payload.title}" saved.` });
      setShowForm(false);
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n: StudyNote) => {
    if (!window.confirm(`Delete "${n.title}"? This also removes student bookmarks.`)) return;
    try {
      const res = await apiFetch(`/api/admin/study-notes/${n.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Deleted", description: `"${n.title}" removed.` });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    }
  };

  const toggleFeatured = async (n: StudyNote) => {
    try {
      const res = await apiFetch(`/api/admin/study-notes/${n.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !n.featured }),
      });
      if (!res.ok) throw new Error("Update failed");
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Update failed", variant: "destructive" });
    }
  };

  const toggleStatus = async (n: StudyNote) => {
    const next = n.status === "published" ? "archived" : n.status === "archived" ? "draft" : "published";
    try {
      const res = await apiFetch(`/api/admin/study-notes/${n.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Status changed", description: `"${n.title}" is now ${STATUS_LABELS[next].toLowerCase()}.` });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Update failed", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (statusFilter !== "all" && n.status !== statusFilter) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q) || (n.tags ?? []).some((t) => t.toLowerCase().includes(q));
    });
  }, [notes, query, statusFilter]);

  const counts = useMemo(() => ({
    all: notes.length,
    published: notes.filter((n) => n.status === "published").length,
    draft: notes.filter((n) => n.status === "draft").length,
    archived: notes.filter((n) => n.status === "archived").length,
  }), [notes]);

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {node}
      {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground/70">{hint}</span>}
    </label>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="text-primary" size={22} /> Notes Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Faculty-curated study notes — rich markdown with tables, callouts, diagrams &amp; images.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus size={16} /> New note
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={counts.all} />
        <StatCard label="Published" value={counts.published} tone="text-emerald-600" />
        <StatCard label="Drafts" value={counts.draft} tone="text-amber-600" />
        <StatCard label="Archived" value={counts.archived} tone="text-muted-foreground" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, subject or tag…" className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "published", "draft", "archived"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx("rounded-full border px-3 py-1.5 text-xs font-medium capitalize", statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
              {s === "all" ? `All (${counts.all})` : `${STATUS_LABELS[s]} (${counts[s]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-3 text-muted-foreground/60" size={36} />
          {notes.length === 0 ? "No study notes yet — create your first one." : "No notes match your filters."}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {n.featured && <Star size={13} className="shrink-0 text-amber-500 fill-amber-500" />}
                      <span className="font-medium line-clamp-1">{n.title}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Updated {new Date(n.updatedAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{n.subject}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {(n.tags ?? []).slice(0, 3).map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                      {(n.tags ?? []).length > 3 && <span className="text-[10px] text-muted-foreground">+{(n.tags ?? []).length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => void toggleStatus(n)} title="Click to change status"
                      className={clsx("rounded-full px-2.5 py-1 text-[11px] font-bold", n.status === "published" ? "bg-emerald-500/15 text-emerald-600" : n.status === "draft" ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground")}>
                      {n.status === "published" ? <Eye size={11} className="mr-1 inline" /> : <EyeOff size={11} className="mr-1 inline" />}
                      {STATUS_LABELS[n.status]}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => void toggleFeatured(n)} title={n.featured ? "Unfeature" : "Feature"}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-amber-500">
                        {n.featured ? <Star size={13} className="fill-amber-500 text-amber-500" /> : <StarOff size={13} />}
                      </button>
                      <button onClick={() => openEdit(n)} title="Edit" className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => void remove(n)} title="Delete" className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-auto rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editing ? "Edit note" : "New study note"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Title *", <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cardiac Action Potential — The 5 Phases" />)}
                {field("Subject *", (
                  <select className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)}>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Slug (auto-generated if blank)", <input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="cardiac-action-potential-phases" />)}
                {field("Tags (comma separated)", <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cardiology, high-yield" />)}
              </div>

              {/* Rich content editor — visual block editor with live preview */}
              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Content * — editor</span>
                  <div className="flex rounded-lg border border-border p-0.5">
                    <button onClick={() => setEditorTab("write")}
                      className={clsx("flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold", editorTab === "write" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <PenLine size={12} /> Blocks
                    </button>
                    <button onClick={() => setEditorTab("canvas")}
                      className={clsx("flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold", editorTab === "canvas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <LayoutTemplate size={12} /> Canvas
                    </button>
                    <button onClick={() => setEditorTab("preview")}
                      className={clsx("flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold", editorTab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <PreviewIcon size={12} /> Preview
                    </button>
                  </div>
                </div>

                {editorTab === "write" ? (
                  <NoteBlockEditor value={content} onChange={setContent} />
                ) : editorTab === "canvas" ? (
                  canvasTab
                ) : (
                  <div className="max-h-[520px] overflow-y-auto rounded-lg border border-border bg-background p-4">
                    {content.trim() ? (
                      <MarkdownNote content={content} />
                    ) : (
                      <p className="py-8 text-center text-xs text-muted-foreground">Nothing to preview yet — switch to Blocks and add content.</p>
                    )}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  Blocks for structured notes · Canvas for free-form designs · Tables, callouts, mermaid diagrams, LaTeX math, images and canvas designs all render on the student side.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {field("Status", (
                  <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                ))}
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Featured (pinned to top)</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving…" : editing ? "Save changes" : "Create note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1", tone ?? "text-foreground")}>{value}</p>
    </div>
  );
}
