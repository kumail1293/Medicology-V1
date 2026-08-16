import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Send,
  Archive,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Layers,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Question {
  id: number;
  qid?: string | null;
  questionText: string;
  subject: string;
  system?: string | null;
  topic: string;
  subtopic?: string | null;
  difficulty?: string | null;
  status: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation?: string | null;
  wrongAnswerExplanations?: string | null;
  references?: string | null;
  publishedAt?: string | null;
}

interface ReviewAction {
  action: string;
  label: string;
  danger?: boolean;
  primary?: boolean;
}

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  draft: { label: 'Draft', chip: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  pending_review: { label: 'Pending Review', chip: 'bg-amber-500/15 text-amber-600', dot: 'bg-amber-500' },
  under_medical_review: { label: 'Medical Review', chip: 'bg-blue-500/15 text-blue-600', dot: 'bg-blue-500' },
  approved: { label: 'Approved', chip: 'bg-emerald-500/15 text-emerald-600', dot: 'bg-emerald-500' },
  published: { label: 'Published', chip: 'bg-green-600/15 text-green-700', dot: 'bg-green-600' },
  flagged: { label: 'Flagged', chip: 'bg-red-500/15 text-red-600', dot: 'bg-red-500' },
  errata: { label: 'Errata', chip: 'bg-orange-500/15 text-orange-600', dot: 'bg-orange-500' },
  archived: { label: 'Archived', chip: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

const QUEUE_STATUSES = [
  'draft',
  'pending_review',
  'under_medical_review',
  'approved',
  'published',
  'flagged',
  'errata',
  'archived',
] as const;

// Which actions are offered per pipeline status (mirrors the backend transitions).
const ACTIONS_BY_STATUS: Record<string, ReviewAction[]> = {
  draft: [
    { action: 'submit', label: 'Send for Review', primary: true },
    { action: 'archive', label: 'Archive' },
  ],
  pending_review: [
    { action: 'start_review', label: 'Start Medical Review' },
    { action: 'approve', label: 'Approve' },
    { action: 'publish', label: 'Approve & Publish', primary: true },
    { action: 'reject', label: 'Reject', danger: true },
    { action: 'archive', label: 'Archive' },
  ],
  under_medical_review: [
    { action: 'approve', label: 'Approve' },
    { action: 'publish', label: 'Approve & Publish', primary: true },
    { action: 'reject', label: 'Reject', danger: true },
    { action: 'archive', label: 'Archive' },
  ],
  approved: [
    { action: 'publish', label: 'Publish', primary: true },
    { action: 'reject', label: 'Reject', danger: true },
    { action: 'archive', label: 'Archive' },
  ],
  flagged: [
    { action: 'unflag', label: 'Restore to Review' },
    { action: 'publish', label: 'Approve & Publish', primary: true },
    { action: 'archive', label: 'Archive' },
  ],
  errata: [
    { action: 'publish', label: 'Publish', primary: true },
    { action: 'restore', label: 'Restore to Review' },
    { action: 'archive', label: 'Archive' },
  ],
  published: [
    { action: 'flag', label: 'Flag', danger: true },
    { action: 'archive', label: 'Archive' },
  ],
  archived: [{ action: 'restore', label: 'Restore to Review', primary: true }],
};

export default function AdminReviewPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [acting, setActing] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkActing, setBulkActing] = useState<string | null>(null);
  const [bulkNote, setBulkNote] = useState('');

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/review/summary');
      if (!response.ok) throw new Error('Failed to load review summary');
      const data = await response.json();
      setCounts(data.counts || {});
    } catch {
      // Non-fatal — page still renders the queue.
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '200' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/admin/questions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load questions');
      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load review queue', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, toast]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const pendingCount =
    (counts.draft || 0) +
    (counts.pending_review || 0) +
    (counts.under_medical_review || 0) +
    (counts.flagged || 0) +
    (counts.errata || 0);

  const totalCount = QUEUE_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);

  const handleAction = async (question: Question, action: string) => {
    const note = notes[question.id]?.trim() ?? '';
    if (action === 'reject' && !note) {
      toast({ title: 'Note required', description: 'Please explain the rejection so the author knows what to fix', variant: 'destructive' });
      return;
    }
    if (action === 'reject' && !window.confirm('Reject this question and send it back to draft?')) return;

    setActing(question.id);
    try {
      const response = await fetch(`/api/admin/questions/${question.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Review action failed');
      }
      toast({ title: 'Success', description: 'Question status updated' });
      setNotes((prev) => ({ ...prev, [question.id]: '' }));
      await Promise.all([fetchSummary(), fetchQuestions()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Review action failed',
        variant: 'destructive',
      });
    } finally {
      setActing(null);
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E'];

  // ── Bulk selection & actions ────────────────────────────────────────
  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = questions.length > 0 && questions.every((q) => selected.has(q.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const q of questions) next.delete(q.id);
      } else {
        for (const q of questions) next.add(q.id);
      }
      return next;
    });
  };

  // Bulk actions allowed across a mixed selection (a question that can't take
  // the action is reported, not failed).
  const BULK_ACTIONS: { action: string; label: string; danger?: boolean; primary?: boolean }[] = [
    { action: 'submit', label: 'Submit for Review' },
    { action: 'start_review', label: 'Start Medical Review' },
    { action: 'approve', label: 'Approve' },
    { action: 'publish', label: 'Approve & Publish', primary: true },
    { action: 'reject', label: 'Reject', danger: true },
    { action: 'archive', label: 'Archive' },
    { action: 'restore', label: 'Restore' },
  ];

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    const note = bulkNote.trim();
    if (action === 'reject' && !note) {
      toast({ title: 'Note required', description: 'Type a rejection note in the bulk bar first.', variant: 'destructive' });
      return;
    }
    if (action === 'reject' && !window.confirm(`Reject ${selected.size} question(s) and send them back to draft?`)) return;
    if (action === 'archive' && !window.confirm(`Archive ${selected.size} question(s)?`)) return;

    setBulkActing(action);
    try {
      const response = await fetch('/api/admin/questions/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], action, note }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Bulk action failed');
      const failed = data.results?.filter((r: any) => !r.ok)?.length ?? 0;
      toast({
        title: 'Bulk action complete',
        description: `${data.changed ?? 0} question(s) updated${failed > 0 ? `, ${failed} skipped` : ''}.`,
      });
      setSelected(new Set());
      setBulkNote('');
      await Promise.all([fetchSummary(), fetchQuestions()]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Bulk action failed',
        variant: 'destructive',
      });
    } finally {
      setBulkActing(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardCheck size={24} className="text-primary" />
            Review Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            Triage questions through the pipeline: draft → review → approved → published.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm">
          <span className="font-semibold">{pendingCount}</span>
          <span className="text-muted-foreground">awaiting review</span>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={clsx(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
            statusFilter === 'all'
              ? 'bg-primary text-white border-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          All <span className="ml-1 opacity-70">{totalCount}</span>
        </button>
        {QUEUE_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const count = counts[status] || 0;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border',
                statusFilter === status
                  ? 'bg-primary text-white border-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {meta.label}
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by QID, question text, subject, or topic"
            className="w-full border-0 bg-transparent outline-none"
          />
        </div>
      </div>

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-20 rounded-2xl border border-primary/30 bg-card p-4 shadow-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers size={16} className="text-primary" />
              {selected.size} selected
            </div>
            <button
              onClick={toggleAll}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {allVisibleSelected ? 'Clear page selection' : 'Select all on page'}
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Bulk note (required to reject)…"
                className="w-56 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
              />
              {BULK_ACTIONS.map((action) => (
                <button
                  key={action.action}
                  disabled={bulkActing !== null}
                  onClick={() => void handleBulkAction(action.action)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                    action.danger
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : action.primary
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'border border-border text-foreground hover:bg-muted/50'
                  )}
                >
                  {bulkActing === action.action ? <Loader2 size={12} className="animate-spin" /> : null}
                  {action.label}
                </button>
              ))}
              <button
                onClick={() => { setSelected(new Set()); setBulkNote(''); }}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading review queue…
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No questions in this view.
          </div>
        ) : (
          questions.map((question) => {
            const meta = STATUS_META[question.status] ?? STATUS_META.draft;
            const actions = ACTIONS_BY_STATUS[question.status] ?? [];
            const expanded = expandedId === question.id;
            const note = notes[question.id] ?? '';
            const isSelected = selected.has(question.id);
            return (
              <div key={question.id} className={clsx('rounded-xl border bg-card', isSelected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border')}>
                <button
                  onClick={() => setExpandedId(expanded ? null : question.id)}
                  className="flex w-full flex-col gap-2 p-4 text-left md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex items-start gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleSelected(question.id); }}
                      className={clsx(
                        'mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary text-white' : 'border-border bg-background hover:border-primary/50'
                      )}
                    >
                      {isSelected && <CheckCircle2 size={12} />}
                    </span>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {question.qid && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                            {question.qid}
                          </span>
                        )}
                        <BookOpen size={16} className="text-primary" />
                        <p className="font-semibold">{question.questionText}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-1">{question.subject}</span>
                        {question.system && <span className="rounded-full bg-muted px-2 py-1">{question.system}</span>}
                        <span className="rounded-full bg-muted px-2 py-1">{question.topic}</span>
                        <span className="rounded-full bg-muted px-2 py-1">{question.difficulty}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', meta.chip)}>
                      {meta.label}
                    </span>
                    {expanded ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-border p-4">
                    {/* Question detail */}
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed">{question.questionText}</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {optionLetters.map((letter) => {
                          const text = question.options?.[letter];
                          if (!text) return null;
                          const correct = question.correctAnswer === letter;
                          return (
                            <div
                              key={letter}
                              className={clsx(
                                'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                                correct
                                  ? 'border-green-500/40 bg-green-500/10'
                                  : 'border-border bg-background'
                              )}
                            >
                              <span className="font-semibold text-muted-foreground">{letter}.</span>
                              <span className="flex-1">{text}</span>
                              {correct && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />}
                            </div>
                          );
                        })}
                      </div>
                      {question.explanation && (
                        <div className="rounded-lg bg-muted/60 p-3 text-sm">
                          <span className="font-semibold">Explanation:</span> {question.explanation}
                        </div>
                      )}
                      {question.references && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">References:</span> {question.references}
                        </div>
                      )}
                    </div>

                    {/* Review note */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Review note (required to reject)
                      </label>
                      <textarea
                        value={note}
                        onChange={(event) => setNotes((prev) => ({ ...prev, [question.id]: event.target.value }))}
                        rows={2}
                        placeholder="e.g. Explanation cites the wrong reference — please fix before resubmitting."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {actions.map((action) => (
                        <button
                          key={action.action}
                          disabled={acting === question.id}
                          onClick={() => void handleAction(question, action.action)}
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                            action.danger
                              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                              : action.primary
                                ? 'bg-primary text-white hover:bg-primary/90'
                                : 'border border-border text-foreground hover:bg-muted/50'
                          )}
                        >
                          {action.action === 'submit' || action.action === 'start_review' ? <Send size={14} /> : null}
                          {action.action === 'approve' || action.action === 'publish' ? <CheckCircle2 size={14} /> : null}
                          {action.action === 'reject' ? <XCircle size={14} /> : null}
                          {action.action === 'archive' ? <Archive size={14} /> : null}
                          {action.action === 'restore' || action.action === 'unflag' ? <RotateCcw size={14} /> : null}
                          {action.action === 'flag' ? <AlertTriangle size={14} /> : null}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
