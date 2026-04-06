import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useGetAnalytics } from '@workspace/api-client-react';
import { PageTransition } from '@/components/layout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { clsx } from 'clsx';

/* ── Exam Readiness ─────────────────────────────────────────────────────────── */

function calcReadiness(d: { usedQuestions?: number; totalQuestions?: number; accuracy?: number; streakDays?: number }) {
  const coverage    = (d.totalQuestions ?? 0) > 0 ? ((d.usedQuestions ?? 0) / (d.totalQuestions ?? 1)) * 40 : 0;
  const accuracy    = ((d.accuracy ?? 0) / 100) * 40;
  const consistency = Math.min((d.streakDays ?? 0) / 14, 1) * 20;
  return { total: Math.round(coverage + accuracy + consistency), coverage, accuracy, consistency };
}

function readinessStyle(score: number) {
  if (score <= 40) return { label: "Needs Work",    color: "text-red-500",   ring: "#ef4444", badge: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",    bar: "bg-red-500"   };
  if (score <= 65) return { label: "Getting There", color: "text-amber-500", ring: "#f59e0b", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", bar: "bg-amber-500" };
  if (score <= 85) return { label: "Almost Ready",  color: "text-blue-500",  ring: "#3b82f6", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",  bar: "bg-blue-500"  };
  return                  { label: "Exam Ready",    color: "text-green-500", ring: "#22c55e", badge: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300", bar: "bg-green-500" };
}

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

function ReadinessBar({ label, score, max, barColor }: { label: string; score: number; max: number; barColor: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold">{Math.round(score)} / {max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${(score / max) * 100}%` }} />
      </div>
    </div>
  );
}

function ExamReadinessBanner({ analytics }: { analytics: any }) {
  const r = calcReadiness(analytics);
  const s = readinessStyle(r.total);
  const offset = RING_C * (1 - r.total / 100);
  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm w-full">
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r={RING_R} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
            <circle
              cx="60" cy="60" r={RING_R} fill="none"
              stroke={s.ring} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={clsx("text-4xl font-extrabold leading-none", s.color)}>{r.total}</span>
            <span className="text-[11px] text-muted-foreground font-medium tracking-wide">/100</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 w-full min-w-0">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <h2 className="text-xl font-bold">Exam Readiness Score</h2>
            <span className={clsx("text-sm font-bold px-3 py-1 rounded-full", s.badge)}>{s.label}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReadinessBar label="Coverage (40 pts)"    score={r.coverage}    max={40} barColor={s.bar} />
            <ReadinessBar label="Accuracy (40 pts)"    score={r.accuracy}    max={40} barColor={s.bar} />
            <ReadinessBar label="Consistency (20 pts)" score={r.consistency} max={20} barColor={s.bar} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Heatmap helper (existing subject tiles) ─────────────────────────────────── */

function getHeatmapColor(accuracy: number) {
  if (accuracy >= 80) return "bg-success/20 text-success border-success/30";
  if (accuracy >= 60) return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30";
  return "bg-destructive/20 text-destructive border-destructive/30";
}

/* ── Topic Mastery Heat Map ──────────────────────────────────────────────────── */

interface TopicRow {
  subject: string;
  topic: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

function topicCellColor(row: TopicRow): string {
  if (row.attempted === 0) return "bg-muted/60 border-border text-muted-foreground";
  if (row.accuracy < 50)   return "bg-red-500/20 border-red-400/40 text-red-700 dark:text-red-400";
  if (row.accuracy < 70)   return "bg-amber-400/20 border-amber-400/40 text-amber-700 dark:text-amber-400";
  return "bg-green-500/20 border-green-400/40 text-green-700 dark:text-green-400";
}

function topicCellDot(row: TopicRow): string {
  if (row.attempted === 0) return "bg-muted-foreground/40";
  if (row.accuracy < 50)   return "bg-red-500";
  if (row.accuracy < 70)   return "bg-amber-400";
  return "bg-green-500";
}

/* Skeleton cell */
function SkeletonCell() {
  return <div className="h-10 rounded-lg bg-muted animate-pulse" />;
}

/* Single collapsible subject card */
function SubjectHeatCard({
  subject,
  topics,
  onTopicClick,
}: {
  subject: string;
  topics: TopicRow[];
  onTopicClick: (subject: string, topic: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const attempted = topics.filter(t => t.attempted > 0).length;
  const avgAcc = topics.length > 0
    ? Math.round(topics.filter(t => t.attempted > 0).reduce((s, t) => s + t.accuracy, 0) / Math.max(attempted, 1))
    : 0;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-muted/40 border-b border-border hover:bg-muted/70 transition-colors text-left select-none"
      >
        <span className="flex-1 font-semibold text-sm">{subject}</span>
        <span className="text-xs text-muted-foreground font-medium">
          {attempted}/{topics.length} topics attempted
          {attempted > 0 && ` · avg ${avgAcc}%`}
        </span>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {topics.map(row => (
            <div
              key={row.topic}
              onClick={() => onTopicClick(row.subject, row.topic)}
              title={
                row.attempted === 0
                  ? `${row.topic} — Not attempted`
                  : `${row.topic} — ${Math.round(row.accuracy)}% (${row.correct}/${row.attempted})`
              }
              className={clsx(
                "group relative flex flex-col justify-between p-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md",
                topicCellColor(row)
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] font-medium leading-tight line-clamp-2 flex-1">{row.topic}</span>
                <span className={clsx("shrink-0 w-2 h-2 rounded-full mt-0.5", topicCellDot(row))} />
              </div>
              <div className="mt-1 text-[11px] font-bold">
                {row.attempted === 0 ? (
                  <span className="opacity-50">—</span>
                ) : (
                  `${Math.round(row.accuracy)}%`
                )}
              </div>

              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20
                              hidden group-hover:flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-popover text-popover-foreground text-[11px] rounded-lg px-3 py-1.5 shadow-xl border border-border whitespace-nowrap font-medium">
                  {row.attempted === 0
                    ? 'No attempts yet'
                    : `${Math.round(row.accuracy)}% · ${row.correct}/${row.attempted} correct`}
                </div>
                <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 -mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Legend */
function HeatMapLegend() {
  const items = [
    { dot: "bg-muted-foreground/50", label: "Untouched (0 attempts)" },
    { dot: "bg-red-500",             label: "Needs work (< 50%)" },
    { dot: "bg-amber-400",           label: "Getting there (50–69%)" },
    { dot: "bg-green-500",           label: "Mastered (≥ 70%)" },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={clsx("w-2.5 h-2.5 rounded-full shrink-0", item.dot)} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

/* Weakest Topics list */
function WeakestTopics({ topics, onPractice }: { topics: TopicRow[]; onPractice: (subject: string, topic: string) => void }) {
  const weak = topics
    .filter(t => t.attempted >= 5)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  if (weak.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Attempt at least 5 questions per topic to see weakest topics.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {weak.map((row, i) => (
        <div
          key={row.topic}
          className="flex items-center gap-4 p-3.5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
        >
          <span className="text-lg font-extrabold text-muted-foreground/50 w-5 shrink-0 text-center">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{row.topic}</p>
            <p className="text-xs text-muted-foreground">{row.subject} · {row.correct}/{row.attempted} correct</p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className={clsx(
              "text-sm font-extrabold",
              row.accuracy < 50 ? "text-red-500" : "text-amber-500"
            )}>
              {Math.round(row.accuracy)}%
            </span>
            <button
              onClick={() => onPractice(row.subject, row.topic)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Play size={11} /> Practice
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Main heatmap section */
function TopicMasterySection() {
  const [, setLocation] = useLocation();
  const [topicRows, setTopicRows] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useCallback((subject: string, topic: string) => {
    setLocation(`/create-test?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`);
  }, [setLocation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('medicology_token');
        // TODO: implement on backend
        const res = await fetch('/api/progress/topics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTopicRows(Array.isArray(data) ? data : []);
        } else if (!cancelled) {
          setTopicRows([]);
        }
      } catch {
        if (!cancelled) setTopicRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Group by subject */
  const bySubject = React.useMemo(() => {
    const map: Record<string, TopicRow[]> = {};
    topicRows.forEach(r => {
      if (!map[r.subject]) map[r.subject] = [];
      map[r.subject].push(r);
    });
    return map;
  }, [topicRows]);

  const subjectKeys = Object.keys(bySubject);

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold">Topic Mastery Heat Map</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Click any topic cell to start a focused practice session.
          </p>
        </div>
        <HeatMapLegend />
      </div>

      {/* Content */}
      {loading ? (
        /* Skeleton */
        <div className="space-y-4">
          {[...Array(3)].map((_, si) => (
            <div key={si} className="bg-muted/30 border border-border rounded-2xl overflow-hidden">
              <div className="h-12 bg-muted animate-pulse" />
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {[...Array(8)].map((_, ci) => <SkeletonCell key={ci} />)}
              </div>
            </div>
          ))}
        </div>
      ) : subjectKeys.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-semibold text-muted-foreground">Complete more questions to unlock topic breakdown.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Topic data appears once the backend endpoint is active.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjectKeys.map(subject => (
            <SubjectHeatCard
              key={subject}
              subject={subject}
              topics={bySubject[subject]}
              onTopicClick={navigate}
            />
          ))}
        </div>
      )}

      {/* Weakest Topics */}
      {!loading && topicRows.length > 0 && (
        <div className="pt-4 border-t border-border space-y-4">
          <div>
            <h3 className="font-bold text-base">Weakest Topics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Topics with lowest accuracy (minimum 5 attempts)
            </p>
          </div>
          <WeakestTopics topics={topicRows} onPractice={navigate} />
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function Analytics() {
  const { data: analytics, isLoading } = useGetAnalytics();

  if (isLoading) return <div className="p-12 text-center animate-pulse">Loading analytics...</div>;
  if (!analytics) return <div className="p-12 text-center">No data available</div>;

  return (
    <PageTransition className="space-y-8 pb-12 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-primary/10 p-3 rounded-2xl"><BarChart3 className="text-primary" size={32} /></div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-foreground">Analytics Hub</h1>
          <p className="text-muted-foreground">Deep dive into your performance metrics.</p>
        </div>
      </div>

      {/* Exam Readiness Banner */}
      <ExamReadinessBanner analytics={analytics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subject Heatmap tiles */}
        <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border">
          <h2 className="text-xl font-bold mb-6">Subject Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {analytics.subjectPerformance.map(sp => (
              <div key={sp.subject} className={clsx("p-4 rounded-2xl border text-center transition-all hover:scale-105 cursor-default", getHeatmapColor(sp.accuracy))}>
                <div className="text-2xl font-bold mb-1">{Math.round(sp.accuracy)}%</div>
                <div className="text-xs font-semibold uppercase tracking-wider">{sp.subject}</div>
                <div className="text-[10px] opacity-70 mt-1">{sp.total} Questions</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Bar Chart */}
        <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border flex flex-col">
          <h2 className="text-xl font-bold mb-6">Topic Accuracy Comparison</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.topicPerformance.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={120} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px' }} />
                <Bar dataKey="accuracy" name="Accuracy %" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Topic Mastery Heat Map — full width below */}
      <TopicMasterySection />
    </PageTransition>
  );
}
