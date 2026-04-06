import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  Play, ChevronRight, ListChecks, Shuffle, AlignLeft, CheckSquare,
  XCircle, Bookmark, ChevronLeft, Info, BookOpen, Layers,
  Globe, Calendar, LayoutGrid, GraduationCap, Timer, FileText,
  Building2, Package,
} from 'lucide-react';
import { clsx } from 'clsx';
import { LogoImg } from '@/components/LogoImg';

/* ─── Types ───────────────────────────────────────────────────────────────── */
type Step = 'qbank' | 'subtype' | 'year' | 'examtype' | 'customize';

interface SubtypeConfig {
  id: string;
  label: string;
  catalogueId?: string;
  logo?: string;
}

interface ParentQBank {
  id: string;
  label: string;
  description: string;
  color: string;
  activeColor: string;
  catalogueIds: string[];
  isMBBS: boolean;
  pakistan: boolean;
  logo?: string;
  subtypes: SubtypeConfig[];
}

/* ─── Parent Q-Bank catalogue ─────────────────────────────────────────────── */
const PARENT_QBANKS: ParentQBank[] = [
  {
    id: 'mbbs', label: 'Pakistan\nMedical Universities',
    description: 'MBBS University MCQ Banks', pakistan: true, isMBBS: true,
    logo: '/logos/pakistan-flag.svg',
    color: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    activeColor: 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-400/30',
    catalogueIds: ['mbbs'],
    subtypes: [
      { id: 'uhs',    label: 'UHS',    logo: '/logos/uhs.webp' },
      { id: 'kemu',   label: 'KEMU',   logo: '/logos/kemu.png' },
      { id: 'szabmu', label: 'SZABMU', logo: '/logos/szabmu.jpg' },
      { id: 'fjmu',   label: 'FJMU',   logo: '/logos/fjmu.png' },
      { id: 'rmu',    label: 'RMU',    logo: '/logos/rmu.png' },
      { id: 'aku',    label: 'AKU',    logo: '/logos/aku.png' },
      { id: 'kmu',    label: 'KMU',    logo: '/logos/kmu.png' },
      { id: 'bumhs',  label: 'BUMHS',  logo: '/logos/bumhs.svg' },
      { id: 'fmu',    label: 'FMU',    logo: '/logos/fmu.jpg' },
      { id: 'nmu',    label: 'NMU',    logo: '/logos/nmu.webp' },
      { id: 'pumhs',  label: 'PUMHS',  logo: '/logos/pumhs.png' },
      { id: 'duhs',   label: 'DUHS',   logo: '/logos/duhs.png' },
      { id: 'nums',   label: 'NUMS',   logo: '/logos/nums.webp' },
      { id: 'smbbmu', label: 'SMBBMU', logo: '/logos/smbbmu.png' },
    ],
  },
  {
    id: 'fcps', label: 'FCPS',
    description: 'Fellowship of College of Physicians & Surgeons Pakistan',
    pakistan: true, isMBBS: false,
    logo: '/logos/cpsp.png',
    color: 'border-purple-500/40 bg-purple-500/5 text-purple-700 dark:text-purple-300',
    activeColor: 'border-purple-500 bg-purple-500/15 ring-2 ring-purple-400/30',
    catalogueIds: ['fcps_part1', 'fcps_part2', 'fcps_fellowship'],
    subtypes: [
      { id: 'part1',      label: 'Part 1',      catalogueId: 'fcps_part1' },
      { id: 'part2',      label: 'Part 2',      catalogueId: 'fcps_part2' },
      { id: 'fellowship', label: 'Fellowship',  catalogueId: 'fcps_fellowship' },
    ],
  },
  {
    id: 'nre', label: 'NRE',
    description: 'National Registration Examination — Pakistan Medical Commission',
    pakistan: true, isMBBS: false,
    logo: '/logos/pmdc.png',
    color: 'border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300',
    activeColor: 'border-orange-500 bg-orange-500/15 ring-2 ring-orange-400/30',
    catalogueIds: ['nle_nle1', 'nle_nle2'],
    subtypes: [
      { id: 'nre1', label: 'NRE-1', catalogueId: 'nle_nle1' },
      { id: 'nre2', label: 'NRE-2', catalogueId: 'nle_nle2' },
    ],
  },
  {
    id: 'neb', label: 'NEB',
    description: 'National Equivalence Board — PMDC Pakistan',
    pakistan: true, isMBBS: false,
    logo: '/logos/pmdc.png',
    color: 'border-teal-500/40 bg-teal-500/5 text-teal-700 dark:text-teal-300',
    activeColor: 'border-teal-500 bg-teal-500/15 ring-2 ring-teal-400/30',
    catalogueIds: ['neb_1', 'neb_2'],
    subtypes: [
      { id: 'neb1', label: 'NEB-1', catalogueId: 'neb_1' },
      { id: 'neb2', label: 'NEB-2', catalogueId: 'neb_2' },
    ],
  },
  {
    id: 'usmle', label: 'USMLE',
    description: 'United States Medical Licensing Examination',
    pakistan: false, isMBBS: false,
    logo: '/logos/usmle.png',
    color: 'border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300',
    activeColor: 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-400/30',
    catalogueIds: ['usmle_step1', 'usmle_step2ck', 'usmle_step3'],
    subtypes: [
      { id: 'step1',   label: 'Step 1',    catalogueId: 'usmle_step1' },
      { id: 'step2ck', label: 'Step 2 CK', catalogueId: 'usmle_step2ck' },
      { id: 'step3',   label: 'Step 3',    catalogueId: 'usmle_step3' },
    ],
  },
  {
    id: 'plab', label: 'PLAB',
    description: 'Professional & Linguistic Assessments Board — GMC UK',
    pakistan: false, isMBBS: false,
    logo: '/logos/gmc.png',
    color: 'border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300',
    activeColor: 'border-red-500 bg-red-500/15 ring-2 ring-red-400/30',
    catalogueIds: ['plab1', 'plab2'],
    subtypes: [
      { id: 'plab1', label: 'PLAB 1', catalogueId: 'plab1' },
      { id: 'plab2', label: 'PLAB 2', catalogueId: 'plab2' },
    ],
  },
  {
    id: 'amc', label: 'AMC',
    description: 'Australian Medical Council',
    pakistan: false, isMBBS: false,
    logo: '/logos/amc.png',
    color: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300',
    activeColor: 'border-yellow-500 bg-yellow-500/15 ring-2 ring-yellow-400/30',
    catalogueIds: ['amc_cat', 'amc_clinical'],
    subtypes: [
      { id: 'cat',      label: 'AMC CAT',      catalogueId: 'amc_cat' },
      { id: 'clinical', label: 'Clinical Exam', catalogueId: 'amc_clinical' },
    ],
  },
  {
    id: 'mrcp', label: 'MRCP',
    description: 'Member of Royal College of Physicians UK',
    pakistan: false, isMBBS: false,
    logo: '/logos/mrcp.png',
    color: 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300',
    activeColor: 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-400/30',
    catalogueIds: ['mrcp_part1', 'mrcp_part2', 'mrcp_paces'],
    subtypes: [
      { id: 'part1', label: 'Part 1', catalogueId: 'mrcp_part1' },
      { id: 'part2', label: 'Part 2', catalogueId: 'mrcp_part2' },
      { id: 'paces', label: 'PACES',  catalogueId: 'mrcp_paces' },
    ],
  },
];

/* ─── Subjects ────────────────────────────────────────────────────────────── */
const ALL_SUBJECTS = [
  'Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology',
  'Microbiology', 'Forensic Medicine', 'Community Medicine', 'Medicine',
  'Surgery', 'Gynecology & Obstetrics', 'Pediatrics', 'ENT', 'Ophthalmology',
  'Dermatology', 'Psychiatry', 'Radiology',
];

const ALL_SYSTEMS = [
  'Cardiovascular', 'Respiratory', 'Gastrointestinal', 'Renal/Urinary',
  'Endocrine', 'Musculoskeletal', 'Neuroscience', 'Hematology/Oncology',
  'Reproductive', 'Immune/Rheumatology', 'Dermatology', 'Behavioral Science',
  'Biochemistry/Nutrition', 'Microbiology', 'Pharmacology',
  'Psychiatry', 'Ophthalmology', 'ENT/Audiology',
];

const YEARS = [
  { id: 'year1', label: '1st Year' }, { id: 'year2', label: '2nd Year' },
  { id: 'year3', label: '3rd Year' }, { id: 'year4', label: '4th Year' },
  { id: 'year5', label: '5th Year' },
];

const EXAM_TYPES = [
  {
    id: 'annual', label: 'Annual',
    description: 'End-of-year comprehensive exam covering the full academic year',
  },
  {
    id: 'modular', label: 'Modular',
    description: 'Module-based exams conducted throughout the year in blocks',
  },
];

const EXAM_TYPE_ICONS: Record<string, React.ReactNode> = {
  annual:  <Calendar size={26} className="text-emerald-600" />,
  modular: <LayoutGrid size={26} className="text-emerald-600" />,
};

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30, 40, 50];

const MODES = [
  { id: 'tutor',    label: 'Tutor Mode',    description: 'See answer & explanation after each question', color: 'border-green-500/50 bg-green-500/5', activeColor: 'border-green-500 bg-green-500/15 ring-2 ring-green-500/30' },
  { id: 'timed',   label: 'Timed Mode',    description: 'USMLE-style: 1.5 min/question, reveal at end',  color: 'border-blue-500/50 bg-blue-500/5',  activeColor: 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30' },
  { id: 'practice',label: 'Practice Mode', description: 'Untimed — review all answers when you finish',   color: 'border-primary/50 bg-primary/5',    activeColor: 'border-primary bg-primary/15 ring-2 ring-primary/30' },
  { id: 'block',   label: 'Block Exam',    description: 'Fixed blocks, no going back, 10-min break',      color: 'border-rose-500/50 bg-rose-500/5',  activeColor: 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/30' },
];

const MODE_ICONS: Record<string, React.ReactNode> = {
  tutor:    <GraduationCap size={18} className="text-green-600" />,
  timed:    <Timer size={18} className="text-blue-600" />,
  practice: <FileText size={18} className="text-primary" />,
  block:    <Building2 size={18} className="text-rose-600" />,
};

const FILTERS = [
  { id: 'all',       label: 'All Questions',  icon: <ListChecks size={14} />, desc: 'Use the entire question pool' },
  { id: 'unused',    label: 'Unused Only',    icon: <CheckSquare size={14} />, desc: 'Questions you haven\u2019t attempted' },
  { id: 'incorrect', label: 'Incorrect Only', icon: <XCircle size={14} />,     desc: 'Questions you got wrong' },
  { id: 'marked',    label: 'Marked Only',    icon: <Bookmark size={14} />,    desc: 'Questions flagged for review' },
];

const BLOCK_SIZES: { value: 20 | 40 | 46; label: string }[] = [
  { value: 20, label: '20 / block' }, { value: 40, label: '40 / block' }, { value: 46, label: '46 / block' },
];

/* ─── Step breadcrumb labels ──────────────────────────────────────────────── */
const STEP_LABELS: Record<Step, string> = {
  qbank: 'Select QBank',
  subtype: 'Sub-category',
  year: 'Academic Year',
  examtype: 'Exam Type',
  customize: 'Customize',
};

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function CreateTestPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [purchasesLoaded, setPurchasesLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('medicology_token');
    fetch('/api/qbanks/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const ids = (d.purchases || []).map((p: any) => p.qbankType as string);
        setPurchasedIds(ids);
        setPurchasesLoaded(true);
      })
      .catch(() => setPurchasesLoaded(true));
  }, []);

  /* ── Wizard state ──────────────────────────────────────────────────────── */
  const [step, setStep] = useState<Step>('qbank');

  const [selectedParent, setSelectedParent] = useState<ParentQBank | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<SubtypeConfig | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedExamType, setSelectedExamType] = useState<string | null>(null);

  // Customization
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [mode, setMode] = useState('tutor');
  const [filter, setFilter] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [randomOrder, setRandomOrder] = useState(true);
  const [blockSize, setBlockSize] = useState<20 | 40 | 46>(40);
  const [blockCount, setBlockCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  /* ── Derived ───────────────────────────────────────────────────────────── */
  const isBlockMode = mode === 'block';
  const effectiveQuestionCount = isBlockMode ? blockSize * blockCount : questionCount;

  const hasPurchased = (parent: ParentQBank) => {
    if (isAdmin) return true;
    return parent.catalogueIds.some(cid => purchasedIds.includes(cid));
  };

  const availableParents = purchasesLoaded
    ? PARENT_QBANKS.filter(hasPurchased)
    : [];

  const availableSubtypes = selectedParent
    ? selectedParent.subtypes.filter(sub => {
        if (!sub.catalogueId) return true; // MBBS universities: always show
        if (isAdmin) return true;
        return purchasedIds.includes(sub.catalogueId);
      })
    : [];

  /* ── Step navigation ───────────────────────────────────────────────────── */
  const goBack = () => {
    if (step === 'subtype')   { setStep('qbank');   setSelectedSubtype(null); }
    else if (step === 'year') { setStep('subtype');  setSelectedYear(null); }
    else if (step === 'examtype') { setStep('year'); setSelectedExamType(null); }
    else if (step === 'customize') {
      if (selectedParent?.isMBBS) setStep('examtype');
      else setStep('subtype');
    }
  };

  const selectParent = (parent: ParentQBank) => {
    setSelectedParent(parent);
    setSelectedSubtype(null);
    setSelectedYear(null);
    setSelectedExamType(null);
    setSelectedSubjects([]);
    setSelectedSystems([]);
    setStep('subtype');
  };

  const selectSubtype = (sub: SubtypeConfig) => {
    setSelectedSubtype(sub);
    setSelectedYear(null);
    setSelectedExamType(null);
    if (selectedParent?.isMBBS) setStep('year');
    else setStep('customize');
  };

  const selectYear = (yearId: string) => {
    setSelectedYear(yearId);
    setStep('examtype');
  };

  const selectExamType = (typeId: string) => {
    setSelectedExamType(typeId);
    setStep('customize');
  };

  /* ── Create session ────────────────────────────────────────────────────── */
  const buildTitle = () => {
    if (!selectedParent) return 'Test';
    const examPart = isBlockMode
      ? ` — ${blockCount} Block${blockCount > 1 ? 's' : ''} × ${blockSize} Qs`
      : ` — ${questionCount} Qs`;

    if (selectedParent.isMBBS) {
      const uni = selectedSubtype?.label || selectedParent.label;
      const yr = YEARS.find(y => y.id === selectedYear)?.label || '';
      const et = EXAM_TYPES.find(t => t.id === selectedExamType)?.label || '';
      return `${uni} · ${yr} · ${et}${examPart}`;
    }
    const sub = selectedSubtype ? ` ${selectedSubtype.label}` : '';
    return `${selectedParent.label}${sub}${examPart}`;
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const token = localStorage.getItem('medicology_token');

      const universityTag = selectedParent?.isMBBS ? selectedSubtype?.id : undefined;
      const examTypeTag = !selectedParent?.isMBBS && selectedParent && selectedSubtype
        ? `${selectedParent.label} ${selectedSubtype.label}`.trim()
        : undefined;
      const yearTag = selectedParent?.isMBBS && selectedYear
        ? YEARS.find(y => y.id === selectedYear)?.label
        : undefined;
      const paperType = selectedParent?.isMBBS ? selectedExamType : undefined;

      const response = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subjects: selectedSubjects.length > 0 ? selectedSubjects : undefined,
          systems: selectedSystems.length > 0 ? selectedSystems : undefined,
          questionCount: effectiveQuestionCount,
          mode,
          blockSize: isBlockMode ? blockSize : undefined,
          questionFilter: filter,
          difficulty: difficulty === 'all' ? undefined : difficulty,
          random: randomOrder,
          universityTag,
          examType: examTypeTag,
          yearTag,
          paperType,
          title: buildTitle(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.session) {
        toast({ title: 'Could not create test', description: data.error || data.message || 'No questions match your filters.', variant: 'destructive' });
        return;
      }
      setLocation(`/session/${data.session.id}`);
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  const toggleSubject = (s: string) => setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleSystem = (s: string) => setSelectedSystems(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const STEP_ORDER: Step[] = selectedParent?.isMBBS
    ? ['qbank', 'subtype', 'year', 'examtype', 'customize']
    : ['qbank', 'subtype', 'customize'];

  const stepIndex = STEP_ORDER.indexOf(step);
  const stepTotal = STEP_ORDER.length;

  /* ── Skeleton while loading ────────────────────────────────────────────── */
  const isLoading = !purchasesLoaded;

  return (
    <PageTransition className="max-w-3xl mx-auto pb-24 px-4">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        {step !== 'qbank' && (
          <button
            onClick={goBack}
            className="p-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-display font-extrabold tracking-tight">Create a Test</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{STEP_LABELS[step]}</p>
        </div>
        <button onClick={() => setLocation('/tests')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          My Tests <ChevronRight size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={clsx(
              'h-1.5 rounded-full flex-1 transition-all duration-300',
              i <= stepIndex ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ══ STEP 1: SELECT QBANK ═══════════════════════════════════════════ */}
        {step === 'qbank' && (
          <motion.div key="step-qbank" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-3xl bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {purchasesLoaded && availableParents.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-border p-12 text-center space-y-3">
                <Package size={40} className="text-muted-foreground/40 mx-auto" />
                <p className="font-semibold">No QBanks purchased yet</p>
                <p className="text-sm text-muted-foreground">Visit the store to unlock your first QBank.</p>
                <button onClick={() => setLocation('/qbanks')} className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all">
                  Browse Store <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Pakistan section */}
            {availableParents.filter(p => p.pakistan).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Building2 size={15} className="text-muted-foreground/60" /> Pakistan
                </p>
                <div className="space-y-3">
                  {availableParents.filter(p => p.pakistan).map(parent => (
                    <QBankCard key={parent.id} parent={parent} onClick={() => selectParent(parent)} />
                  ))}
                </div>
              </div>
            )}

            {/* International section */}
            {availableParents.filter(p => !p.pakistan).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Globe size={16} /> International
                </p>
                <div className="space-y-3">
                  {availableParents.filter(p => !p.pakistan).map(parent => (
                    <QBankCard key={parent.id} parent={parent} onClick={() => selectParent(parent)} />
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        )}

        {/* ══ STEP 2: SUB-TYPE (University for MBBS / Step-Part for others) ═ */}
        {step === 'subtype' && selectedParent && (
          <motion.div key="step-subtype" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl border border-border">
              <LogoImg src={selectedParent.logo} size={36} className="shrink-0 rounded-xl" />
              <div>
                <p className="font-bold">{selectedParent.label.replace('\n', ' ')}</p>
                <p className="text-xs text-muted-foreground">{selectedParent.description}</p>
              </div>
            </div>

            <p className="text-sm font-semibold text-muted-foreground">
              {selectedParent.isMBBS ? 'Select your university:' : 'Select the exam component:'}
            </p>

            {selectedParent.isMBBS ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {availableSubtypes.map(sub => (
                  <motion.button
                    key={sub.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => selectSubtype(sub)}
                    className={clsx(
                      'flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border-2 text-center font-bold text-sm transition-all',
                      'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 hover:scale-[1.03]',
                    )}
                  >
                    <LogoImg src={sub.logo} size={36} className="rounded-lg" />
                    <span className="leading-tight text-xs">{sub.label}</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {availableSubtypes.map(sub => (
                  <motion.button
                    key={sub.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectSubtype(sub)}
                    className={clsx(
                      'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left font-bold transition-all',
                      selectedParent.color,
                      `hover:${selectedParent.activeColor.split(' ')[0]}`,
                      'hover:scale-[1.01]',
                    )}
                  >
                    <LogoImg src={selectedParent.logo} size={32} className="shrink-0 rounded-xl" />
                    <div>
                      <p className="font-bold">{sub.label}</p>
                      <p className="text-xs font-normal text-muted-foreground">{selectedParent.label.replace('\n', ' ')} — {sub.label}</p>
                    </div>
                    <ChevronRight size={18} className="ml-auto opacity-40" />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ STEP 3: YEAR (MBBS only) ══════════════════════════════════════ */}
        {step === 'year' && selectedParent?.isMBBS && (
          <motion.div key="step-year" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl border border-border">
              <LogoImg src={selectedParent.logo} size={36} className="shrink-0 rounded-xl" />
              <div>
                <p className="font-bold">{selectedSubtype?.label} — MBBS</p>
                <p className="text-xs text-muted-foreground">Select your academic year</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {YEARS.map(year => (
                <motion.button
                  key={year.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectYear(year.id)}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 font-bold text-left transition-all"
                >
                  <span className="text-3xl font-black text-emerald-500/60">{year.id.replace('year', '')}</span>
                  <span>{year.label}</span>
                  <ChevronRight size={16} className="ml-auto opacity-40" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ STEP 4: EXAM TYPE (MBBS only) ════════════════════════════════ */}
        {step === 'examtype' && selectedParent?.isMBBS && (
          <motion.div key="step-examtype" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl border border-border">
              <LogoImg src={selectedParent.logo} size={36} className="shrink-0 rounded-xl" />
              <div>
                <p className="font-bold">{selectedSubtype?.label} — {YEARS.find(y => y.id === selectedYear)?.label}</p>
                <p className="text-xs text-muted-foreground">Select exam format</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {EXAM_TYPES.map(et => (
                <motion.button
                  key={et.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectExamType(et.id)}
                  className="flex flex-col items-start gap-2 px-5 py-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 text-left transition-all"
                >
                  <span className="mb-0.5">{EXAM_TYPE_ICONS[et.id]}</span>
                  <p className="font-bold text-base">{et.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{et.description}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ STEP 5: CUSTOMIZE ════════════════════════════════════════════ */}
        {step === 'customize' && selectedParent && (
          <motion.div key="step-customize" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">

            {/* Summary banner */}
            <div className={clsx('flex items-center gap-3 p-4 rounded-2xl border-2', selectedParent.color)}>
              <LogoImg src={selectedParent.logo} size={32} className="shrink-0 rounded-xl" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{buildTitle()}</p>
                <p className="text-xs text-muted-foreground">Customize your session below</p>
              </div>
              <BookOpen size={18} className="opacity-40 shrink-0" />
            </div>

            {/* System Filter (UWorld-style) */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Layers size={15} className="text-primary" /> System
                </h3>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => setSelectedSystems(ALL_SYSTEMS)} className="text-primary hover:underline font-medium">All</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={() => setSelectedSystems([])} className="text-muted-foreground hover:text-foreground">Reset</button>
                </div>
              </div>
              {selectedSystems.length === 0 && (
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Info size={11} /> No system selected — all systems included
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {ALL_SYSTEMS.map(sys => (
                  <button
                    key={sys}
                    onClick={() => toggleSystem(sys)}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
                      selectedSystems.includes(sys)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}
                  >
                    {sys}
                  </button>
                ))}
              </div>
            </section>

            {/* Subject Filter */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Subjects</h3>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => setSelectedSubjects(ALL_SUBJECTS)} className="text-primary hover:underline font-medium">All</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={() => setSelectedSubjects([])} className="text-muted-foreground hover:text-foreground">Reset</button>
                </div>
              </div>
              {selectedSubjects.length === 0 && (
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Info size={11} /> No subject selected — all subjects included
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_SUBJECTS.map(sub => (
                  <button
                    key={sub}
                    onClick={() => toggleSubject(sub)}
                    className={clsx(
                      'px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all',
                      selectedSubjects.includes(sub)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </section>

            {/* Question Count (hidden in block mode) */}
            {!isBlockMode && (
              <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-sm mb-3">Number of Questions</h3>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_COUNTS.map(n => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={clsx(
                        'w-14 h-14 rounded-2xl font-bold text-base border-2 transition-all',
                        questionCount === n
                          ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-110'
                          : 'bg-background border-border hover:border-primary/50'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Mode */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-sm mb-3">Exam Mode</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {MODES.map(m => (
                  <motion.button
                    key={m.id} whileTap={{ scale: 0.98 }}
                    onClick={() => setMode(m.id)}
                    className={clsx('p-3.5 rounded-2xl border-2 text-left transition-all', mode === m.id ? m.activeColor : m.color + ' hover:scale-[1.01]')}
                  >
                    <div className="mb-1.5">{MODE_ICONS[m.id]}</div>
                    <div className="font-bold text-xs mb-1">{m.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</div>
                  </motion.button>
                ))}
              </div>
            </section>

            {/* Block Config */}
            <AnimatePresence>
              {isBlockMode && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="bg-rose-500/5 border-2 border-rose-500/30 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <Building2 size={20} className="text-rose-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-sm">Block Configuration</p>
                      <p className="text-xs text-muted-foreground">Total: {effectiveQuestionCount} Qs across {blockCount} block{blockCount > 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-2xl font-black text-rose-500">{effectiveQuestionCount}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Questions per Block</p>
                    <div className="flex gap-2">
                      {BLOCK_SIZES.map(bs => (
                        <button key={bs.value} onClick={() => setBlockSize(bs.value)}
                          className={clsx('flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all',
                            blockSize === bs.value ? 'bg-rose-500 text-white border-rose-500' : 'border-rose-500/30 hover:border-rose-500/60'
                          )}
                        >{bs.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Number of Blocks</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(n => (
                        <button key={n} onClick={() => setBlockCount(n)}
                          className={clsx('flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all',
                            blockCount === n ? 'bg-rose-500 text-white border-rose-500' : 'border-rose-500/30 hover:border-rose-500/60'
                          )}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Question Pool + Options row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">Question Pool</h3>
                <div className="space-y-1.5">
                  {FILTERS.map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)}
                      className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-xs transition-all',
                        filter === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30 hover:bg-muted/30'
                      )}
                    >
                      {f.icon}
                      <div>
                        <p className="font-semibold">{f.label}</p>
                        <p className="text-muted-foreground text-[10px]">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">Difficulty</h3>
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'easy', 'medium', 'hard'].map(d => (
                      <button key={d} onClick={() => setDifficulty(d)}
                        className={clsx('px-3 py-1.5 rounded-xl border text-xs font-semibold capitalize transition-all',
                          difficulty === d ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'
                        )}
                      >{d === 'all' ? 'All Difficulties' : d}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-2">Order</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setRandomOrder(true)}
                      className={clsx('flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                        randomOrder ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'
                      )}
                    >
                      <Shuffle size={12} /> Random
                    </button>
                    <button onClick={() => setRandomOrder(false)}
                      className={clsx('flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                        !randomOrder ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'
                      )}
                    >
                      <AlignLeft size={12} /> Sequential
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* START button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-3 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:transform-none"
            >
              {isCreating ? (
                <><div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Creating</>
              ) : (
                <><Play size={18} /> Start Test — {effectiveQuestionCount} Questions</>
              )}
            </motion.button>

          </motion.div>
        )}

      </AnimatePresence>
    </PageTransition>
  );
}

/* ─── QBank Card component ────────────────────────────────────────────────── */
function QBankCard({ parent, onClick }: { parent: ParentQBank; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.01] hover:shadow-sm',
        parent.color,
      )}
    >
      <LogoImg src={parent.logo} size={44} className="shrink-0 rounded-xl" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-base leading-tight">{parent.label.replace('\n', ' ')}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{parent.description}</p>
      </div>
      <ChevronRight size={18} className="opacity-40 shrink-0" />
    </motion.button>
  );
}
