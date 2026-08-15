import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, ArrowLeft, Plus, Trash2, Copy, ChevronUp, ChevronDown, Monitor, Tablet, Smartphone,
  Save, Send, Eye, Rocket, Loader2, Search, X, Clock, FileText, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchEmailTemplates, createEmailTemplate, updateEmailTemplate, setTemplateStatus,
  restoreTemplateVersion, renderTemplatePreview, sendTestEmail, fetchEmailVariables,
  fetchEmailLogs, seedEmailTemplates, blankBlock, BLOCK_PALETTE, uid,
  EmailBlock, EmailTemplate,
} from "@/lib/emailTemplates";

type Device = "desktop" | "tablet" | "mobile";

export default function AdminEmail() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const load = async () => {
    try {
      const [ts, ls] = await Promise.all([fetchEmailTemplates(), fetchEmailLogs(30)]);
      setTemplates(ts);
      setLogs(ls);
    } catch (e: any) {
      toast({ title: "Failed to load email templates", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [templates, search]
  );

  const handleRestore = async () => {
    if (!window.confirm("Restore the default template library? Existing custom templates are kept; only missing slugs are added.")) return;
    try {
      const r = await seedEmailTemplates();
      toast({ title: "Templates restored", description: `${r.created} added — ${r.total} total.` });
      await load();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const t = await createEmailTemplate({
        name: newName.trim(),
        category: "transactional",
        subject: "Subject line",
        bodyBlocks: [
          blankBlock("heading"),
          blankBlock("text"),
          blankBlock("button"),
        ],
        variables: [],
      });
      toast({ title: "Template created" });
      setShowNew(false);
      setNewName("");
      setEditing(t);
      await load();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="text-primary" size={22} /> Email Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Visual block builder — draft, preview, test and publish.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRestore}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary/40 transition-colors">
            <RotateCcw size={15} /> Restore defaults
          </button>
          <button onClick={() => setShowLogs(!showLogs)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary/40 transition-colors">
            <Clock size={15} /> Send Logs
          </button>
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors">
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {showLogs && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent sends</h2>
            <button onClick={() => setShowLogs(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">To</th><th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Provider</th><th className="py-2 pr-4">Status</th><th className="py-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No sends recorded yet.</td></tr>}
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{l.to}</td>
                    <td className="py-2 pr-4 max-w-[260px] truncate">{l.subject}</td>
                    <td className="py-2 pr-4">{l.provider}</td>
                    <td className="py-2 pr-4">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        l.status === "sent" ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600")}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New email template</h2>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Welcome email"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleCreate} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Create</button>
            </div>
          </div>
        </div>
      )}

      {editing ? (
        <EmailBuilder
          template={editing}
          onBack={() => { setEditing(null); load(); }}
          onSaved={(t) => setEditing(t)}
          onChanged={setEditing}
        />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…"
              className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 rounded-2xl border border-border bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <FileText className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="font-semibold">No templates yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first email template to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/40 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        t.status === "published" ? "bg-green-500/15 text-green-600"
                          : t.status === "archived" ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/15 text-amber-600")}>
                        {t.status}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">v{t.version}</span>
                    </div>
                    <button onClick={() => setEditing(t)} className="text-muted-foreground hover:text-primary"><Eye size={16} /></button>
                  </div>
                  <div>
                    <p className="font-bold truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t.category}</span>
                    <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(t)} className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-bold hover:bg-primary/90">Open builder</button>
                    {t.status !== "published" && (
                      <button onClick={async () => { await setTemplateStatus(t.id, "published"); toast({ title: "Published" }); load(); }}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-green-500/50 hover:text-green-600">Publish</button>
                    )}
                    {t.status !== "archived" && (
                      <button onClick={async () => { await setTemplateStatus(t.id, "archived"); toast({ title: "Archived" }); load(); }}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-red-500/50 hover:text-red-600">Archive</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Visual builder — LEFT: palette · CENTER: canvas · RIGHT: properties
 * ───────────────────────────────────────────────────────────────────────── */

function EmailBuilder({ template, onBack, onSaved, onChanged }: {
  template: EmailTemplate;
  onBack: () => void;
  onSaved: (t: EmailTemplate) => void;
  onChanged: (t: EmailTemplate) => void;
}) {
  const { toast } = useToast();
  const [device, setDevice] = useState<Device>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [preheader, setPreheader] = useState(template.preheader ?? "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template.bodyBlocks?.length ? template.bodyBlocks : [blankBlock("heading"), blankBlock("text"), blankBlock("button")]);

  useEffect(() => { fetchEmailVariables().then((v) => setVariables(v.variables)); }, []);

  const setBlock = (id: string, patch: Partial<EmailBlock>) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const copy = { ...bs[i], id: uid() };
      return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)];
    });
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const handleSave = async (publish = false) => {
    setSaving(true);
    try {
      const t = await updateEmailTemplate(template.id, {
        name, subject, preheader: preheader || null,
        bodyBlocks: blocks.map(({ id: _id, ...rest }) => rest),
      });
      if (publish) await setTemplateStatus(t.id, "published");
      toast({ title: publish ? "Published" : "Saved", description: `Version ${t.version}` });
      onSaved(t);
      onChanged(t);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      // Persist current edits first so preview reflects the latest blocks.
      const t = await updateEmailTemplate(template.id, {
        name, subject, preheader: preheader || null,
        bodyBlocks: blocks.map(({ id: _id, ...rest }) => rest),
      });
      onChanged(t);
      const p = await renderTemplatePreview(t.id);
      setPreviewSubject(p.subject);
      setPreviewHtml(p.html);
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    }
  };

  const handleTest = async () => {
    if (!testTo.includes("@")) return;
    try {
      const { result } = await sendTestEmail(template.id, testTo);
      toast({ title: result.status === "sent" ? "Test email sent" : "Send failed", description: result.error ?? `Provider: ${result.provider}` });
      setTestOpen(false);
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    }
  };

  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? "640px" : "375px";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><ArrowLeft size={18} /></button>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="bg-transparent font-bold text-lg outline-none border-b border-transparent focus:border-primary/40 w-56" />
          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
            template.status === "published" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600")}>
            {template.status} · v{template.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border overflow-hidden">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as [Device, any][]).map(([d, Icon]) => (
              <button key={d} onClick={() => setDevice(d)}
                className={cn("p-2.5 transition-colors", device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          <button onClick={handlePreview} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:border-primary/40">
            <Eye size={14} /> Preview
          </button>
          <button onClick={() => setTestOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:border-primary/40">
            <Send size={14} /> Test
          </button>
          <button onClick={() => handleSave(false)} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:border-primary/40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold shadow-lg shadow-primary/25 hover:bg-primary/90">
            <Rocket size={14} /> Publish
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* LEFT — palette */}
        <div className="w-52 shrink-0 rounded-2xl border border-border bg-card p-3 overflow-y-auto custom-scrollbar hidden md:block">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Blocks</p>
          <div className="space-y-1.5">
            {BLOCK_PALETTE.map((b) => (
              <button key={b.type}
                onClick={() => { const blk = blankBlock(b.type); setBlocks((bs) => [...bs, blk]); setSelectedId(blk.id ?? null); }}
                className="w-full text-left rounded-xl border border-border px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <p className="text-xs font-semibold">{b.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{b.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 px-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Variables</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">Use <code className="text-primary">{"{{user.name}}"}</code> style tokens. Unknown tokens render empty.</p>
          </div>
        </div>

        {/* CENTER — canvas */}
        <div className="flex-1 rounded-2xl border border-border bg-muted/30 p-4 overflow-y-auto custom-scrollbar">
          <div className="mx-auto rounded-xl bg-white shadow-xl border border-border transition-all duration-300" style={{ maxWidth: deviceWidth }}>
            <div className="border-b border-border px-6 py-3 bg-muted/40 rounded-t-xl">
              <p className="text-sm font-semibold text-gray-800 truncate">{subject || "Subject line"}</p>
              {preheader && <p className="text-[11px] text-gray-500 truncate">{preheader}</p>}
            </div>
            <div className="p-6 space-y-3">
              {blocks.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400">Add a block from the palette to start building.</div>
              )}
              {blocks.map((b, i) => (
                <div key={b.id}
                  onClick={() => setSelectedId(b.id ?? null)}
                  className={cn("group relative rounded-lg border-2 p-2 cursor-pointer transition-colors",
                    selectedId === b.id ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/30")}>
                  <div className="absolute -top-3 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); moveBlock(b.id!, -1); }} className="rounded-md bg-background border border-border p-1 shadow hover:text-primary"><ChevronUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveBlock(b.id!, 1); }} className="rounded-md bg-background border border-border p-1 shadow hover:text-primary"><ChevronDown size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); duplicateBlock(b.id!); }} className="rounded-md bg-background border border-border p-1 shadow hover:text-primary"><Copy size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id!); }} className="rounded-md bg-background border border-border p-1 shadow hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                  <BlockPreview block={b} index={i} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — properties */}
        <div className="w-72 shrink-0 rounded-2xl border border-border bg-card p-4 overflow-y-auto custom-scrollbar hidden lg:block">
          {!selected ? (
            <div className="text-center text-sm text-muted-foreground pt-10">
              <p className="font-semibold mb-1">No block selected</p>
              <p className="text-xs">Click a block on the canvas to edit its properties.</p>
            </div>
          ) : (
            <BlockProperties block={selected} set={(patch) => setBlock(selected.id!, patch)} variables={variables} />
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewHtml(null)}>
          <div className="w-full max-w-4xl h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <p className="font-semibold text-sm truncate">{previewSubject}</p>
              <button onClick={() => setPreviewHtml(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
            </div>
            <iframe title="Email preview" srcDoc={previewHtml} className="flex-1 w-full bg-gray-100" />
          </div>
        </div>
      )}

      {/* Test modal */}
      {testOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTestOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Send a test email</h2>
            <p className="text-sm text-muted-foreground mb-4">The latest saved version will be sent to the address below.</p>
            <input autoFocus value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setTestOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleTest} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Send test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline canvas preview of a block ──────────────────────────────────── */

function BlockPreview({ block }: { block: EmailBlock; index: number }) {
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? "text-2xl" : block.level === 3 ? "text-base" : "text-xl";
      return <p className={cn("font-bold text-gray-800", size)} style={{ textAlign: block.align ?? "left" }}>{block.text || "Heading"}</p>;
    }
    case "text":
      return <p className="text-sm text-gray-600 leading-relaxed" style={{ textAlign: block.align ?? "left" }} dangerouslySetInnerHTML={{ __html: block.html ?? block.text ?? "" }} />;
    case "image":
      return block.url
        ? <img src={block.url} alt={block.alt ?? ""} className="max-h-24 mx-auto rounded object-contain" />
        : <div className="h-16 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">Image — set URL in properties</div>;
    case "button":
      return <div style={{ textAlign: block.align ?? "left" }}>
        <span className="inline-block rounded-lg px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: block.style === "primary" ? "#0d9488" : "#111827", border: block.style === "ghost" ? "1px solid #d1d5db" : "none", color: block.style === "ghost" ? "#111827" : "#fff" }}>
          {block.label || "Button"}
        </span>
      </div>;
    case "divider":
      return <hr className="border-gray-200" />;
    case "spacer":
      return <div style={{ height: block.height ?? 24 }} />;
    case "columns":
      return <div className="grid grid-cols-2 gap-3 text-xs text-gray-600"><div>{block.left}</div><div>{block.right}</div></div>;
    case "social":
      return <div className="flex gap-2">
        {(block.items ?? []).map((s: any, i: number) => (
          <span key={i} className="rounded-full border border-gray-200 px-3 py-1 text-[10px] text-gray-500">{s.platform}</span>
        ))}
      </div>;
    case "qbankCard":
      return <div className="rounded-xl border border-gray-200 p-3">
        {block.image && <img src={block.image} alt="" className="w-full h-20 object-cover rounded mb-2" />}
        <p className="font-bold text-sm text-gray-800">{block.name}</p>
        <p className="text-xs text-gray-500">{block.price}</p>
        <span className="inline-block mt-2 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white">View QBank</span>
      </div>;
    case "resultSummary":
      return <div className="rounded-xl border border-gray-200 p-4 text-center">
        <p className="text-2xl font-extrabold" style={{ color: block.passed ? "#059669" : "#dc2626" }}>{block.percentage}%</p>
        <p className="text-xs text-gray-500">{block.score} / {block.total}</p>
        <p className="text-[10px] font-bold mt-1" style={{ color: block.passed ? "#059669" : "#dc2626" }}>{block.passed ? "PASSED" : "NOT PASSED"}</p>
      </div>;
    case "footer":
      return <p className="text-[11px] text-gray-400 text-center">{block.text}</p>;
    case "unsubscribe":
      return <p className="text-[11px] text-gray-400 text-center underline">{block.label ?? "Unsubscribe"}</p>;
    case "custom":
      return <div className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: block.html ?? "" }} />;
    default:
      return null;
  }
}

/* ── Right-pane property editor ────────────────────────────────────────── */

function BlockProperties({ block, set, variables }: { block: EmailBlock; set: (patch: Partial<EmailBlock>) => void; variables: string[] }) {
  const [showVars, setShowVars] = useState(false);
  const insertVar = (v: string) => {
    if (block.type === "text") set({ html: (block.html ?? "") + `{{${v}}}` });
    else if (block.type === "heading") set({ text: (block.text ?? "") + `{{${v}}}` });
  };
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Block properties</p>
      <div className="space-y-3">
        {block.type === "heading" && (
          <>
            <Field label="Text"><input className={input} value={block.text ?? ""} onChange={(e) => set({ text: e.target.value })} /></Field>
            <Field label="Level">
              <select className={input} value={block.level} onChange={(e) => set({ level: Number(e.target.value) })}>
                <option value={1}>Heading 1</option><option value={2}>Heading 2</option><option value={3}>Heading 3</option>
              </select>
            </Field>
          </>
        )}
        {block.type === "text" && (
          <>
            <Field label="Rich text">
              <textarea className={cn(input, "font-mono text-xs h-28 resize-y")} value={block.html ?? ""} onChange={(e) => set({ html: e.target.value })} />
            </Field>
            <button onClick={() => setShowVars(!showVars)} className="text-xs text-primary font-semibold">Insert variable…</button>
            {showVars && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                {variables.map((v) => (
                  <button key={v} onClick={() => { insertVar(v); setShowVars(false); }} className="block w-full text-left text-xs hover:bg-primary/10 rounded px-2 py-1 font-mono">{"{{" + v + "}}"}</button>
                ))}
              </div>
            )}
          </>
        )}
        {block.type === "image" && (
          <>
            <Field label="Image URL"><input className={input} value={block.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Alt text"><input className={input} value={block.alt ?? ""} onChange={(e) => set({ alt: e.target.value })} /></Field>
            <Field label="Width"><input type="number" className={input} value={block.width ?? 480} onChange={(e) => set({ width: Number(e.target.value) })} /></Field>
          </>
        )}
        {block.type === "button" && (
          <>
            <Field label="Label"><input className={input} value={block.label ?? ""} onChange={(e) => set({ label: e.target.value })} /></Field>
            <Field label="URL"><input className={input} value={block.url ?? ""} onChange={(e) => set({ url: e.target.value })} /></Field>
            <Field label="Style">
              <select className={input} value={block.style ?? "primary"} onChange={(e) => set({ style: e.target.value })}>
                <option value="primary">Primary</option><option value="secondary">Dark</option><option value="ghost">Ghost</option>
              </select>
            </Field>
          </>
        )}
        {block.type === "divider" && (
          <Field label="Style">
            <select className={input} value={block.style ?? "solid"} onChange={(e) => set({ style: e.target.value })}>
              <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="spaced">Spaced</option>
            </select>
          </Field>
        )}
        {block.type === "spacer" && (
          <Field label="Height (px)"><input type="number" className={input} value={block.height ?? 24} onChange={(e) => set({ height: Number(e.target.value) })} /></Field>
        )}
        {block.type === "columns" && (
          <>
            <Field label="Left column"><textarea className={cn(input, "h-20 resize-y")} value={block.left ?? ""} onChange={(e) => set({ left: e.target.value })} /></Field>
            <Field label="Right column"><textarea className={cn(input, "h-20 resize-y")} value={block.right ?? ""} onChange={(e) => set({ right: e.target.value })} /></Field>
          </>
        )}
        {block.type === "social" && (
          <div>
            {(block.items ?? []).map((s: any, i: number) => (
              <div key={i} className="mb-2 flex gap-1.5">
                <input className={cn(input, "w-24")} value={s.platform} onChange={(e) => { const items = [...(block.items ?? [])]; items[i] = { ...items[i], platform: e.target.value }; set({ items }); }} />
                <input className={input} value={s.url} onChange={(e) => { const items = [...(block.items ?? [])]; items[i] = { ...items[i], url: e.target.value }; set({ items }); }} />
              </div>
            ))}
            <button onClick={() => set({ items: [...(block.items ?? []), { platform: "facebook", url: "" }] })} className="text-xs text-primary font-semibold">+ Add platform</button>
          </div>
        )}
        {block.type === "qbankCard" && (
          <>
            <Field label="Name"><input className={input} value={block.name ?? ""} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Price"><input className={input} value={block.price ?? ""} onChange={(e) => set({ price: e.target.value })} /></Field>
            <Field label="URL"><input className={input} value={block.url ?? ""} onChange={(e) => set({ url: e.target.value })} /></Field>
            <Field label="Image"><input className={input} value={block.image ?? ""} onChange={(e) => set({ image: e.target.value })} /></Field>
          </>
        )}
        {block.type === "resultSummary" && (
          <>
            <Field label="Score"><input className={input} value={block.score ?? ""} onChange={(e) => set({ score: e.target.value })} /></Field>
            <Field label="Total"><input className={input} value={block.total ?? ""} onChange={(e) => set({ total: e.target.value })} /></Field>
            <Field label="Percentage"><input className={input} value={block.percentage ?? ""} onChange={(e) => set({ percentage: e.target.value })} /></Field>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={block.passed} onChange={(e) => set({ passed: e.target.checked })} /> Passed</label>
          </>
        )}
        {block.type === "footer" && (
          <Field label="Footer text"><textarea className={cn(input, "h-20 resize-y")} value={block.text ?? ""} onChange={(e) => set({ text: e.target.value })} /></Field>
        )}
        {block.type === "unsubscribe" && (
          <Field label="Label"><input className={input} value={block.label ?? "Unsubscribe"} onChange={(e) => set({ label: e.target.value })} /></Field>
        )}
        {block.type === "custom" && (
          <Field label="Custom HTML (sanitized)">
            <textarea className={cn(input, "font-mono text-xs h-32 resize-y")} value={block.html ?? ""} onChange={(e) => set({ html: e.target.value })} />
          </Field>
        )}
        {(block.type === "heading" || block.type === "text" || block.type === "button") && (
          <Field label="Alignment">
            <select className={input} value={block.align ?? "left"} onChange={(e) => set({ align: e.target.value })}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
