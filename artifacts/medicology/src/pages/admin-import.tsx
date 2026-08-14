import React, { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Copy, Layers, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

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

export default function AdminImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'similar' | 'duplicate' | 'error'>('all');
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [createMissingTaxonomy, setCreateMissingTaxonomy] = useState(true);

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
      const response = await fetch('/api/admin/import/preview', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data as ImportPreview);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Preview failed', variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const response = await fetch('/api/admin/import/execute', {
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
          Upload an Excel/CSV question bank. The pipeline validates each row, detects duplicates, maps the taxonomy and assigns QIDs before you publish.
        </p>
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
              <p className="text-sm text-muted-foreground">.xlsx, .xls, .csv or .tsv — headers like Question, Option A–E, Correct Answer, Subject, Topic…</p>
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
        </div>
      )}
    </div>
  );
}
