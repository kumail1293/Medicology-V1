import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { PageTransition } from '@/components/layout';
import { Target, Flame, Activity, ChevronRight, Stethoscope, ClipboardCheck, Plus, BookOpen, Clock, CheckCircle, XCircle, BarChart2, TrendingUp, X, Gift, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface Analytics {
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  streakDays: number;
  totalQuestions: number;
  usedQuestions: number;
  unusedQuestions: number;
  percentUsed: number;
  avgTimeSeconds: number;
  testStats: { created: number; completed: number; suspended: number };
  subjectPerformance: { subject: string; total: number; correct: number; accuracy: number }[];
  recentActivity: { date: string; count: number; correct: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [freeQuestions, setFreeQuestions] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('medicology_token');
    const load = async () => {
      try {
        const res = await fetch('/api/progress/analytics', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setAnalytics(await res.json());
      } catch {}
      finally { setIsLoading(false); }
    };
    const loadFree = async () => {
      try {
        const res = await fetch('/api/questions/free?limit=6', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setFreeQuestions(d.questions ?? []);
        }
      } catch {}
    };
    load();
    loadFree();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="text-4xl">🧠</div>
          <p className="text-muted-foreground">Loading your insights...</p>
        </div>
      </div>
    );
  }

  const stats = analytics || {
    totalAttempted: 0, totalCorrect: 0, totalIncorrect: 0, accuracy: 0, streakDays: 0,
    totalQuestions: 0, usedQuestions: 0, unusedQuestions: 0, percentUsed: 0, avgTimeSeconds: 0,
    testStats: { created: 0, completed: 0, suspended: 0 },
    subjectPerformance: [], recentActivity: [],
  };

  const chartData = stats.recentActivity.map(item => ({
    ...item,
    formattedDate: format(parseISO(item.date), 'MMM dd'),
    accuracy: item.count > 0 ? Math.round((item.correct / item.count) * 100) : 0,
  }));

  const pctCorrect = stats.totalAttempted > 0 ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0;

  const weakSubject = stats.subjectPerformance
    .filter(sp => sp.total >= 10)
    .sort((a, b) => a.accuracy - b.accuracy)[0] ?? null;

  const formatTime = (s: number) => {
    if (!s) return '—';
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  return (
    <PageTransition className="space-y-8 pb-16">
      {/* Animated background gradient */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse opacity-50" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse opacity-50" />
      </div>

      {/* Header with animation */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-md rounded-3xl px-6 border border-border/30"
      >
        <div>
          <h1 className="text-4xl font-display font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight leading-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Doctor'} 👋
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Your personalized learning dashboard</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setLocation('/create-test')}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/30 hover:shadow-xl transition-all whitespace-nowrap"
        >
          <Plus size={20} /> Create Test
        </motion.button>
      </motion.div>

      {/* Streak banner with animation */}
      <AnimatePresence>
        {!bannerDismissed && stats.streakDays > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800/50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100/0 via-amber-200/50 to-orange-100/0 dark:from-amber-500/0 dark:via-amber-500/20 dark:to-orange-500/0 animate-shimmer" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Flame className="text-amber-600 dark:text-amber-400" size={28} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    🔥 Keep your streak alive!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    {stats.streakDays} day streak • Complete today's Daily Challenge to extend it
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLocation('/daily')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  Play Now
                </motion.button>
                <motion.button
                  whileHover={{ rotate: 90 }}
                  onClick={() => setBannerDismissed(true)}
                  className="p-2 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-xl text-amber-600 dark:text-amber-400 transition-colors"
                >
                  <X size={18} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top stats row with staggered animations */}
      <motion.div 
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
      >
        <StatCard title="Questions Solved" value={stats.totalAttempted.toLocaleString()} icon={<Target size={24} className="text-blue-500" />} bg="from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20" delay={0} />
        <StatCard title="Overall Accuracy" value={`${Math.round(stats.accuracy)}%`} icon={<Activity size={24} className="text-green-500" />} bg="from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20" delay={0.1} />
        <StatCard title="Current Streak" value={`${stats.streakDays}`} icon={<Flame size={24} className="text-orange-500" />} bg="from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20" delay={0.2} />
        <StatCard title="Avg Time/Q" value={formatTime(stats.avgTimeSeconds)} icon={<Clock size={24} className="text-purple-500" />} bg="from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20" delay={0.3} />
      </motion.div>

      {/* Exam Readiness Score */}
      <ExamReadinessCard stats={stats} />

      {/* Score breakdown + QBank Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Score */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-primary" /> Your Score</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ScoreBox label="Correct" value={stats.totalCorrect} color="text-green-600 bg-green-500/10" />
            <ScoreBox label="Incorrect" value={stats.totalIncorrect} color="text-red-500 bg-red-500/10" />
            <ScoreBox label="Omitted" value={Math.max(0, stats.usedQuestions - stats.totalAttempted)} color="text-muted-foreground bg-muted" />
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
            {stats.totalAttempted > 0 && (
              <>
                <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${pctCorrect}%` }} />
                {(100 - pctCorrect) > 0 && <div className="h-full bg-red-400 transition-all" style={{ width: `${100 - pctCorrect}%` }} />}
              </>
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>{pctCorrect}% correct</span>
            <span>{100 - pctCorrect}% incorrect</span>
          </div>
        </div>

        {/* QBank Usage */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><BookOpen size={18} className="text-primary" /> QBank Usage</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ScoreBox label="Used" value={stats.usedQuestions} color="text-primary bg-primary/10" />
            <ScoreBox label="Unused" value={stats.unusedQuestions} color="text-muted-foreground bg-muted" />
            <ScoreBox label="Total" value={stats.totalQuestions} color="text-foreground bg-muted/50" />
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stats.percentUsed}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>{stats.percentUsed}% used</span>
            <span>{stats.unusedQuestions} remaining</span>
          </div>
        </div>
      </div>

      {/* Test Count + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-card rounded-3xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-primary" /> Activity (Last 30 Days)</h2>
          <div className="h-[260px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', background: 'hsl(var(--card))' }} />
                  <Area type="monotone" dataKey="count" name="Questions" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="text-4xl">📊</div>
                <p className="text-sm">Start practicing to see your activity chart</p>
                <button onClick={() => setLocation('/create-test')} className="text-sm text-primary font-semibold hover:underline">Create your first test →</button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Test Count */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2"><ClipboardCheck size={16} className="text-primary" /> Test Count</h2>
              <button onClick={() => setLocation('/tests')} className="text-xs text-primary font-semibold hover:underline">View all →</button>
            </div>
            <div className="space-y-3">
              <TestCountRow label="Tests Created" value={stats.testStats.created + stats.testStats.completed + stats.testStats.suspended} color="text-foreground" />
              <TestCountRow label="Completed" value={stats.testStats.completed} color="text-green-600" />
              <TestCountRow label="Suspended" value={stats.testStats.suspended} color="text-orange-500" />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-5 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <h2 className="font-bold mb-1">Daily Challenge</h2>
              <p className="text-primary-foreground/80 text-xs mb-4">High-yield questions to maintain your streak.</p>
              <button onClick={() => setLocation('/daily')} className="w-full bg-white text-primary font-bold py-2.5 rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 text-sm">
                <Flame size={16} /> Play Now
              </button>
            </div>
          </div>

          {/* Subject Performance */}
          {stats.subjectPerformance.length > 0 && (
            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm">Subject Performance</h2>
                <Link href="/analytics" className="text-xs text-primary font-semibold hover:underline">Full report →</Link>
              </div>
              <div className="space-y-3">
                {stats.subjectPerformance.slice(0, 4).map(sp => (
                  <div key={sp.subject}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate mr-2">{sp.subject}</span>
                      <span className={clsx("font-bold", sp.accuracy >= 70 ? "text-green-600" : sp.accuracy >= 50 ? "text-yellow-600" : "text-red-500")}>
                        {Math.round(sp.accuracy)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={clsx("h-1.5 rounded-full", sp.accuracy >= 70 ? "bg-green-500" : sp.accuracy >= 50 ? "bg-yellow-500" : "bg-red-500")}
                        style={{ width: `${sp.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weak area recommendation */}
      {weakSubject && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Target size={18} className="text-red-500" />
          </div>
          <p className="flex-1 text-sm text-foreground">
            Your <span className="font-semibold">{weakSubject.subject}</span> accuracy is{' '}
            <span className="font-bold text-red-500">{Math.round(weakSubject.accuracy)}%</span>{' '}
            — consider a focused session.
          </p>
          <button
            onClick={() => setLocation('/create-test')}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Practice {weakSubject.subject} <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Free Sample MCQs */}
      {freeQuestions.length > 0 && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Gift size={18} className="text-amber-500" /> Free Sample MCQs
            </h2>
            <Link href="/qbanks">
              <span className="text-xs text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1">
                <ShoppingBag size={12} /> Unlock full access
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {freeQuestions.map((q: any, idx: number) => (
              <div key={q.id} className="border border-border rounded-xl p-4 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{q.subject}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">#{idx + 1}</span>
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-3 mb-3">
                  {q.questionText}
                </p>
                <div className="space-y-1">
                  {Object.entries(q.options as Record<string, string>).slice(0, 2).map(([key, val]) => (
                    <div key={key} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="font-bold text-foreground">{key}.</span>
                      <span className="line-clamp-1">{val as string}</span>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground italic">...</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/qbanks">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors cursor-pointer">
                <ShoppingBag size={15} /> Unlock Full QBank Access
              </span>
            </Link>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function StatCard({ title, value, icon, bg, delay = 0 }: { title: string; value: string; icon: React.ReactNode; bg: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", damping: 20, stiffness: 100 }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-3xl overflow-hidden cursor-pointer"
    >
      {/* Gradient background layer */}
      <div className={clsx("absolute inset-0 bg-gradient-to-br", bg, "transition-opacity group-hover:opacity-100 opacity-80")} />
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {/* Card content */}
      <div className="relative p-6 border border-white/20 backdrop-blur-sm rounded-3xl flex items-start justify-between gap-4 h-full">
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-sm font-semibold opacity-80">{title}</p>
          <motion.h3 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="text-3xl font-bold text-foreground mt-2 tracking-tight truncate"
          >
            {value}
          </motion.h3>
        </div>
        <div className="w-16 h-16 rounded-2xl backdrop-blur-sm bg-white/10 border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-all">
          <motion.div initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: delay + 0.1, type: "spring" }}>
            {icon}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function ScoreBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={clsx("rounded-2xl p-3 text-center", color)}>
      <div className="text-xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function TestCountRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={clsx("text-sm font-bold", color)}>{value}</span>
    </div>
  );
}

/* ── Exam Readiness ─────────────────────────────────────────────────────────── */

function calcReadiness(stats: { usedQuestions: number; totalQuestions: number; accuracy: number; streakDays: number }) {
  const coverage = stats.totalQuestions > 0 ? (stats.usedQuestions / stats.totalQuestions) * 40 : 0;
  const accuracy = (stats.accuracy / 100) * 40;
  const consistency = Math.min(stats.streakDays / 14, 1) * 20;
  return { total: Math.round(coverage + accuracy + consistency), coverage, accuracy, consistency };
}

function readinessStyle(score: number) {
  if (score <= 40) return { label: "Needs Work",    color: "text-red-500",   ring: "#ef4444", badge: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",   bar: "bg-red-500"   };
  if (score <= 65) return { label: "Getting There", color: "text-amber-500", ring: "#f59e0b", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", bar: "bg-amber-500" };
  if (score <= 85) return { label: "Almost Ready",  color: "text-blue-500",  ring: "#3b82f6", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",  bar: "bg-blue-500"  };
  return                  { label: "Exam Ready",    color: "text-green-500", ring: "#22c55e", badge: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300", bar: "bg-green-500" };
}

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

function ExamReadinessCard({ stats }: { stats: { usedQuestions: number; totalQuestions: number; accuracy: number; streakDays: number } }) {
  const r = calcReadiness(stats);
  const s = readinessStyle(r.total);
  const offset = RING_C * (1 - r.total / 100);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring" }}
      className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-card to-card/80 border border-border shadow-lg hover:shadow-xl transition-all"
    >
      {/* Animated accent light */}
      <motion.div 
        className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      
      <div className="relative p-6 flex flex-col sm:flex-row items-center gap-8">
        {/* Circular ring */}
        <motion.div 
          className="relative shrink-0"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r={RING_R} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" opacity="0.3" />
            <motion.circle
              cx="60" cy="60" r={RING_R} fill="none"
              stroke={s.ring} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={offset}
              initial={{ strokeDashoffset: RING_C }}
              animate={{ strokeDashoffset: offset }}
              transition={{ delay: 0.6, duration: 1.5, ease: "easeOut" }}
              style={{ filter: `drop-shadow(0 0 8px ${s.ring})` }}
            />
          </svg>
          <motion.div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <span className={clsx("text-4xl font-extrabold leading-none", s.color)}>{r.total}</span>
            <span className="text-[11px] text-muted-foreground font-bold tracking-wide mt-1">/100</span>
          </motion.div>
        </motion.div>

        {/* Right side */}
        <div className="flex-1 w-full min-w-0">
          <motion.div 
            className="flex items-center gap-3 mb-5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Exam Readiness</h2>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
            <motion.span 
              className={clsx("text-xs font-bold px-3 py-1 rounded-full border", s.badge)}
              whileHover={{ scale: 1.05 }}
            >
              {s.label}
            </motion.span>
          </motion.div>
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, staggerChildren: 0.1 }}
          >
            <ReadinessBar label="Coverage"    score={r.coverage}    max={40} barColor={s.bar} />
            <ReadinessBar label="Accuracy"    score={r.accuracy}    max={40} barColor={s.bar} />
            <ReadinessBar label="Consistency" score={r.consistency} max={20} barColor={s.bar} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

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
