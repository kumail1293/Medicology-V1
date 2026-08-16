import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Search, Save, RotateCcw, Loader2, Table2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Pencil, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import QuestionEditorModal, { QUESTION_TYPE_LABELS } from '@/components/QuestionEditorModal';

// A row mirrors the spreadsheet API response (flat, editable fields).
interface GridRow {
  id: number;
  qid: string | null;
  questionText: string;
  questionType: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  whyCorrect: string;
  whyWrong: string;
  examPearl: string;
  commonTrap: string;
  subject: string;
  system: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  status: string;
  tags: string[];
  isFree: boolean;
}

// Virtual grid cell keys — option cells map onto row.options.A..E.
type CellKey =
  | 'questionText'
  | 'optionA'
  | 'optionB'
  | 'optionC'
  | 'optionD'
  | 'optionE'
  | 'correctAnswer'
  | 'subject'
  | 'system'
  | 'topic'
  | 'subtopic'
  | 'difficulty'
  | 'status'
  | 'explanation'
  | 'whyCorrect'
  | 'whyWrong'
  | 'examPearl'
  | 'commonTrap'
  | 'questionType'
  | 'tags'
  | 'isFree';

// Editable columns in grid order.
const COLUMNS: { key: CellKey; label: string; width: number; editor?: 'text' | 'select' }[] = [
  { key: 'questionText', label: 'Question', width: 420 },
  { key: 'optionA', label: 'Option A', width: 180 },
  { key: 'optionB', label: 'Option B', width: 180 },
  { key: 'optionC', label: 'Option C', width: 180 },
  { key: 'optionD', label: 'Option D', width: 180 },
  { key: 'optionE', label: 'Option E', width: 180 },
  { key: 'correctAnswer', label: 'Answer', width: 80 },
  { key: 'subject', label: 'Subject', width: 140 },
  { key: 'system', label: 'System', width: 140 },
  { key: 'topic', label: 'Topic', width: 160 },
  { key: 'subtopic', label: 'Subtopic', width: 160 },
  { key: 'difficulty', label: 'Difficulty', width: 110, editor: 'select' },
  { key: 'status', label: 'Status', width: 150, editor: 'select' },
  { key: 'explanation', label: 'Explanation', width: 320 },
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const STATUSES = ['draft', 'pending_review', 'under_medical_review', 'approved', 'published', 'flagged', 'errata', 'archived'];

function cellValue(row: GridRow, key: CellKey): string {
  if (key === 'optionA') return row.options?.A ?? '';
  if (key === 'optionB') return row.options?.B ?? '';
  if (key === 'optionC') return row.options?.C ?? '';
  if (key === 'optionD') return row.options?.D ?? '';
  if (key === 'optionE') return row.options?.E ?? '';
  if (key === 'tags') return Array.isArray(row.tags) ? row.tags.join(', ') : '';
  return (row[key as keyof GridRow] ?? '') as string;
}

// A dirty cell = { rowId, key, value }.
interface DirtyCell {
  rowId: number;
  key: string;
  value: string;
}

export default function AdminSpreadsheetPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dirty, setDirty] = useState<DirtyCell[]>([]);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [editingRow, setEditingRow] = useState<GridRow | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const pendingRef = useRef(false);

  const loadRows = async (query = search, status = statusFilter, off = offset) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(limit), offset: String(off) });
      if (query.trim()) params.set('search', query.trim());
      if (status) params.set('status', status);
      const res = await apiFetch(`/api/admin/questions/spreadsheet?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load grid');
      const data = await res.json();
      setRows(data.questions || []);
      setTotal(Number(data.total) || 0);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load grid', variant: 'destructive' });
    } finally {
      setLoading(false);
      pendingRef.current = false;
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell editing ───────────────────────────────────────────────────
  const setCell = (rowId: number, key: string, value: string) => {
    setDirty((prev) => {
      const existing = prev.findIndex((d) => d.rowId === rowId && d.key === key);
      if (existing >= 0) {
        const next = [...prev];
        const found = rows.find((r) => r.id === rowId);
        if (found && value === cellValue(found, key as CellKey)) {
          next.splice(existing, 1);
        } else {
          next[existing] = { rowId, key, value };
        }
        return next;
      }
      return [...prev, { rowId, key, value }];
    });
  };

  const dirtyCount = dirty.length;

  const resetAll = () => {
    setDirty([]);
    toast({ title: 'Changes discarded', description: 'All edits reverted to the saved values.' });
  };

  const saveAll = async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      // Group dirty cells by row → one payload row per question.
      const byRow = new Map<number, Record<string, any>>();
      for (const cell of dirty) {
        if (!byRow.has(cell.rowId)) byRow.set(cell.rowId, { id: cell.rowId });
        const target = byRow.get(cell.rowId)!;
        if (cell.key === 'optionA') target.optionA = cell.value;
        else if (cell.key === 'optionB') target.optionB = cell.value;
        else if (cell.key === 'optionC') target.optionC = cell.value;
        else if (cell.key === 'optionD') target.optionD = cell.value;
        else if (cell.key === 'optionE') target.optionE = cell.value;
        else target[cell.key] = cell.value;
      }
      const res = await apiFetch('/api/admin/questions/spreadsheet/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [...byRow.values()] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast({
        title: 'Saved',
        description: `${data.changed} question(s) updated.`,
        variant: data.changed > 0 ? 'default' : 'destructive',
      });
      setDirty([]);
      await loadRows();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const dirtyForRow = (rowId: number) => dirty.filter((d) => d.rowId === rowId);

  const rowStatus = (row: GridRow) => {
    const cells = dirtyForRow(row.id);
    if (cells.length === 0) return null;
    return { count: cells.length };
  };

  const openFullEditor = (row: GridRow) => setEditingRow(row);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;

  const summary = useMemo(() => {
    const changedRows = new Set(dirty.map((d) => d.rowId)).size;
    return { changedRows };
  }, [dirty]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold"><Table2 size={20} className="text-primary" /> Spreadsheet Editor</h2>
          <p className="text-sm text-muted-foreground">
            Edit questions in an Excel-style grid — click any cell, type, then <b>Save changes</b>. Everything is versioned and audited.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            disabled={dirtyCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-40"
          >
            <RotateCcw size={14} /> Discard
          </button>
          <button
            onClick={() => void saveAll()}
            disabled={dirtyCount === 0 || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes {dirtyCount > 0 && `(${dirtyCount} cell${dirtyCount === 1 ? '' : 's'}, ${summary.changedRows} row${summary.changedRows === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setOffset(0); setSearch(e.target.value); }}
            placeholder="Search QID, question text, subject or topic…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-muted-foreground" />
          <select value={statusFilter} onChange={(e) => { setOffset(0); setStatusFilter(e.target.value); }} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{total} question(s) · page {page}/{pages}</span>
          <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="rounded-lg border border-border p-1.5 disabled:opacity-40 hover:border-primary/40"><ChevronLeft size={14} /></button>
          <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="rounded-lg border border-border p-1.5 disabled:opacity-40 hover:border-primary/40"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading grid…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No questions match. Adjust the search or status filter.</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="border-l border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ minWidth: c.width }}>
                      {c.label}
                    </th>
                  ))}
                  <th className="border-l border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ minWidth: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => {
                  const cells = dirtyForRow(row.id);
                  return (
                    <React.Fragment key={row.id}>
                      <tr className={cn('align-top hover:bg-muted/30', cells.length > 0 && 'bg-primary/5')}>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {cells.length > 0
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{cells.length}</span>
                            : (row.qid ?? `#${row.id}`)}
                        </td>
                        {COLUMNS.map((c) => {
                          const isDirty = cells.some((d) => d.key === c.key);
                          const value = isDirty ? cells.find((d) => d.key === c.key)!.value : cellValue(row, c.key);
                          return (
                            <td key={c.key} className={cn('border-l border-border px-2 py-1', c.editor === 'select' && 'whitespace-nowrap')}>
                              {c.editor === 'select' ? (
                                <select
                                  value={value}
                                  onChange={(e) => setCell(row.id, c.key, e.target.value)}
                                  className={cn(
                                    'w-full rounded-md border bg-background px-1.5 py-1 text-xs outline-none',
                                    isDirty ? 'border-primary/60 bg-primary/5' : 'border-transparent hover:border-border'
                                  )}
                                >
                                  {c.key === 'difficulty'
                                    ? DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)
                                    : STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (
                                <textarea
                                  value={value}
                                  rows={c.key === 'questionText' || c.key === 'explanation' ? 2 : 1}
                                  onChange={(e) => setCell(row.id, c.key, e.target.value)}
                                  onClick={() => toggleExpand(row.id)}
                                  className={cn(
                                    'w-full resize-none rounded-md bg-transparent px-1.5 py-1 text-xs leading-snug outline-none',
                                    isDirty ? 'bg-primary/5 ring-1 ring-primary/40' : 'hover:bg-muted/50'
                                  )}
                                  style={{ minWidth: c.width - 20 }}
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="border-l border-border px-2 py-1">
                          <button
                            onClick={() => openFullEditor(row)}
                            title="Open full editor for this question"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                      {expanded.has(row.id) && (
                        <tr className="bg-muted/20">
                          <td colSpan={COLUMNS.length + 2} className="px-4 py-3">
                            <div className="grid gap-4 md:grid-cols-3">
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Why correct</p>
                                <textarea value={row.whyCorrect || ''} onChange={(e) => setCell(row.id, 'whyCorrect', e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Why wrong</p>
                                <textarea value={row.whyWrong || ''} onChange={(e) => setCell(row.id, 'whyWrong', e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Exam pearl / Trap</p>
                                <textarea value={[row.examPearl, row.commonTrap].filter(Boolean).join(' · ') || ''} onChange={(e) => {
                                  const [pearl, trap] = e.target.value.split(' · ');
                                  setCell(row.id, 'examPearl', pearl ?? '');
                                  setCell(row.id, 'commonTrap', trap ?? '');
                                }} rows={2} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                                <select value={row.questionType} onChange={(e) => setCell(row.id, 'questionType', e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                                  {Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                                <input value={(row.tags || []).join(', ')} onChange={(e) => setCell(row.id, 'tags', e.target.value)} placeholder="comma separated" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Free sample</p>
                                <label className="flex items-center gap-2 text-xs">
                                  <input type="checkbox" checked={Boolean(row.isFree)} onChange={(e) => setCell(row.id, 'isFree', e.target.checked ? 'true' : 'false')} />
                                  Available for free preview
                                </label>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dirtyCount > 0 && !loading && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-xl border border-primary/30 bg-card px-4 py-3 shadow-2xl">
          <span className="text-sm"><b>{dirtyCount}</b> unsaved change(s) in <b>{summary.changedRows}</b> row(s)</span>
          <button onClick={resetAll} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">Discard</button>
          <button onClick={() => void saveAll()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>
      )}

      {/* Full editor modal for a row */}
      {editingRow && (
        <QuestionEditorModal
          open
          title={`Edit Question ${editingRow.qid ?? `#${editingRow.id}`}`}
          initial={{
            questionText: editingRow.questionText || '',
            questionType: editingRow.questionType || 'sba',
            subject: editingRow.subject || '',
            system: editingRow.system || '',
            topic: editingRow.topic || '',
            subtopic: editingRow.subtopic || '',
            universityTag: '',
            explanation: editingRow.explanation || '',
            whyCorrect: editingRow.whyCorrect || '',
            whyWrong: editingRow.whyWrong || '',
            examPearl: editingRow.examPearl || '',
            commonTrap: editingRow.commonTrap || '',
            assertion: '',
            reason: '',
            correctAnswer: (editingRow.correctAnswer || 'A') as 'A' | 'B' | 'C' | 'D' | 'E',
            optionA: editingRow.options?.A ?? '',
            optionB: editingRow.options?.B ?? '',
            optionC: editingRow.options?.C ?? '',
            optionD: editingRow.options?.D ?? '',
            optionE: editingRow.options?.E ?? '',
            difficulty: (editingRow.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
            examType: '',
            tags: (editingRow.tags || []).join(', '),
            isFree: Boolean(editingRow.isFree),
          }}
          onClose={() => setEditingRow(null)}
          onSave={async (payload) => {
            const res = await apiFetch(`/api/admin/questions/${editingRow.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Save failed');
            toast({ title: 'Success', description: 'Question updated' });
            setEditingRow(null);
            setDirty((prev) => prev.filter((d) => d.rowId !== editingRow.id));
            await loadRows();
          }}
          submitLabel="Save Question"
        />
      )}
    </div>
  );
}
