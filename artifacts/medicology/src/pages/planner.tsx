import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useGetAnalytics } from '@workspace/api-client-react';
import { PageTransition } from '@/components/layout';
import {
  Calendar, Clock, Target, Play, CheckCircle2, Circle, ChevronLeft,
  ChevronRight, Pencil, BookOpen, Zap, AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';

/* ── Constants ──────────────────────────────────────────────────────────────── */

const PLAN_KEY        = 'medicology_study_plan';
const COMPLETION_KEY  = 'medicology_plan_completion';
const QUESTIONS_PER_HOUR = 30;

const EXAM_TYPES = [
  'MBBS Professional', 'FCPS Part-1', 'FCPS Part-2', 'USMLE Step 1',
  'USMLE Step 2 CK', 'PLAB Part 1', 'MRCP Part 1', 'MCAT', 'AMC MCQ', 'Custom',
];

const DEFAULT_SUBJECTS = [
  'Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology',
  'Microbiology', 'Forensic Medicine', 'Community Medicine',
  'Medicine', 'Surgery', 'Gynecology & Obstetrics', 'Pediatrics',
  'ENT', 'Ophthalmology', 'Dermatology', 'Psychiatry',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_COLORS: Record<string, string> = {
  'Anatomy':                'bg-red-500/15 text-red-700 border-red-300/50 dark:text-red-400',
  'Physiology':             'bg-yellow-400/15 text-yellow-700 border-yellow-300/50 dark:text-yellow-400',
  'Biochemistry':           'bg-purple-500/15 text-purple-700 border-purple-300/50 dark:text-purple-400',
  'Pathology':              'bg-orange-500/15 text-orange-700 border-orange-300/50 dark:text-orange-400',
  'Pharmacology':           'bg-blue-500/15 text-blue-700 border-blue-300/50 dark:text-blue-400',
  'Microbiology':           'bg-green-500/15 text-green-700 border-green-300/50 dark:text-green-400',
  'Forensic Medicine':      'bg-slate-400/15 text-slate-700 border-slate-300/50 dark:text-slate-400',
  'Community Medicine':     'bg-teal-500/15 text-teal-700 border-teal-300/50 dark:text-teal-400',
  'Medicine':               'bg-cyan-500/15 text-cyan-700 border-cyan-300/50 dark:text-cyan-400',
  'Surgery':                'bg-rose-500/15 text-rose-700 border-rose-300/50 dark:text-rose-400',
  'Gynecology & Obstetrics':'bg-pink-500/15 text-pink-700 border-pink-300/50 dark:text-pink-400',
  'Pediatrics':             'bg-amber-400/15 text-amber-700 border-amber-300/50 dark:text-amber-400',
  'ENT':                    'bg-indigo-500/15 text-indigo-700 border-indigo-300/50 dark:text-indigo-400',
  'Ophthalmology':          'bg-violet-500/15 text-violet-700 border-violet-300/50 dark:text-violet-400',
  'Dermatology':            'bg-lime-500/15 text-lime-700 border-lime-300/50 dark:text-lime-400',
  'Psychiatry':             'bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-300/50 dark:text-fuchsia-400',
  'Radiology':              'bg-sky-500/15 text-sky-700 border-sky-300/50 dark:text-sky-400',
};

function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] ?? 'bg-muted/60 text-muted-foreground border-border';
}

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface StudyPlan {
  examName: string;
  examDate: string;  // "YYYY-MM-DD"
  examType: string;
  hoursPerDay: number;
}

interface DayEntry {
  dateStr: string;   // "YYYY-MM-DD"
  subject: string;
  questions: number;
}

type Completion = Record<string, boolean>;

/* ── Date helpers ───────────────────────────────────────────────────────────── */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/* Returns the Monday of the week containing `date` */
function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/* ── Schedule generation ────────────────────────────────────────────────────── */

function buildSchedule(
  plan: StudyPlan,
  subjectAccuracy: Record<string, number>,
): DayEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examDate = dateFromStr(plan.examDate);
  examDate.setHours(0, 0, 0, 0);

  const totalDays = diffDays(today, examDate);
  if (totalDays <= 0) return [];

  const questionsPerDay = plan.hoursPerDay * QUESTIONS_PER_HOUR;

  /* Build weighted subject list */
  const subjects = DEFAULT_SUBJECTS.filter(s => !!s);
  const weights = subjects.map(s => {
    const acc = subjectAccuracy[s] ?? 50; // default 50% if unseen
    return Math.max(100 - acc, 5);        // weaker → higher weight
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  /* Assign day counts proportionally */
  const rawDays = weights.map(w => (w / totalWeight) * totalDays);
  const dayCounts = rawDays.map(d => Math.max(1, Math.round(d)));

  /* Adjust to exactly match totalDays */
  let sum = dayCounts.reduce((a, b) => a + b, 0);
  let i = 0;
  while (sum < totalDays) { dayCounts[i % subjects.length]++; sum++; i++; }
  while (sum > totalDays) { dayCounts[i % subjects.length] = Math.max(0, dayCounts[i % subjects.length] - 1); sum--; i++; }

  /* Build flat list: weakest first (sorted desc by weight) */
  const indexed = subjects.map((s, idx) => ({ s, w: weights[idx], days: dayCounts[idx] }));
  indexed.sort((a, b) => b.w - a.w); // weakest subjects first in schedule

  const entries: DayEntry[] = [];
  let cursor = new Date(today);
  for (const { s, days } of indexed) {
    for (let d = 0; d < days; d++) {
      entries.push({
        dateStr: toDateStr(cursor),
        subject: s,
        questions: questionsPerDay,
      });
      cursor = addDays(cursor, 1);
    }
  }
  return entries;
}

/* ── LocalStorage helpers ───────────────────────────────────────────────────── */

function loadPlan(): StudyPlan | null {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; }
}
function savePlan(p: StudyPlan) { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }

function loadCompletion(): Completion {
  try { return JSON.parse(localStorage.getItem(COMPLETION_KEY) || '{}'); } catch { return {}; }
}
function saveCompletion(c: Completion) { localStorage.setItem(COMPLETION_KEY, JSON.stringify(c)); }

/* ── Countdown string ───────────────────────────────────────────────────────── */

function useCountdown(examDate: string | undefined) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!examDate) { setLabel(''); return; }
    function calc() {
      const now = Date.now();
      const target = dateFromStr(examDate!).getTime();
      const ms = target - now;
      if (ms <= 0) { setLabel('Exam day has passed'); return; }
      const days = Math.floor(ms / 86_400_000);
      const hrs  = Math.floor((ms % 86_400_000) / 3_600_000);
      setLabel(`${days}d ${hrs}h until exam`);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [examDate]);
  return label;
}

/* ── Setup Form ─────────────────────────────────────────────────────────────── */

function SetupForm({ initial, onSave }: { initial: StudyPlan | null; onSave: (p: StudyPlan) => void }) {
  const [form, setForm] = useState<StudyPlan>(initial ?? {
    examName: '',
    examDate: '',
    examType: EXAM_TYPES[0],
    hoursPerDay: 4,
  });

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minStr = toDateStr(minDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.examName.trim() || !form.examDate) return;
    savePlan(form);
    onSave(form);
  };

  const inputCls = 'w-full bg-muted/50 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
  const labelCls = 'text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider';

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/10 p-2.5 rounded-xl"><Calendar size={22} className="text-primary" /></div>
        <div>
          <h2 className="font-bold text-lg">{initial ? 'Edit Study Plan' : 'Create Your Study Plan'}</h2>
          <p className="text-sm text-muted-foreground">We'll auto-generate a daily schedule based on your weak areas.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Exam Name *</label>
            <input
              value={form.examName}
              onChange={e => setForm(f => ({ ...f, examName: e.target.value }))}
              required
              className={inputCls}
              placeholder="e.g. FCPS Part-1 March 2026"
            />
          </div>
          <div>
            <label className={labelCls}>Exam Type *</label>
            <select
              value={form.examType}
              onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
              className={inputCls}
            >
              {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Exam Date *</label>
          <input
            type="date"
            min={minStr}
            value={form.examDate}
            onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))}
            required
            className={inputCls}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className={labelCls + ' mb-0'}>Hours Available Per Day</label>
            <span className="text-sm font-extrabold text-primary">
              {form.hoursPerDay}h
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (~{form.hoursPerDay * QUESTIONS_PER_HOUR} questions)
              </span>
            </span>
          </div>
          <input
            type="range"
            min={1} max={12} step={1}
            value={form.hoursPerDay}
            onChange={e => setForm(f => ({ ...f, hoursPerDay: Number(e.target.value) }))}
            className="w-full accent-primary h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>1h</span><span>6h</span><span>12h</span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all text-sm"
        >
          {initial ? 'Update Plan' : 'Generate My Study Schedule'}
        </button>
      </form>
    </div>
  );
}

/* ── Today's Task Card ──────────────────────────────────────────────────────── */

function TodayCard({
  entry,
  completed,
  onToggle,
  onStart,
}: {
  entry: DayEntry | undefined;
  completed: boolean;
  onToggle: () => void;
  onStart: () => void;
}) {
  if (!entry) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex items-center gap-4">
        <AlertTriangle size={24} className="text-amber-500 shrink-0" />
        <p className="text-sm text-muted-foreground">
          No study task scheduled for today. Check your plan or adjust your exam date.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx(
      'rounded-3xl p-6 shadow-sm border transition-all',
      completed
        ? 'bg-green-500/5 border-green-400/30'
        : 'bg-primary/5 border-primary/20'
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Focus</span>
            {completed && (
              <span className="text-xs bg-green-500/15 text-green-600 font-bold px-2 py-0.5 rounded-full">✓ Done</span>
            )}
          </div>
          <h2 className="text-2xl font-extrabold font-display leading-tight">{entry.subject}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <Target size={14} /> {entry.questions} questions target
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <Clock size={14} /> {Math.round(entry.questions / QUESTIONS_PER_HOUR)}h estimated
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggle}
            title={completed ? 'Mark incomplete' : 'Mark complete'}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all',
              completed
                ? 'border-green-400/50 bg-green-500/10 text-green-600 hover:bg-green-500/20'
                : 'border-border hover:border-primary/40 text-muted-foreground'
            )}
          >
            {completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {completed ? 'Completed' : 'Mark Done'}
          </button>
          {!completed && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all text-sm shadow-md shadow-primary/25"
            >
              <Play size={15} /> Start Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Progress bar ───────────────────────────────────────────────────────────── */

function PlanProgress({ schedule, completion }: { schedule: DayEntry[]; completion: Completion }) {
  const today = todayStr();
  const pastDays  = schedule.filter(e => e.dateStr <= today);
  const doneDays  = pastDays.filter(e => completion[e.dateStr]);
  const totalDays = schedule.length;
  const pct = totalDays > 0 ? Math.round((doneDays.length / totalDays) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm">Plan Progress</span>
        <span className="text-sm font-extrabold text-primary">{pct}%</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{doneDays.length} days completed</span>
        <span>{totalDays - doneDays.length} days remaining</span>
      </div>
    </div>
  );
}

/* ── Week View ──────────────────────────────────────────────────────────────── */

function WeekView({
  plan,
  schedule,
  completion,
  onToggle,
}: {
  plan: StudyPlan;
  schedule: DayEntry[];
  completion: Completion;
  onToggle: (dateStr: string) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const scheduleMap = useMemo(() => {
    const m: Record<string, DayEntry> = {};
    schedule.forEach(e => { m[e.dateStr] = e; });
    return m;
  }, [schedule]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = dateFromStr(plan.examDate);

  /* Compute displayed week */
  const baseMonday = useMemo(() => weekStart(today), []);
  const displayMonday = addDays(baseMonday, weekOffset * 7);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) weekDays.push(addDays(displayMonday, i));

  const weekLabel = (() => {
    const m = displayMonday;
    const e = weekDays[6];
    return `${m.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center font-bold text-sm">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map(day => {
          const ds = toDateStr(day);
          const isToday     = ds === todayStr();
          const isPast      = day < today;
          const isAfterExam = day >= examDate;
          const entry       = scheduleMap[ds];
          const done        = !!completion[ds];

          return (
            <div
              key={ds}
              className={clsx(
                'flex flex-col min-h-[90px] rounded-2xl border p-2 transition-all text-left',
                isToday
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                  : isPast
                    ? 'border-border/50 bg-muted/20 opacity-60'
                    : isAfterExam
                      ? 'border-border/30 bg-muted/10 opacity-40'
                      : 'border-border hover:border-primary/30 hover:bg-muted/30'
              )}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-1.5">
                <span className={clsx(
                  'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                  {day.getDate()}
                </span>
                {entry && !isAfterExam && (
                  <button
                    onClick={() => onToggle(ds)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    title={done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {done
                      ? <CheckCircle2 size={14} className="text-green-500" />
                      : <Circle size={14} />}
                  </button>
                )}
              </div>

              {/* Content */}
              {isAfterExam ? (
                <span className="text-[10px] text-muted-foreground/60 font-medium mt-auto">Exam day</span>
              ) : entry ? (
                <div className="flex-1 flex flex-col gap-1">
                  <span className={clsx(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-md border leading-tight',
                    done ? 'bg-green-500/10 text-green-600 border-green-300/30 line-through opacity-70' : subjectColor(entry.subject)
                  )}>
                    {entry.subject.length > 12 ? entry.subject.slice(0, 11) + '…' : entry.subject}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {entry.questions}q
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground/40 font-medium mt-auto">—</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Click ◯ on any day to mark it complete
      </p>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function PlannerPage() {
  const [, setLocation] = useLocation();
  const { data: analytics } = useGetAnalytics();

  const [plan, setPlan]       = useState<StudyPlan | null>(loadPlan);
  const [completion, setCompletion] = useState<Completion>(loadCompletion);
  const [editing, setEditing] = useState(false);

  const countdown = useCountdown(plan?.examDate);

  /* Build accuracy map from analytics */
  const subjectAccuracy = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    analytics?.subjectPerformance?.forEach(sp => { map[sp.subject] = sp.accuracy; });
    return map;
  }, [analytics]);

  /* Generate schedule whenever plan or accuracy map changes */
  const schedule = useMemo<DayEntry[]>(() => {
    if (!plan) return [];
    return buildSchedule(plan, subjectAccuracy);
  }, [plan, subjectAccuracy]);

  const today = todayStr();
  const todayEntry = schedule.find(e => e.dateStr === today);
  const completedDays = Object.values(completion).filter(Boolean).length;
  const completionRate = schedule.length > 0 ? Math.round((completedDays / schedule.length) * 100) : 0;

  const toggleCompletion = useCallback((dateStr: string) => {
    setCompletion(prev => {
      const next = { ...prev, [dateStr]: !prev[dateStr] };
      saveCompletion(next);
      return next;
    });
  }, []);

  const handleSave = (p: StudyPlan) => {
    setPlan(p);
    setEditing(false);
  };

  const handleStart = () => {
    if (todayEntry) setLocation(`/create-test?subject=${encodeURIComponent(todayEntry.subject)}`);
  };

  /* Days/hours countdown */
  const examDateObj = plan ? dateFromStr(plan.examDate) : null;
  const daysLeft = examDateObj ? Math.max(0, diffDays(new Date(), examDateObj)) : 0;

  /* Show setup form if no plan yet or user clicked Edit */
  if (!plan || editing) {
    return (
      <PageTransition className="max-w-3xl mx-auto pb-24 space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <Calendar size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold">Study Planner</h1>
            <p className="text-muted-foreground">Personalised schedule built around your weak areas.</p>
          </div>
        </div>
        <SetupForm initial={editing ? plan : null} onSave={handleSave} />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="max-w-5xl mx-auto pb-24 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-primary/10 p-3 rounded-2xl shrink-0">
            <Calendar size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold leading-tight">{plan.examName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">{plan.examType}</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock size={13} /> {countdown || `${daysLeft} days left`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm border border-border px-3 py-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
          >
            <Pencil size={13} /> Edit Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Completed days</p>
          <p className="mt-3 text-3xl font-bold">{completedDays}</p>
        </div>
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Remaining days</p>
          <p className="mt-3 text-3xl font-bold">{Math.max(0, schedule.length - completedDays)}</p>
        </div>
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Plan completion</p>
          <p className="mt-3 text-3xl font-bold">{completionRate}%</p>
        </div>
      </div>

      {/* Countdown ribbon */}
      {daysLeft > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-4">
          <Zap size={18} className="text-primary shrink-0" />
          <span className="text-sm font-bold flex-1">
            {countdown} · {plan.hoursPerDay}h/day · ~{plan.hoursPerDay * QUESTIONS_PER_HOUR} questions/day
          </span>
          <span className="text-xs text-muted-foreground">
            {schedule.length} study days planned
          </span>
        </div>
      )}

      {daysLeft === 0 && (
        <div className="bg-amber-500/5 border border-amber-400/30 rounded-2xl px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm font-semibold">Your exam date has passed or is today. Update your plan to continue scheduling.</p>
          <button onClick={() => setEditing(true)} className="ml-auto text-xs font-bold border border-amber-400/40 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-400/10 transition-colors">
            Edit
          </button>
        </div>
      )}

      {/* Today's task card */}
      <TodayCard
        entry={todayEntry}
        completed={!!completion[today]}
        onToggle={() => toggleCompletion(today)}
        onStart={handleStart}
      />

      {/* Progress bar */}
      <PlanProgress schedule={schedule} completion={completion} />

      {/* Week view */}
      {schedule.length > 0 && (
        <WeekView
          plan={plan}
          schedule={schedule}
          completion={completion}
          onToggle={toggleCompletion}
        />
      )}

      {/* Subject allocation breakdown */}
      {schedule.length > 0 && (
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-primary" /> Subject Allocation
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(() => {
              const counts: Record<string, number> = {};
              schedule.forEach(e => { counts[e.subject] = (counts[e.subject] || 0) + 1; });
              return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, days]) => (
                  <div key={subject} className={clsx(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold',
                    subjectColor(subject)
                  )}>
                    <span className="truncate">{subject}</span>
                    <span className="shrink-0 ml-2 font-extrabold">{days}d</span>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}
    </PageTransition>
  );
}
