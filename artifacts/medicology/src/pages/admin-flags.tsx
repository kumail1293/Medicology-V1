import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2, Search, Flag, RefreshCw, User, Calendar, BookOpen, X, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { richTextToPlain } from '@/lib/richText';

interface FlagItem {
  id: number;
  questionId?: number;
  reason?: string;
  message?: string;
  createdAt?: string;
  questionText?: string;
  questionSubject?: string;
  questionTopic?: string;
  questionQid?: string;
  userName?: string;
  userEmail?: string | null;
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<FlagItem | null>(null);
  const [clearingId, setClearingId] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/flags');
      if (!response.ok) throw new Error('Failed to load flags');
      const data = await response.json();
      setFlags(data.flags || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load flagged reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFlags();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (flagId: number) => {
    if (!window.confirm('Clear this report? The question itself is not changed.')) return;
    setClearingId(flagId);
    try {
      const response = await fetch(`/api/flags/${flagId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear report');
      toast({ title: 'Success', description: 'Flag report cleared' });
      setPreview(null);
      await fetchFlags();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to clear report', variant: 'destructive' });
    } finally {
      setClearingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return flags;
    return flags.filter((f) =>
      (f.questionText ?? '').toLowerCase().includes(q) ||
      (f.questionQid ?? '').toLowerCase().includes(q) ||
      (f.userName ?? '').toLowerCase().includes(q) ||
      (f.userEmail ?? '').toLowerCase().includes(q) ||
      (f.questionSubject ?? '').toLowerCase().includes(q) ||
      (f.questionTopic ?? '').toLowerCase().includes(q)
    );
  }, [flags, search]);

  const timeAgo = (iso?: string) => {
    if (!iso) return '';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Flag className="text-primary" size={22} /> Flags & Reports
          </h2>
          <p className="text-sm text-muted-foreground">Question reports submitted by learners — review, then clear when resolved.</p>
        </div>
        <button
          onClick={() => void fetchFlags()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{flags.length}</p>
          <p className="text-xs text-muted-foreground">Total reports</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{new Set(flags.map((f) => f.questionId)).size}</p>
          <p className="text-xs text-muted-foreground">Questions flagged</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{new Set(flags.map((f) => f.userEmail ?? f.userName)).size}</p>
          <p className="text-xs text-muted-foreground">Reporting users</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{flags.filter((f) => (f.questionText ?? '').length > 0).length}</p>
          <p className="text-xs text-muted-foreground">With question text</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by question, QID, subject or reporter…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
        />
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertTriangle size={20} className="text-muted-foreground" />
            </div>
            <p className="font-semibold">{search ? 'No reports match your search' : 'No active reports'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? 'Try a different search term.' : 'When learners flag a question, it appears here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((flag) => (
              <div key={flag.id} className="flex items-start justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
                <button
                  onClick={() => setPreview(flag)}
                  className="flex-1 min-w-0 text-left space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <span className="font-semibold line-clamp-1">
                      {flag.questionText ? richTextToPlain(flag.questionText) : `Question #${flag.questionId ?? 'unknown'}`}
                    </span>
                  </div>
                  {flag.questionSubject && (
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{flag.questionSubject}</span>
                      {flag.questionTopic && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{flag.questionTopic}</span>}
                      {flag.questionQid && <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{flag.questionQid}</span>}
                    </div>
                  )}
                  <p className="pl-6 text-sm text-muted-foreground">{flag.reason || flag.message || 'No description provided.'}</p>
                  <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><User size={11} /> {flag.userName || 'Unknown user'}</span>
                    {flag.userEmail && <span className="inline-flex items-center gap-1">{flag.userEmail}</span>}
                    <span className="inline-flex items-center gap-1"><Calendar size={11} /> {timeAgo(flag.createdAt) || (flag.createdAt ? new Date(flag.createdAt).toLocaleString() : '')}</span>
                    <span className="inline-flex items-center gap-1 text-primary"><Eye size={11} /> Preview</span>
                  </div>
                </button>
                <button
                  onClick={() => void handleDelete(flag.id)}
                  disabled={clearingId === flag.id}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-40"
                  title="Clear this report"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-card shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                <p className="font-bold">Flagged question</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {preview.questionSubject && <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{preview.questionSubject}</span>}
                {preview.questionTopic && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{preview.questionTopic}</span>}
                {preview.questionQid && <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-muted-foreground">{preview.questionQid}</span>}
              </div>
              <div className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed">
                {richTextToPlain(preview.questionText || `Question #${preview.questionId ?? 'unknown'}`)}
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-600">Report</p>
                <p className="text-sm">{preview.reason || preview.message || 'No description provided.'}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Reporter: <span className="font-medium text-foreground">{preview.userName || 'Unknown'}</span>{preview.userEmail ? ` (${preview.userEmail})` : ''}</span>
                  <span>Reported: {preview.createdAt ? new Date(preview.createdAt).toLocaleString() : '—'}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setPreview(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Close</button>
              <button
                onClick={() => void handleDelete(preview.id)}
                disabled={clearingId === preview.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                <Trash2 size={14} /> Clear report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
