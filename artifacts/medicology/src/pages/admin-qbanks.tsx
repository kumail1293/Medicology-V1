import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  Search,
  Layers,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Qbank {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  price?: number | null;
  currency: string;
  durationDays: number;
  accessType: string;
  sortOrder: number;
  active: boolean;
  questionCount: number;
  countryId?: number | null;
  examSystemId?: number | null;
  examId?: number | null;
  programId?: number | null;
  academicYearId?: number | null;
  countryName?: string | null;
  countryFlag?: string | null;
  examSystemName?: string | null;
  examName?: string | null;
  examCode?: string | null;
  programName?: string | null;
  yearName?: string | null;
}

interface QbankForm {
  slug: string;
  name: string;
  description: string;
  countryId?: number;
  examSystemId?: number;
  examId?: number;
  programId?: number;
  academicYearId?: number;
  status: string;
  price: string;
  currency: string;
  durationDays: string;
  accessType: string;
  sortOrder: string;
  active: boolean;
}

interface TreeNode {
  id: number;
  name?: string;
  code?: string;
  flag?: string;
  examSystems?: TreeNode[];
  exams?: TreeNode[];
  programs?: TreeNode[];
  years?: TreeNode[];
}

interface TaxonomyTree {
  countries: TreeNode[];
}

const STATUS_META: Record<string, { label: string; chip: string }> = {
  planned: { label: 'Planned', chip: 'bg-muted text-muted-foreground' },
  coming_soon: { label: 'Coming Soon', chip: 'bg-amber-500/15 text-amber-600' },
  beta: { label: 'Beta', chip: 'bg-blue-500/15 text-blue-600' },
  available: { label: 'Available', chip: 'bg-green-600/15 text-green-700' },
  paused: { label: 'Paused', chip: 'bg-orange-500/15 text-orange-600' },
  archived: { label: 'Archived', chip: 'bg-muted text-muted-foreground' },
};

const QBANK_STATUSES = ['planned', 'coming_soon', 'beta', 'available', 'paused', 'archived'];
const ACCESS_TYPES = ['subscription', 'lifetime', 'institutional'];

const emptyForm = (): QbankForm => ({
  slug: '',
  name: '',
  description: '',
  countryId: undefined,
  examSystemId: undefined,
  examId: undefined,
  programId: undefined,
  academicYearId: undefined,
  status: 'planned',
  price: '',
  currency: 'PKR',
  durationDays: '365',
  accessType: 'subscription',
  sortOrder: '0',
  active: true,
});

const toForm = (q: Qbank): QbankForm => ({
  slug: q.slug,
  name: q.name,
  description: q.description ?? '',
  countryId: q.countryId ?? undefined,
  examSystemId: q.examSystemId ?? undefined,
  examId: q.examId ?? undefined,
  programId: q.programId ?? undefined,
  academicYearId: q.academicYearId ?? undefined,
  status: q.status,
  price: q.price != null ? String(q.price) : '',
  currency: q.currency,
  durationDays: String(q.durationDays),
  accessType: q.accessType,
  sortOrder: String(q.sortOrder),
  active: q.active,
});

export default function AdminQBanksPage() {
  const { toast } = useToast();
  const [qbanks, setQbanks] = useState<Qbank[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<TaxonomyTree | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Qbank | null>(null);
  const [form, setForm] = useState<QbankForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [mapQbank, setMapQbank] = useState<Qbank | null>(null);
  const [mappedIds, setMappedIds] = useState<Set<number>>(new Set());
  const [mappedQuestions, setMappedQuestions] = useState<any[]>([]);
  const [mapSearch, setMapSearch] = useState('');
  const [mapResults, setMapResults] = useState<any[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/qbanks');
      if (!res.ok) throw new Error('Failed to load QBanks');
      const data = await res.json();
      setQbanks(data.qbanks || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load QBanks', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void fetch('/api/taxonomy/tree')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTree(data))
      .catch(() => {});
  }, [load]);

  // --- Cascading taxonomy options ---
  const countryOptions = tree?.countries ?? [];
  const examSystemOptions = countryOptions.find((c) => c.id === form.countryId)?.examSystems ?? [];
  const examOptions = examSystemOptions.find((es) => es.id === form.examSystemId)?.exams ?? [];
  const programOptions = examOptions.find((e) => e.id === form.examId)?.programs ?? [];
  const yearOptions = programOptions.find((p) => p.id === form.programId)?.years ?? [];

  const updateForm = (patch: Partial<QbankForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const onCountry = (value: string) =>
    updateForm({ countryId: value ? Number(value) : undefined, examSystemId: undefined, examId: undefined, programId: undefined, academicYearId: undefined });
  const onExamSystem = (value: string) =>
    updateForm({ examSystemId: value ? Number(value) : undefined, examId: undefined, programId: undefined, academicYearId: undefined });
  const onExam = (value: string) =>
    updateForm({ examId: value ? Number(value) : undefined, programId: undefined, academicYearId: undefined });
  const onProgram = (value: string) => updateForm({ programId: value ? Number(value) : undefined, academicYearId: undefined });
  const onYear = (value: string) => updateForm({ academicYearId: value ? Number(value) : undefined });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (qbank: Qbank) => {
    setEditing(qbank);
    setForm(toForm(qbank));
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        price: form.price ? Number(form.price) : null,
        durationDays: Number(form.durationDays) || 365,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const url = editing ? `/api/admin/qbanks/${editing.id}` : '/api/admin/qbanks';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save QBank');
      toast({ title: 'Success', description: editing ? 'QBank updated' : 'QBank created' });
      setModalOpen(false);
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (qbank: Qbank) => {
    if (!window.confirm(`Archive "${qbank.name}"? It will no longer be purchasable.`)) return;
    try {
      const res = await fetch(`/api/admin/qbanks/${qbank.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Archive failed');
      toast({ title: 'Success', description: 'QBank archived' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to archive QBank', variant: 'destructive' });
    }
  };

  // --- Question mapping ---
  const openMapping = async (qbank: Qbank) => {
    setMapQbank(qbank);
    setMapSearch('');
    setMapResults([]);
    try {
      const res = await fetch(`/api/admin/qbanks/${qbank.id}/questions`);
      if (!res.ok) throw new Error('Failed to load mapping');
      const data = await res.json();
      setMappedIds(new Set((data.questionIds || []).map(Number)));
      setMappedQuestions(data.questions || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load question mapping', variant: 'destructive' });
      setMappedIds(new Set());
      setMappedQuestions([]);
    }
  };

  const runMapSearch = async (term: string) => {
    setMapSearch(term);
    if (!term.trim()) {
      setMapResults([]);
      return;
    }
    setMapLoading(true);
    try {
      const res = await fetch(`/api/admin/questions?search=${encodeURIComponent(term.trim())}&limit=100`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setMapResults(data.questions || []);
    } catch {
      setMapResults([]);
    } finally {
      setMapLoading(false);
    }
  };

  const toggleMapped = (questionId: number) => {
    setMappedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const saveMapping = async () => {
    if (!mapQbank) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qbanks/${mapQbank.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: Array.from(mappedIds) }),
      });
      if (!res.ok) throw new Error('Failed to save mapping');
      toast({ title: 'Success', description: `Mapped ${mappedIds.size} question(s)` });
      setMapQbank(null);
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = qbanks.filter(
    (q) =>
      !search.trim() ||
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.slug.toLowerCase().includes(search.toLowerCase()) ||
      (q.examCode ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Database size={24} className="text-primary" />
            QBanks
          </h2>
          <p className="text-sm text-muted-foreground">Database-driven products — status, pricing, and question mapping.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          New QBank
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, slug, or exam code"
            className="w-full border-0 bg-transparent outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading QBanks…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No QBanks found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((qbank) => {
              const meta = STATUS_META[qbank.status] ?? STATUS_META.planned;
              return (
                <div key={qbank.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {qbank.countryFlag && <span className="text-base">{qbank.countryFlag}</span>}
                      <p className="font-semibold truncate">{qbank.name}</p>
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', meta.chip)}>{meta.label}</span>
                      {!qbank.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-1 font-mono">{qbank.slug}</span>
                      {qbank.examName && <span className="rounded-full bg-muted px-2 py-1">{qbank.examName}</span>}
                      {qbank.programName && <span className="rounded-full bg-muted px-2 py-1">{qbank.programName}</span>}
                      {qbank.yearName && <span className="rounded-full bg-muted px-2 py-1">{qbank.yearName}</span>}
                      {qbank.price != null && (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          {qbank.currency} {qbank.price.toLocaleString()} · {qbank.durationDays}d
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      <Layers size={14} className="inline mr-1" />
                      {qbank.questionCount} Qs
                    </span>
                    <button
                      onClick={() => void openMapping(qbank)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
                    >
                      <Layers size={13} />
                      Map Questions
                    </button>
                    <button
                      onClick={() => openEdit(qbank)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => void handleArchive(qbank)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                      title="Archive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editing ? 'Edit QBank' : 'Create QBank'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Slug</label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => updateForm({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="uhs-mbbs-2nd-year"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="UHS MBBS 2nd Year"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Taxonomy cascades */}
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Country</label>
                  <select value={form.countryId ?? ''} onChange={(e) => onCountry(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    <option value="">—</option>
                    {countryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam System</label>
                  <select value={form.examSystemId ?? ''} onChange={(e) => onExamSystem(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    <option value="">—</option>
                    {examSystemOptions.map((es) => (
                      <option key={es.id} value={es.id}>{es.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam</label>
                  <select value={form.examId ?? ''} onChange={(e) => onExam(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    <option value="">—</option>
                    {examOptions.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.code} — {ex.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Program</label>
                  <select value={form.programId ?? ''} onChange={(e) => onProgram(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    <option value="">—</option>
                    {programOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Year</label>
                  <select value={form.academicYearId ?? ''} onChange={(e) => onYear(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    <option value="">—</option>
                    {yearOptions.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Status</label>
                  <select value={form.status} onChange={(e) => updateForm({ status: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {QBANK_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Price</label>
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => updateForm({ price: e.target.value })}
                    placeholder="999"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Currency</label>
                  <select value={form.currency} onChange={(e) => updateForm({ currency: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.durationDays}
                    onChange={(e) => updateForm({ durationDays: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Access Type</label>
                  <select value={form.accessType} onChange={(e) => updateForm({ accessType: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {ACCESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => updateForm({ sortOrder: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm font-medium pb-2">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => updateForm({ active: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create QBank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question mapping modal */}
      {mapQbank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Layers size={20} className="text-primary" />
                Map Questions — {mapQbank.name}
              </h3>
              <button onClick={() => setMapQbank(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={mapSearch}
                onChange={(e) => void runMapSearch(e.target.value)}
                placeholder="Search questions by text or QID…"
                className="w-full border-0 bg-transparent text-sm outline-none"
              />
              {mapLoading && <span className="text-xs text-muted-foreground">searching…</span>}
            </div>

            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">
                <Check size={14} className="inline mr-1 text-green-600" />
                {mappedIds.size} selected
              </span>
              <button onClick={() => setMappedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
                Clear selection
              </button>
            </div>

            {/* Currently mapped */}
            {mappedQuestions.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Currently mapped</p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {mappedQuestions.map((q) => (
                    <label key={q.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={mappedIds.has(Number(q.id))}
                        onChange={() => toggleMapped(Number(q.id))}
                        className="h-4 w-4"
                      />
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">{q.qid}</span>
                      <span className="flex-1 truncate">{q.questionText}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Search results */}
            {mapResults.length > 0 && (
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search results</p>
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {mapResults.map((q) => (
                    <label key={q.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={mappedIds.has(Number(q.id))}
                        onChange={() => toggleMapped(Number(q.id))}
                        className="h-4 w-4"
                      />
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">{q.qid}</span>
                      <span className="flex-1 truncate">{q.questionText}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {mapSearch.trim() && mapResults.length === 0 && !mapLoading && (
              <p className="py-3 text-center text-sm text-muted-foreground">No questions match “{mapSearch}”.</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setMapQbank(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50">
                Cancel
              </button>
              <button onClick={() => void saveMapping()} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Saving…' : `Save (${mappedIds.size} questions)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
