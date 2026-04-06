import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/layout';
import { motion } from 'framer-motion';
import { Play, Eye, Trash2, Plus, Clock, CheckCircle, PauseCircle, BookOpen, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TestSession {
  id: number;
  title: string;
  mode: string;
  status: string;
  questionIds: number[];
  answers: Record<string, any>;
  currentIndex: number;
  totalCorrect: number | null;
  subjectFilter: string[];
  questionFilter: string;
  createdAt: string;
  completedAt: string | null;
  totalTime: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  in_progress: { label: "In Progress", color: "text-blue-600 bg-blue-500/10", icon: <Play size={12} /> },
  suspended: { label: "Suspended", color: "text-orange-600 bg-orange-500/10", icon: <PauseCircle size={12} /> },
  completed: { label: "Completed", color: "text-green-600 bg-green-500/10", icon: <CheckCircle size={12} /> },
};

const MODE_LABELS: Record<string, string> = {
  tutor: "Tutor",
  timed: "Timed",
  practice: "Practice",
};

export default function TestsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('medicology_token');
      const res = await fetch('/api/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      toast({ title: "Error", description: "Failed to load sessions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this test?")) return;
    const token = localStorage.getItem('medicology_token');
    await fetch(`/api/sessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setSessions(prev => prev.filter(s => s.id !== id));
    toast({ title: "Test deleted" });
  };

  const filtered = activeFilter === "all" ? sessions : sessions.filter(s => s.status === activeFilter);

  const getScore = (session: TestSession) => {
    const answered = Object.keys(session.answers).length;
    if (!answered) return null;
    const correct = session.totalCorrect ?? Object.values(session.answers as any).filter((a: any) => a?.isCorrect).length;
    return { correct, total: answered, pct: Math.round((correct / answered) * 100) };
  };

  const formatTime = (secs: number | null) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <PageTransition className="max-w-4xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">My Tests</h1>
          <p className="text-muted-foreground mt-1">{sessions.length} test{sessions.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => setLocation('/create-test')}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold hover:-translate-y-0.5 hover:shadow-lg shadow-primary/20 transition-all"
        >
          <Plus size={18} /> New Test
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-muted/50 rounded-2xl p-1.5">
        {[
          { id: "all", label: "All" },
          { id: "in_progress", label: "In Progress" },
          { id: "suspended", label: "Suspended" },
          { id: "completed", label: "Completed" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={clsx(
              "flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all",
              activeFilter === tab.id
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin text-4xl">⏳</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen size={48} className="text-muted-foreground/30 mb-4" />
          <h3 className="font-bold text-lg mb-2">No tests here yet</h3>
          <p className="text-muted-foreground mb-6">Create a test to start practicing</p>
          <button
            onClick={() => setLocation('/create-test')}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold"
          >
            <Plus size={18} /> Create Test
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((session, i) => {
            const score = getScore(session);
            const statusCfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.in_progress;
            const progress = session.questionIds.length > 0
              ? Math.round((Object.keys(session.answers).length / session.questionIds.length) * 100)
              : 0;

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-base truncate">{session.title || "Untitled Test"}</h3>
                      <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", statusCfg.color)}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{MODE_LABELS[session.mode] || session.mode} Mode</span>
                      <span>{session.questionIds.length} questions</span>
                      {session.createdAt && (
                        <span>{format(new Date(session.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      )}
                      {session.totalTime && <span><Clock size={12} className="inline mr-1" />{formatTime(session.totalTime)}</span>}
                    </div>

                    {/* Progress bar */}
                    {session.status !== "completed" && session.questionIds.length > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{Object.keys(session.answers).length} / {session.questionIds.length} answered</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Score */}
                    {score && session.status === "completed" && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className={clsx(
                          "text-sm font-bold px-3 py-1 rounded-full",
                          score.pct >= 70 ? "bg-green-500/10 text-green-600" : score.pct >= 50 ? "bg-yellow-500/10 text-yellow-600" : "bg-red-500/10 text-red-600"
                        )}>
                          {score.pct}%
                        </div>
                        <span className="text-sm text-muted-foreground">{score.correct}/{score.total} correct</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    {session.status !== "completed" && (
                      <button
                        onClick={() => setLocation(`/session/${session.id}`)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold hover:-translate-y-0.5 transition-all shadow-sm shadow-primary/20"
                      >
                        <Play size={14} /> {session.status === "suspended" ? "Resume" : "Continue"}
                      </button>
                    )}
                    {session.status === "completed" && (
                      <button
                        onClick={() => setLocation(`/session/${session.id}?review=1`)}
                        className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-xl text-sm font-bold hover:bg-muted/80 transition-all"
                      >
                        <Eye size={14} /> Review
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
