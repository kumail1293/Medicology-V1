import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2, MessageSquareWarning } from 'lucide-react';

interface FlagItem {
  id: number;
  questionId?: number;
  reason?: string;
  message?: string;
  createdAt?: string;
  questionText?: string;
  userEmail?: string;
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, []);

  const handleDelete = async (flagId: number) => {
    if (!window.confirm('Clear this report?')) return;
    try {
      const response = await fetch(`/api/flags/${flagId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear report');
      toast({ title: 'Success', description: 'Flag report cleared' });
      await fetchFlags();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to clear report', variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Flags & Reports</h2>
        <p className="text-sm text-muted-foreground">Review question reports submitted by learners.</p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading reports…</div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No active reports.</div>
        ) : (
          <div className="divide-y divide-border">
            {flags.map((flag) => (
              <div key={flag.id} className="flex items-start justify-between gap-4 p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="font-semibold">{flag.questionText || `Question #${flag.questionId || 'unknown'}`}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{flag.reason || flag.message || 'No description provided.'}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {flag.userEmail && <span className="rounded-full bg-muted px-2 py-1">{flag.userEmail}</span>}
                    {flag.createdAt && <span className="rounded-full bg-muted px-2 py-1">{new Date(flag.createdAt).toLocaleString()}</span>}
                  </div>
                </div>
                <button onClick={() => void handleDelete(flag.id)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
