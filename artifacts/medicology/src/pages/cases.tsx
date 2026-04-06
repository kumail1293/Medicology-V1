import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import {
  Stethoscope, Search, Filter, Clock, CheckCircle2, ChevronRight,
  ArrowLeft, Play, FlaskConical, Microscope, FileText, Brain,
  Lightbulb, CircleDot, X, CheckCircle, XCircle, BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';

/* ── Constants ──────────────────────────────────────────────────────────────── */

const SYSTEMS = [
  'Cardiology', 'Respiratory', 'Gastroenterology', 'Neurology',
  'Nephrology', 'Endocrinology', 'Hematology', 'Musculoskeletal',
  'Dermatology', 'Psychiatry', 'Obstetrics & Gynecology', 'Pediatrics',
  'Infectious Disease', 'Rheumatology', 'Oncology',
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
type Difficulty = typeof DIFFICULTIES[number];

const EXAM_TYPES_FILTER = [
  'MBBS', 'FCPS Part-1', 'FCPS Part-2', 'USMLE Step 1', 'USMLE Step 2 CK', 'PLAB Part 1',
];

const COMPLETED_KEY = 'medicology_completed_cases';

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy:   'bg-green-500/10 text-green-700 border-green-300/40 dark:text-green-400',
  Medium: 'bg-amber-400/10 text-amber-700 border-amber-300/40 dark:text-amber-400',
  Hard:   'bg-red-500/10 text-red-700 border-red-300/40 dark:text-red-400',
};

const SYSTEM_COLORS: Record<string, string> = {
  'Cardiology':              'bg-red-500/10 text-red-700 dark:text-red-400',
  'Respiratory':             'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  'Gastroenterology':        'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Neurology':               'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Nephrology':              'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Endocrinology':           'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  'Hematology':              'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Musculoskeletal':         'bg-lime-500/10 text-lime-700 dark:text-lime-400',
  'Dermatology':             'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  'Psychiatry':              'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
  'Obstetrics & Gynecology': 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Pediatrics':              'bg-amber-400/10 text-amber-700 dark:text-amber-400',
  'Infectious Disease':      'bg-green-600/10 text-green-700 dark:text-green-400',
  'Rheumatology':            'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Oncology':                'bg-slate-500/10 text-slate-700 dark:text-slate-400',
};

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface ClinicalCase {
  id: number;
  title: string;
  system: string;
  difficulty: Difficulty;
  examType: string;
  estimatedMinutes: number;
  relatedSubject: string;
  // Progressive disclosure content
  chiefComplaint: string;
  history: string;
  examination: string;
  investigations: string;
  diagnosisOptions: string[];   // multiple-choice options (may be empty)
  correctDiagnosis: string;
  explanation: string;
  managementPlan: string;
  keyLearningPoints: string[];
}

/* ── localStorage helpers ───────────────────────────────────────────────────── */

function loadCompletedCases(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]')); }
  catch { return new Set(); }
}

function markLocallyComplete(id: number) {
  const s = loadCompletedCases();
  s.add(id);
  localStorage.setItem(COMPLETED_KEY, JSON.stringify([...s]));
}

/* ── Timer hook ─────────────────────────────────────────────────────────────── */

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      setSeconds(0);
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return { seconds, fmt };
}

/* ── Skeleton card ──────────────────────────────────────────────────────────── */

function CaseCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-pulse space-y-3">
      <div className="flex gap-2">
        <div className="h-5 w-24 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-muted rounded" />
      <div className="flex gap-4">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

/* ── Case card ──────────────────────────────────────────────────────────────── */

function CaseCard({
  c,
  completed,
  onClick,
}: {
  c: ClinicalCase;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={clsx(
        'bg-card border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md group',
        completed ? 'border-green-400/40 hover:border-green-400/60' : 'border-border hover:border-primary/40',
      )}
    >
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', SYSTEM_COLORS[c.system] || 'bg-muted text-muted-foreground')}>
          {c.system}
        </span>
        <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full border', DIFFICULTY_STYLE[c.difficulty])}>
          {c.difficulty}
        </span>
        {completed && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={11} /> Done
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-bold text-sm leading-snug mb-3 group-hover:text-primary transition-colors">
        {c.title}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock size={12} /> ~{c.estimatedMinutes} min
        </span>
        <span className="flex items-center gap-1.5">
          <FileText size={12} /> {c.examType}
        </span>
        <span className="ml-auto text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          Open <ChevronRight size={13} />
        </span>
      </div>
    </motion.div>
  );
}

/* ── Step indicator ─────────────────────────────────────────────────────────── */

const STEPS = [
  { label: 'History',       icon: FileText    },
  { label: 'Examination',   icon: Stethoscope },
  { label: 'Investigations',icon: FlaskConical},
  { label: 'Diagnosis',     icon: Brain       },
  { label: 'Reveal',        icon: Lightbulb   },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        const Icon    = s.icon;
        return (
          <React.Fragment key={s.label}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                done   ? 'bg-primary border-primary text-primary-foreground'
                       : active ? 'bg-primary/10 border-primary text-primary'
                                : 'bg-muted border-border text-muted-foreground'
              )}>
                {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
              </div>
              <span className={clsx(
                'text-[10px] font-semibold mt-1 hidden sm:block',
                active ? 'text-primary' : done ? 'text-primary/70' : 'text-muted-foreground'
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={clsx(
                'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all duration-500',
                i < current ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Content block ──────────────────────────────────────────────────────────── */

function ContentBlock({ title, icon: Icon, children }: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <h3 className="font-bold text-base">{title}</h3>
      </div>
      <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

/* ── Case Attempt View ──────────────────────────────────────────────────────── */

function CaseAttemptView({
  c,
  onBack,
  onComplete,
}: {
  c: ClinicalCase;
  onBack: () => void;
  onComplete: (caseId: number, timeSec: number) => void;
}) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const { seconds, fmt: timerFmt } = useTimer(true);

  const hasOptions = c.diagnosisOptions.length > 0;

  /* Determine if user's answer is correct */
  const userAnswer = hasOptions ? (selectedOption ?? '') : diagnosisText.trim();
  const isCorrect = revealed
    ? userAnswer.toLowerCase().includes(c.correctDiagnosis.toLowerCase().split(' ')[0].toLowerCase())
    : false;

  const advanceTo = (next: number) => {
    setStep(next);
  };

  const handleSubmitDiagnosis = () => {
    if (!userAnswer) return;
    setSubmitted(true);
    advanceTo(4); // reveal
    setRevealed(true);
    onComplete(c.id, seconds);
  };

  /* Slide animation direction */
  const variants = {
    enter:  { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0  },
    exit:   { opacity: 0, x: -40},
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-5">
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft size={15} /> Back to Cases
        </button>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 text-sm font-mono font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-xl">
          <Clock size={13} /> {timerFmt}
        </span>
      </div>

      {/* Case title */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', SYSTEM_COLORS[c.system] || 'bg-muted text-muted-foreground')}>
            {c.system}
          </span>
          <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full border', DIFFICULTY_STYLE[c.difficulty])}>
            {c.difficulty}
          </span>
        </div>
        <h1 className="text-xl font-display font-extrabold leading-snug">{c.title}</h1>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="space-y-4"
        >

          {/* ─ Step 0: History ─ */}
          {step === 0 && (
            <div className="space-y-4">
              <ContentBlock title="Chief Complaint" icon={CircleDot}>
                {c.chiefComplaint}
              </ContentBlock>
              <ContentBlock title="History of Present Illness" icon={FileText}>
                {c.history}
              </ContentBlock>
              <button
                onClick={() => advanceTo(1)}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                View Examination <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ─ Step 1: Examination ─ */}
          {step === 1 && (
            <div className="space-y-4">
              <ContentBlock title="Physical Examination Findings" icon={Stethoscope}>
                {c.examination}
              </ContentBlock>
              <button
                onClick={() => advanceTo(2)}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                View Investigations <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ─ Step 2: Investigations ─ */}
          {step === 2 && (
            <div className="space-y-4">
              <ContentBlock title="Investigation Results" icon={FlaskConical}>
                {c.investigations}
              </ContentBlock>
              <button
                onClick={() => advanceTo(3)}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                Make Diagnosis <Brain size={16} />
              </button>
            </div>
          )}

          {/* ─ Step 3: Diagnosis input ─ */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-amber-400/5 border border-amber-400/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <Brain size={18} className="text-amber-500 shrink-0" />
                <p className="text-sm font-semibold">Based on the history, examination, and investigations — what is your diagnosis?</p>
              </div>

              {hasOptions ? (
                /* Multiple choice */
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select the most likely diagnosis:</p>
                  {c.diagnosisOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSelectedOption(opt)}
                      className={clsx(
                        'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                        selectedOption === opt
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-2">Or type your own diagnosis:</p>
                    <input
                      value={diagnosisText}
                      onChange={e => { setDiagnosisText(e.target.value); setSelectedOption(null); }}
                      placeholder="Type your diagnosis here…"
                      className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              ) : (
                /* Free text */
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your diagnosis:</p>
                  <textarea
                    value={diagnosisText}
                    onChange={e => setDiagnosisText(e.target.value)}
                    placeholder="Type your diagnosis here…"
                    rows={3}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              )}

              <button
                onClick={handleSubmitDiagnosis}
                disabled={!userAnswer}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Lightbulb size={16} /> Submit & Reveal Answer
              </button>
            </div>
          )}

          {/* ─ Step 4: Reveal ─ */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Result banner */}
              <div className={clsx(
                'rounded-2xl p-5 border flex items-start gap-4',
                isCorrect
                  ? 'bg-green-500/5 border-green-400/40'
                  : 'bg-amber-400/5 border-amber-400/30'
              )}>
                {isCorrect
                  ? <CheckCircle size={24} className="text-green-500 shrink-0 mt-0.5" />
                  : <XCircle   size={24} className="text-amber-500 shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className={clsx('font-bold text-sm mb-1', isCorrect ? 'text-green-600' : 'text-amber-600')}>
                    {isCorrect ? 'Correct diagnosis!' : "Not quite \u2014 here\u2019s the correct diagnosis:"}
                  </p>
                  {!isCorrect && userAnswer && (
                    <p className="text-sm text-muted-foreground mb-1">
                      Your answer: <span className="font-semibold line-through">{userAnswer}</span>
                    </p>
                  )}
                  <p className="text-lg font-extrabold font-display">{c.correctDiagnosis}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Clock size={11} /> Completed in {timerFmt}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <ContentBlock title="Explanation" icon={Lightbulb}>
                {c.explanation}
              </ContentBlock>

              {/* Management plan */}
              <ContentBlock title="Management Plan" icon={FileText}>
                {c.managementPlan}
              </ContentBlock>

              {/* Key learning points */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Microscope size={16} className="text-primary" />
                  <h3 className="font-bold text-base">Key Learning Points</h3>
                </div>
                <ul className="space-y-2">
                  {c.keyLearningPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-3 bg-muted/30 border border-border rounded-xl p-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={onBack}
                  className="flex-1 py-3 border border-border rounded-xl text-sm font-bold hover:bg-muted transition-all"
                >
                  Back to Cases
                </button>
                <button
                  onClick={() => setLocation(`/create-test?subject=${encodeURIComponent(c.relatedSubject)}`)}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <BookOpen size={15} /> Related MCQs — {c.relatedSubject}
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Case List View ─────────────────────────────────────────────────────────── */

function CaseListView({ onSelectCase }: { onSelectCase: (c: ClinicalCase) => void }) {
  const { toast } = useToast();
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<number>>(loadCompletedCases);

  const [systemFilter, setSystemFilter]     = useState('');
  const [diffFilter, setDiffFilter]         = useState('');
  const [examTypeFilter, setExamTypeFilter] = useState('');
  const [search, setSearch]                 = useState('');

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('medicology_token');
      const params = new URLSearchParams();
      if (systemFilter)   params.set('system', systemFilter);
      if (diffFilter)     params.set('difficulty', diffFilter);
      if (examTypeFilter) params.set('examType', examTypeFilter);
      // TODO: implement on backend
      const res = await fetch(`/api/cases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCases(Array.isArray(data.cases) ? data.cases : []);
      } else {
        setCases([]);
      }
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [systemFilter, diffFilter, examTypeFilter]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  /* Re-sync completedIds from localStorage on mount */
  useEffect(() => { setCompletedIds(loadCompletedCases()); }, []);

  const displayed = search.trim()
    ? cases.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.system.toLowerCase().includes(search.toLowerCase())
      )
    : cases;

  const completedCount = cases.filter(c => completedIds.has(c.id)).length;

  const clearFilters = () => {
    setSystemFilter(''); setDiffFilter(''); setExamTypeFilter(''); setSearch('');
  };
  const hasFilters = systemFilter || diffFilter || examTypeFilter || search;

  const inputCls = 'appearance-none bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

  return (
    <PageTransition className="max-w-5xl mx-auto pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-primary/10 p-3 rounded-2xl shrink-0">
            <Stethoscope size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold">Clinical Cases</h1>
            <p className="text-muted-foreground mt-0.5">Step-by-step patient scenarios to sharpen clinical reasoning.</p>
          </div>
        </div>
        {cases.length > 0 && (
          <div className="shrink-0 text-sm text-muted-foreground font-medium">
            <span className="font-extrabold text-primary">{completedCount}</span>/{cases.length} completed
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cases…"
            className={inputCls + ' pl-9 w-full'}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* System */}
        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} className={inputCls + ' pl-7 pr-7 min-w-[160px]'}>
            <option value="">All Systems</option>
            {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Difficulty */}
        <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} className={inputCls}>
          <option value="">Any Difficulty</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Exam type */}
        <select value={examTypeFilter} onChange={e => setExamTypeFilter(e.target.value)} className={inputCls}>
          <option value="">Any Exam</option>
          {EXAM_TYPES_FILTER.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-2 rounded-xl hover:bg-muted transition-colors flex items-center gap-1.5">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {systemFilter && (
            <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
              {systemFilter} <button onClick={() => setSystemFilter('')}><X size={10} /></button>
            </span>
          )}
          {diffFilter && (
            <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
              {diffFilter} <button onClick={() => setDiffFilter('')}><X size={10} /></button>
            </span>
          )}
          {examTypeFilter && (
            <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
              {examTypeFilter} <button onClick={() => setExamTypeFilter('')}><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* Case grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CaseCardSkeleton key={i} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏥</div>
          <h3 className="text-lg font-bold mb-2">
            {hasFilters ? 'No cases match your filters' : 'No clinical cases yet'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {hasFilters
              ? 'Try removing some filters to see more cases.'
              : 'Clinical cases will appear here once the backend is configured. Cases are authored by faculty and cover all major clinical systems.'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 text-sm text-primary font-semibold hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map(c => (
              <CaseCard
                key={c.id}
                c={c}
                completed={completedIds.has(c.id)}
                onClick={() => onSelectCase(c)}
              />
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {displayed.length} case{displayed.length !== 1 ? 's' : ''} shown
          </p>
        </>
      )}
    </PageTransition>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function CasesPage() {
  const { toast } = useToast();
  const [activeCase, setActiveCase] = useState<ClinicalCase | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<number>>(loadCompletedCases);

  const handleComplete = useCallback(async (caseId: number, timeSec: number) => {
    /* Save locally immediately */
    markLocallyComplete(caseId);
    setCompletedIds(prev => { const s = new Set(prev); s.add(caseId); return s; });

    try {
      const token = localStorage.getItem('medicology_token');
      // TODO: implement on backend
      await fetch(`/api/cases/${caseId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ timeSpentSeconds: timeSec }),
      });
    } catch {
      /* Backend not ready yet — local save is sufficient */
    }

    toast({ title: '✓ Case completed!', description: `Time: ${Math.floor(timeSec / 60)}m ${timeSec % 60}s` });
  }, [toast]);

  if (activeCase) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-5xl mx-auto"
      >
        <CaseAttemptView
          c={activeCase}
          onBack={() => setActiveCase(null)}
          onComplete={handleComplete}
        />
      </motion.div>
    );
  }

  return (
    <CaseListView onSelectCase={setActiveCase} />
  );
}
