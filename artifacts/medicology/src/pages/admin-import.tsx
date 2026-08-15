import React, { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Copy, Layers, Trash2, Pencil, Download, ExternalLink, FileDown } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '@/lib/api';
import QuestionEditorModal, { QuestionFormState, QUESTION_TYPE_LABELS } from '@/components/QuestionEditorModal';

interface ImportRowData {
  [key: string]: any;
}

interface ImportRow {
  rowNumber: number;
  status: 'valid' | 'similar' | 'duplicate' | 'error';
  messages: string[];
  qid?: string;
  existingId?: number;
  similarity?: number;
  data: ImportRowData;
  unmappedColumns?: string[];
}

interface ImportPreview {
  fileName: string;
  totalRows: number;
  columnMapping: Record<string, string>;
  rows: ImportRow[];
  stats: { valid: number; similar: number; duplicate: number; error: number };
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

const STATUS_STYLES: Record<ImportRow['status'], { label: string; className: string }> = {
  valid: { label: 'Valid', className: 'bg-emerald-500/15 text-emerald-600' },
  similar: { label: 'Similar', className: 'bg-amber-500/15 text-amber-600' },
  duplicate: { label: 'Duplicate', className: 'bg-orange-500/15 text-orange-600' },
  error: { label: 'Error', className: 'bg-red-500/15 text-red-600' },
};

const TEMPLATE_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Full template (all types)' },
  ...Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

/** Build an editor form from a parsed import row (both validated `options`
 * shape and raw optionA..E columns are handled). */
function formFromImportData(data: ImportRowData): QuestionFormState {
  const opts: Record<string, string> = data.options && typeof data.options === 'object' ? data.options : {};
  const answer = String(data.correctAnswer ?? '').toUpperCase();
  return {
    questionText: data.questionText || '',
    questionType: data.questionType || 'sba',
    subject: data.subject || '',
    system: data.system || '',
    topic: data.topic || '',
    subtopic: data.subtopic || '',
    universityTag: data.universityTag || '',
    explanation: data.explanation || '',
    whyCorrect: data.whyCorrect || '',
    whyWrong: data.whyWrong || '',
    examPearl: data.examPearl || '',
    commonTrap: data.commonTrap || '',
    assertion: data.assertion || '',
    reason: data.reason || '',
    correctAnswer: (['A', 'B', 'C', 'D', 'E'].includes(answer) ? answer as any : 'A'),
    optionA: opts.A ?? data.optionA ?? '',
    optionB: opts.B ?? data.optionB ?? '',
    optionC: opts.C ?? data.optionC ?? '',
    optionD: opts.D ?? data.optionD ?? '',
    optionE: opts.E ?? data.optionE ?? '',
    difficulty: data.difficulty || 'medium',
    examType: data.examType || '',
    tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),
    isFree: Boolean(data.isFree),
  };
}

export default function AdminImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'similar' | 'duplicate' | 'error'>('all');
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [createMissingTaxonomy, setCreateMissingTaxonomy] = useState(true);
  const [templateType, setTemplateType] = useState('');
  // Row editor (reuses the individual-question editor).
  const [editingRow, setEditingRow] = useState<ImportRow | null>(null);

  const handleFileChange = (selected: File | null) => {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!/\.(xlsx|xls|csv|tsv)$/.test(name)) {
      toast({ title: 'Invalid file', description: 'Please upload an .xlsx, .xls, .csv or .tsv file', variant: 'destructive' });
      return;
    }
    setFile(selected);
    setPreview(null);
    setResult(null);
  };

  const runPreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch('/api/admin/import/preview', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data as ImportPreview);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Preview failed', variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const downloadTemplate = async (type?: string) => {
    setDownloading(true);
    try {
      const url = `/api/admin/import/template${type ? `?type=${encodeURIComponent(type)}` : ''}`;
      const response = await apiFetch(url);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Template download failed');
      }
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `medicology-import-template${type ? `-${type}` : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast({ title: 'Template ready', description: 'Open the .xlsx — the Template sheet has headers + example rows, the Guide sheet explains every column.' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Template download failed', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const response = await apiFetch('/api/admin/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: preview.rows,
          includeDuplicates,
          createMissingTaxonomy,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed');
      setResult(data as ImportResult);
      toast({ title: 'Import complete', description: `${data.inserted} question(s) imported`, variant: data.inserted > 0 ? 'default' : 'destructive' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Apply an edited row back into the preview (no server write yet — the
   * admin reviews/polishes rows BEFORE they enter the QBank). */
  const applyRowEdit = (payload: Record<string, any>) => {
    if (!preview || !editingRow) return;
    const updated = preview.rows.map((row) => {
      if (row.rowNumber !== editingRow.rowNumber) return row;
      const data = { ...row.data, ...payload };
      const messages: string[] = [];
      if (!data.questionText) messages.push('Missing question text');
      return {
        ...row,
        data,
        status: ('valid' as ImportRow['status']),
        messages,
        similarity: undefined,
        existingId: undefined,
      };
    });
    setPreview({ ...preview, rows: updated });
    setEditingRow(null);
    toast({ title: 'Row updated', description: `Row ${editingRow.rowNumber} will be imported with your edits.` });
  };

  const importable = preview
    ? preview.rows.filter((row) => row.status === 'valid' || row.status === 'similar' || (includeDuplicates && row.status === 'duplicate')).length
    : 0;

  const visibleRows = preview ? preview.rows.filter((row) => filter === 'all' || row.status === filter) : [];

  const statChip = (label: string, count: number, color: string) => (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <div className={clsx('text-2xl font-bold', color)}>{count}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Bulk Import</h2>
        <p className="text-sm text-muted-foreground">
          Download a template, fill it with questions, then validate, edit and review every row before it enters the QBank.
        </p>
      </div>

      {/* Templates */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><FileDown size={18} className="text-primary" /> Templates for every question type</h3>
            <p className="text-sm text-muted-foreground">
              Each template has every column with an example row showing exactly where to put what — plus a Guide sheet with instructions.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Template</label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value || 'all'} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => void downloadTemplate(templateType || undefined)}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Download size={15} />
              {downloading ? 'Preparing…' : 'Download template'}
            </button>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        {!file ? (
          <button onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center gap-3 py-6 text-center">
            <FileSpreadsheet size={40} className="text-muted-foreground" />
            <div>
              <p className="font-medium">Click to choose a spreadsheet</p>
              <p className="text-sm text-muted-foreground">.xlsx, .xls, .csv or .tsv — Question, Option A–E, Correct Answer, Subject, Topic…</p>
            </div>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
              <FileSpreadsheet size={20} className="text-primary" />
              <div className="text-left">
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={runPreview}
                disabled={previewing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Upload size={16} />
                {previewing ? 'Validating…' : 'Validate & Preview'}
              </button>
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Column mapping */}
      {preview && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detected Columns</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(preview.columnMapping).map(([field, header]) => (
              <span key={field} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                <span className="font-medium">{header}</span>
                <span className="text-muted-foreground"> → {field}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {preview && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {statChip('Total', preview.totalRows, 'text-foreground')}
          {statChip('Valid', preview.stats.valid, 'text-emerald-600')}
          {statChip('Similar', preview.stats.similar, 'text-amber-600')}
          {statChip('Duplicates', preview.stats.duplicate, 'text-orange-600')}
          {statChip('Errors', preview.stats.error, 'text-red-600')}
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex flex-wrap gap-2">
              {(['all', 'valid', 'similar', 'duplicate', 'error'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                    filter === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} />
                Include duplicates
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={createMissingTaxonomy} onChange={(e) => setCreateMissingTaxonomy(e.target.checked)} />
                Auto-create missing subjects/topics
              </label>
            </div>
          </div>

          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Row</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">QID</th>
                  <th className="px-4 py-2 font-medium">Question</th>
                  <th className="px-4 py-2 font-medium">Subject / Topic</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => {
                  const style = STATUS_STYLES[row.status];
                  return (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="px-4 py-2 text-muted-foreground">{row.rowNumber}</td>
                      <td className="px-4 py-2">
                        <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', style.className)}>
                          {row.status === 'valid' && <CheckCircle2 size={12} />}
                          {row.status === 'similar' && <AlertTriangle size={12} />}
                          {row.status === 'duplicate' && <Copy size={12} />}
                          {row.status === 'error' && <XCircle size={12} />}
                          {style.label}
                          {row.similarity !== undefined && <span>{row.similarity}%</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-primary">{row.qid ?? '—'}</td>
                      <td className="max-w-[320px] px-4 py-2">
                        <p className="line-clamp-2">{row.data.questionText || '—'}</p>
                        {row.data.questionType && row.data.questionType !== 'sba' && (
                          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {QUESTION_TYPE_LABELS[row.data.questionType] || row.data.questionType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {[row.data.subject, row.data.system, row.data.topic, row.data.subtopic].filter(Boolean).join(' → ') || '—'}
                      </td>
                      <td className="max-w-[280px] px-4 py-2 text-xs">
                        {row.messages.length > 0 ? (
                          <ul className="space-y-0.5">
                            {row.messages.map((message, i) => (
                              <li key={i} className={clsx(row.status === 'error' || row.status === 'duplicate' ? 'text-red-600' : 'text-muted-foreground')}>
                                {message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-emerald-600">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setEditingRow(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
                          title="Edit this row with the full question editor before importing"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Import action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-sm text-muted-foreground">
              {importable} question(s) ready to import
              {includeDuplicates ? ' (duplicates included)' : ''}
              {' '}— edit any row first; imports land in the review queue, not straight into the QBank.
            </p>
            <button
              onClick={runImport}
              disabled={importing || importable === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Layers size={16} />
              {importing ? 'Importing…' : `Import ${importable} question${importable === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Import Result</p>
          <p className="text-sm">
            <span className="font-medium text-emerald-600">{result.inserted} inserted</span>
            {result.skipped > 0 && <span className="text-muted-foreground"> · {result.skipped} skipped</span>}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-600">
              {result.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
          {result.inserted > 0 && (
            <a
              href="/admin/review"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <ExternalLink size={14} /> Review imported questions in the Review Queue
            </a>
          )}
        </div>
      )}

      {/* Row editor — same editor used for individual questions. */}
      {editingRow && (
        <QuestionEditorModal
          open
          title={`Edit Row ${editingRow.rowNumber} (before import)`}
          initial={formFromImportData(editingRow.data)}
          onClose={() => setEditingRow(null)}
          onSave={applyRowEdit}
          submitLabel="Apply to Row"
        />
      )}
    </div>
  );
}
