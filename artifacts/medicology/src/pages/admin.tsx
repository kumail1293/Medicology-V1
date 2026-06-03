import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  type Question,
  type QuestionOption,
  type AdminUser,
  type AdminFlag,
  type Announcement,
  type CreateQuestionRequest,
  type CreateQuestionRequestDifficulty,
  type CreateQuestionRequestExamType,
  CreateQuestionRequestDifficulty as CreateQuestionRequestDifficultyEnum,
  CreateQuestionRequestExamType as CreateQuestionRequestExamTypeEnum,
  useAdminGetQuestions,
  useAdminBulkUpload,
  useAdminGetStats,
  useAdminGetUsers,
  useAdminCreateUser,
  useAdminUpdateUser,
  useAdminDeleteUser,
  useAdminResetUserPassword,
  useAdminGetFlags,
  useAdminDeleteFlag,
  useAdminCreateQuestion,
  useAdminUpdateQuestion,
  useAdminDeleteQuestion,
  useAdminGetAnnouncements,
  useAdminCreateAnnouncement,
  useAdminUpdateAnnouncement,
  useAdminDeleteAnnouncement,
  useRequestUploadUrl,
} from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { PageTransition } from '@/components/layout';
import {
  ShieldAlert, Upload, Search, AlertCircle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Gift, Users, BarChart2, Flag, BookOpen,
  GripVertical, Plus, Pencil, Trash2, RefreshCw, X, Save, FileUp,
  ChevronLeft, ChevronRight, Shield, ShieldOff, Megaphone, Bell,
  Image, Lock, UserPlus, FileSpreadsheet, Eye, EyeOff, Download,
  Copy, Layers2, SlidersHorizontal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clsx } from 'clsx';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TOKEN = () => localStorage.getItem('medicology_token') ?? '';

const STORAGE_KEY = 'medicology_admin_panel_order';
const DEFAULT_SECTIONS = ['stats', 'questions', 'bulk', 'users', 'roles', 'announcements', 'notes', 'flags', 'errata'];

const SECTION_META: Record<string, { label: string; icon: React.ReactNode }> = {
  stats:         { label: 'Platform Stats',      icon: <BarChart2 size={16} /> },
  questions:     { label: 'Question Database',   icon: <BookOpen size={16} /> },
  bulk:          { label: 'Bulk Upload (Excel)',  icon: <FileSpreadsheet size={16} /> },
  users:         { label: 'User Management',     icon: <Users size={16} /> },
  roles:         { label: 'Roles & Permissions', icon: <Shield size={16} /> },
  announcements: { label: 'Announcements',       icon: <Megaphone size={16} /> },
  notes:         { label: 'High-Yield Notes',    icon: <Layers2 size={16} /> },
  flags:         { label: 'Question Flags',      icon: <Flag size={16} /> },
  errata:        { label: 'Erratum Reports',     icon: <AlertCircle size={16} /> },
};

function useSectionOrder() {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) {
          // Keep saved items in their order, then add new items in DEFAULT_SECTIONS order
          const savedInDefaults = parsed.filter(id => DEFAULT_SECTIONS.includes(id));
          const newItems = DEFAULT_SECTIONS.filter(id => !parsed.includes(id));
          return [...savedInDefaults, ...newItems];
        }
      }
    } catch {}
    return DEFAULT_SECTIONS;
  });

  const updateOrder = (newOrder: string[]) => {
    setOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  };

  return [order, updateOrder] as const;
}

interface SortablePanelProps {
  id: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SortablePanel({ id, collapsed, onToggle, children }: SortablePanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const meta = SECTION_META[id];

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/40 border-b border-border select-none">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 -ml-1 rounded"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <span className="text-muted-foreground">{meta?.icon}</span>
        <span className="font-semibold text-sm flex-1">{meta?.label}</span>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && <div className="p-5">{children}</div>}
    </div>
  );
}

const QBANK_LABELS: Record<string, string> = {
  mbbs: 'MBBS (Pakistan)', usmle_step1: 'USMLE Step 1', usmle_step2ck: 'USMLE Step 2 CK',
  usmle_step3: 'USMLE Step 3',
  amc_cat: 'AMC CAT', amc_clinical: 'AMC Clinical', fcps_part1: 'FCPS Part 1',
  fcps_part2: 'FCPS Part 2', mrcp_part1: 'MRCP Part 1', mrcp_part2: 'MRCP Part 2',
  plab1: 'PLAB 1', plab2: 'PLAB 2',
};

function CountTable({ title, data, labelMapper }: { title: string; data: Record<string, number>; labelMapper?: (k: string) => string }) {
  const [open, setOpen] = React.useState(false);
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{total.toLocaleString()} MCQs</span>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {entries.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors">
              <span className="text-sm text-foreground truncate">{labelMapper ? labelMapper(key) : key}</span>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((count / total) * 100)}%` }} />
                </div>
                <span className="text-xs font-bold text-muted-foreground w-12 text-right">{count.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsSection() {
  const { data, isLoading, refetch, isFetching } = useAdminGetStats();
  const counts = (data as any)?.mcqCounts as {
    byQBank: Record<string, number>;
    bySubject: Record<string, number>;
    bySystem: Record<string, number>;
    byTopic: Record<string, number>;
    bySubtopic: Record<string, number>;
  } | undefined;

  const metrics = data
    ? [
        { label: 'Total Questions', value: data.totalQuestions, color: 'text-primary' },
        { label: 'Total Users',     value: data.totalUsers,     color: 'text-blue-500' },
        { label: 'Answers Today',   value: data.answersToday,   color: 'text-green-500' },
        { label: 'Pending Flags',   value: data.pendingFlags,   color: 'text-amber-500' },
        { label: 'Pending Errata',  value: data.pendingErrata,  color: 'text-red-500' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-muted rounded-2xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {metrics.map(m => (
              <div key={m.label} className="bg-muted/50 border border-border rounded-2xl p-5 text-center">
                <div className={clsx('text-3xl font-extrabold', m.color)}>{m.value?.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">{m.label}</div>
              </div>
            ))}
          </div>
          {counts && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">MCQ Distribution</h3>
              <CountTable title="By Q Bank" data={counts.byQBank} labelMapper={k => QBANK_LABELS[k] ?? k} />
              <CountTable title="By Subject" data={counts.bySubject} />
              <CountTable title="By System" data={counts.bySystem} />
              <CountTable title="By Topic (top 50)" data={counts.byTopic} />
              <CountTable title="By Subtopic (top 50)" data={counts.bySubtopic} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface QuestionFormData {
  questionText: string;
  imageUrl: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctAnswer: string;
  explanation: string;
  explanationImageUrl: string;
  wrongAnswerExplanations: string;
  references: string;
  subject: string;
  system: string;
  topic: string;
  subtopic: string;
  universityTag: string;
  examType: string;
  qbankType: string;
  difficulty: string;
  tags: string;
  isFree: boolean;
}

const EMPTY_FORM: QuestionFormData = {
  questionText: '', imageUrl: '', optionA: '', optionB: '', optionC: '', optionD: '', optionE: '',
  correctAnswer: 'A', explanation: '', explanationImageUrl: '', wrongAnswerExplanations: '', references: '',
  subject: '', system: '', topic: '', subtopic: '', universityTag: '',
  examType: '', qbankType: '', difficulty: 'medium', tags: '', isFree: false,
};

function questionToForm(q: Question): QuestionFormData {
  const opts: QuestionOption = q.options;
  return {
    questionText: q.questionText,
    imageUrl: (q as any).imageUrl ?? '',
    optionA: opts.A, optionB: opts.B, optionC: opts.C,
    optionD: opts.D, optionE: opts.E ?? '',
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    explanationImageUrl: (q as any).explanationImageUrl ?? '',
    wrongAnswerExplanations: q.wrongAnswerExplanations ?? '',
    references: q.references ?? '',
    subject: q.subject, system: q.system ?? '', topic: q.topic,
    subtopic: q.subtopic ?? '', universityTag: q.universityTag ?? '',
    examType: q.examType ?? '', qbankType: (q as any).qbankType ?? '', difficulty: q.difficulty,
    tags: Array.isArray(q.tags) ? q.tags.join(', ') : '',
    isFree: Boolean((q as any).isFree),
  };
}

function formToPayload(f: QuestionFormData): CreateQuestionRequest & { imageUrl?: string; explanationImageUrl?: string } {
  const opts: QuestionOption = {
    A: f.optionA, B: f.optionB, C: f.optionC, D: f.optionD,
    ...(f.optionE.trim() ? { E: f.optionE } : {}),
  };

  const validDiffs = Object.values(CreateQuestionRequestDifficultyEnum);
  const difficulty = (validDiffs.includes(f.difficulty as CreateQuestionRequestDifficulty)
    ? f.difficulty
    : 'medium') as CreateQuestionRequestDifficulty;

  const validExamTypes = Object.values(CreateQuestionRequestExamTypeEnum);
  const examType = f.examType && validExamTypes.includes(f.examType as CreateQuestionRequestExamType)
    ? (f.examType as CreateQuestionRequestExamType)
    : undefined;

  return {
    questionText: f.questionText,
    imageUrl: f.imageUrl || undefined,
    options: opts,
    correctAnswer: f.correctAnswer,
    explanation: f.explanation,
    explanationImageUrl: f.explanationImageUrl || undefined,
    wrongAnswerExplanations: f.wrongAnswerExplanations || undefined,
    references: f.references || undefined,
    subject: f.subject,
    system: f.system || undefined,
    topic: f.topic,
    subtopic: f.subtopic || undefined,
    universityTag: f.universityTag || undefined,
    ...(examType ? { examType } : {}),
    difficulty,
    tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    ...(f.qbankType ? { qbankType: f.qbankType } : {}),
    isFree: f.isFree,
  } as CreateQuestionRequest & { imageUrl?: string; explanationImageUrl?: string; qbankType?: string; isFree?: boolean };
}

type ModalState = Question | 'new' | null;

interface QuestionModalProps {
  question: Question | undefined;
  onClose: () => void;
  onSaved: () => void;
}

function ImageUploadButton({ onUploaded, label = "Upload" }: { onUploaded: (url: string) => void; label?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const requestUrl = useRequestUploadUrl();
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await requestUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const r = await fetch(result.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!r.ok) throw new Error(`Storage upload failed (${r.status})`);
      const apiUrl = '/api/storage' + result.objectPath;
      onUploaded(apiUrl);
      toast({ title: 'Image uploaded' });
    } catch (e: unknown) {
      toast({ title: (e as Error)?.message ?? 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
      />
      <button
        type="button"
        disabled={uploading || requestUrl.isPending}
        onClick={() => fileRef.current?.click()}
        className="shrink-0 px-2.5 py-2 rounded-xl bg-muted border border-border text-xs font-semibold hover:bg-muted/80 disabled:opacity-50 flex items-center gap-1.5 transition-colors whitespace-nowrap"
        title="Upload image to storage"
      >
        <Image size={12} />
        {uploading ? 'Uploading…' : label}
      </button>
    </>
  );
}

function QuestionModal({ question, onClose, onSaved }: QuestionModalProps) {
  const { toast } = useToast();
  const createMut = useAdminCreateQuestion();
  const updateMut = useAdminUpdateQuestion();
  const [form, setForm] = useState<QuestionFormData>(question ? questionToForm(question) : EMPTY_FORM);
  const isEdit = !!question;

  const set = (field: keyof QuestionFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = formToPayload(form);
    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: question.id, data: payload });
        toast({ title: 'Question updated' });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: 'Question created' });
      }
      onSaved();
      onClose();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  const inputCls = 'w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'text-xs font-semibold text-muted-foreground mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Question' : 'New Question'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className={labelCls}>Question Text *</label>
              <textarea value={form.questionText} onChange={set('questionText')} rows={3} required className={inputCls} placeholder="Enter the question..." />
            </div>
            <div>
              <label className={labelCls}>Question Image (optional)</label>
              <div className="flex gap-2 items-center">
                <input value={form.imageUrl} onChange={set('imageUrl')} className={`${inputCls} flex-1`} placeholder="Paste URL or upload →" />
                <ImageUploadButton onUploaded={url => setForm(f => ({ ...f, imageUrl: url }))} />
                {form.imageUrl && (
                  <div className="relative group">
                    <img src={form.imageUrl} alt="Q img" className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A','B','C','D','E'] as const).map(opt => (
                <div key={opt}>
                  <label className={labelCls}>Option {opt} {opt !== 'E' ? '*' : '(optional)'}</label>
                  <input
                    value={String(form[`option${opt}` as keyof QuestionFormData] ?? '')}
                    onChange={set(`option${opt}` as keyof QuestionFormData)}
                    required={opt !== 'E'}
                    className={inputCls}
                    placeholder={`Option ${opt}...`}
                  />
                </div>
              ))}
              <div>
                <label className={labelCls}>Correct Answer *</label>
                <select value={form.correctAnswer} onChange={set('correctAnswer')} required className={inputCls}>
                  {['A','B','C','D','E'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Explanation *</label>
              <textarea value={form.explanation} onChange={set('explanation')} rows={3} required className={inputCls} placeholder="Correct answer explanation..." />
            </div>
            <div>
              <label className={labelCls}>Explanation Image (optional)</label>
              <div className="flex gap-2 items-center">
                <input value={form.explanationImageUrl} onChange={set('explanationImageUrl')} className={`${inputCls} flex-1`} placeholder="Paste URL or upload →" />
                <ImageUploadButton onUploaded={url => setForm(f => ({ ...f, explanationImageUrl: url }))} />
                {form.explanationImageUrl && (
                  <div className="relative group">
                    <img src={form.explanationImageUrl} alt="Explanation img" className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, explanationImageUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Wrong Answer Explanations</label>
              <textarea value={form.wrongAnswerExplanations} onChange={set('wrongAnswerExplanations')} rows={2} className={inputCls} placeholder="Why each wrong option is wrong..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Subject *</label>
                <input value={form.subject} onChange={set('subject')} required className={inputCls} placeholder="e.g. Anatomy" />
              </div>
              <div>
                <label className={labelCls}>Topic *</label>
                <input value={form.topic} onChange={set('topic')} required className={inputCls} placeholder="e.g. Upper Limb" />
              </div>
              <div>
                <label className={labelCls}>System</label>
                <input value={form.system} onChange={set('system')} className={inputCls} placeholder="e.g. Musculoskeletal" />
              </div>
              <div>
                <label className={labelCls}>Subtopic</label>
                <input value={form.subtopic} onChange={set('subtopic')} className={inputCls} placeholder="e.g. Brachial Plexus" />
              </div>
              <div>
                <label className={labelCls}>Difficulty *</label>
                <select value={form.difficulty} onChange={set('difficulty')} required className={inputCls}>
                  {Object.values(CreateQuestionRequestDifficultyEnum).map(d => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Exam Type</label>
                <select value={form.examType} onChange={set('examType')} className={inputCls}>
                  <option value="">None</option>
                  {Object.values(CreateQuestionRequestExamTypeEnum).map(et => (
                    <option key={et} value={et}>{et.charAt(0).toUpperCase() + et.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>University Tag</label>
                <input value={form.universityTag} onChange={set('universityTag')} className={inputCls} placeholder="e.g. UHS" />
              </div>
              <div>
                <label className={labelCls}>Q Bank</label>
                <select value={form.qbankType} onChange={set('qbankType')} className={inputCls}>
                  <option value="">None / Unassigned</option>
                  <option value="mbbs">MBBS (Pakistan)</option>
                  <option value="usmle_step1">USMLE Step 1</option>
                  <option value="usmle_step2ck">USMLE Step 2 CK</option>
                  <option value="usmle_step3">USMLE Step 3</option>

                  <option value="amc_cat">AMC CAT</option>
                  <option value="amc_clinical">AMC Clinical</option>
                  <option value="fcps_part1">FCPS Part 1</option>
                  <option value="fcps_part2">FCPS Part 2</option>
                  <option value="mrcp_part1">MRCP Part 1</option>
                  <option value="mrcp_part2">MRCP Part 2</option>
                  <option value="plab1">PLAB 1</option>
                  <option value="plab2">PLAB 2</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Tags (comma-separated)</label>
                <input value={form.tags} onChange={set('tags')} className={inputCls} placeholder="e.g. mcq, high-yield" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="isFree-check"
                  checked={form.isFree}
                  onChange={e => setForm(prev => ({ ...prev, isFree: e.target.checked }))}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <label htmlFor="isFree-check" className="text-sm font-medium text-foreground cursor-pointer select-none">
                  Free MCQ <span className="text-xs text-muted-foreground font-normal">(visible on dashboard without subscription)</span>
                </label>
              </div>
            </div>
            <div>
              <label className={labelCls}>References</label>
              <input value={form.references} onChange={set('references')} className={inputCls} placeholder="Textbook page, chapter..." />
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={14} /> {isPending ? 'Saving…' : isEdit ? 'Update Question' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ALL_SUBJECTS_LIST = [
  'Anatomy','Physiology','Biochemistry','Pathology','Pharmacology','Microbiology',
  'Forensic Medicine','Community Medicine','Medicine','Surgery','Gynecology & Obstetrics',
  'Pediatrics','ENT','Ophthalmology','Dermatology','Psychiatry','Radiology',
];

function QuestionsSection() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [diffFilter, setDiffFilter] = useState('');
  const [modalQ, setModalQ] = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMut = useAdminDeleteQuestion();
  const limit = 50;

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkEditField, setBulkEditField] = useState('');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [bulkEditPending, setBulkEditPending] = useState(false);

  // Duplicate detection
  const [dupeResults, setDupeResults] = useState<Array<{ questions: any[] }> | null>(null);
  const [dupeOpen, setDupeOpen] = useState(true);
  const [dupeLoading, setDupeLoading] = useState(false);
  const [dupeSelected, setDupeSelected] = useState<Set<number>>(new Set());
  const [dupeBulkPending, setDupeBulkPending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setOffset(0); }, [debouncedSearch, diffFilter]);

  const params = { limit, offset, search: debouncedSearch || undefined, difficulty: diffFilter || undefined };
  const { data, isLoading, refetch } = useAdminGetQuestions(params);

  const questions = data?.questions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const allPageSelected = questions.length > 0 && questions.every(q => selectedIds.has(q.id));
  const anySelected = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) questions.forEach(q => next.delete(q.id));
      else questions.forEach(q => next.add(q.id));
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: 'Question deleted' });
      setDeleteId(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      refetch();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected question${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeletePending(true);
    try {
      const r = await fetch('/api/admin/questions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: `Deleted ${selectedIds.size} questions` });
      setSelectedIds(new Set());
      refetch();
    } catch (e: any) {
      toast({ title: 'Bulk delete failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBulkDeletePending(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!bulkEditField || !bulkEditValue) return;
    setBulkEditPending(true);
    try {
      const r = await fetch('/api/admin/questions/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ ids: Array.from(selectedIds), field: bulkEditField, value: bulkEditValue }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: `Updated ${selectedIds.size} questions` });
      setBulkEditField('');
      setBulkEditValue('');
      refetch();
    } catch (e: any) {
      toast({ title: 'Bulk edit failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBulkEditPending(false);
    }
  };

  const handleCheckDupes = async () => {
    setDupeLoading(true);
    setDupeResults(null);
    setDupeSelected(new Set());
    try {
      const r = await fetch('/api/admin/questions/duplicates', {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setDupeResults(d.groups ?? []);
      setDupeOpen(true);
    } catch (e: any) {
      toast({ title: 'Duplicate check failed', description: e?.message, variant: 'destructive' });
    } finally {
      setDupeLoading(false);
    }
  };

  const toggleDupeSelect = (id: number) => {
    setDupeSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Select all copies (keep first in each group, select the rest)
  const selectAllDupeCopies = () => {
    if (!dupeResults) return;
    const ids = new Set<number>();
    for (const group of dupeResults) {
      group.questions.slice(1).forEach((q: any) => ids.add(q.id));
    }
    setDupeSelected(ids);
  };

  const handleDeleteDupeSelected = async () => {
    if (dupeSelected.size === 0) return;
    if (!window.confirm(`Delete ${dupeSelected.size} selected duplicate question${dupeSelected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDupeBulkPending(true);
    try {
      const r = await fetch('/api/admin/questions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ ids: Array.from(dupeSelected) }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: `Deleted ${dupeSelected.size} duplicate questions` });
      setDupeSelected(new Set());
      refetch();
      // Re-run duplicate check to refresh panel
      await handleCheckDupes();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    } finally {
      setDupeBulkPending(false);
    }
  };

  const handleDeleteAllDuplicates = async () => {
    if (!dupeResults || dupeResults.length === 0) return;
    const allCopyIds: number[] = [];
    for (const group of dupeResults) {
      group.questions.slice(1).forEach((q: any) => allCopyIds.push(q.id));
    }
    if (allCopyIds.length === 0) return;
    if (!window.confirm(`Delete all ${allCopyIds.length} duplicate copies (keeping 1 original per group)? This cannot be undone.`)) return;
    setDupeBulkPending(true);
    try {
      const r = await fetch('/api/admin/questions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ ids: allCopyIds }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: `Deleted ${allCopyIds.length} duplicate copies`, description: 'One original kept per group.' });
      setDupeSelected(new Set());
      refetch();
      await handleCheckDupes();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    } finally {
      setDupeBulkPending(false);
    }
  };

  const diffColor = (d: string) =>
    d === 'hard' ? 'bg-red-500/10 text-red-600' : d === 'easy' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600';

  return (
    <div className="space-y-4">
      {/* Search + filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by text, subject, topic…"
            className="w-full pl-8 pr-4 py-2 border border-border rounded-xl text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={diffFilter}
          onChange={e => setDiffFilter(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm bg-muted/50 focus:outline-none"
        >
          <option value="">All Difficulties</option>
          {Object.values(CreateQuestionRequestDifficultyEnum).map(d => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>
        <button
          onClick={handleCheckDupes}
          disabled={dupeLoading}
          className="flex items-center gap-1.5 border border-border px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <Copy size={14} /> {dupeLoading ? 'Checking…' : 'Check Duplicates'}
        </button>
        <button
          onClick={() => setModalQ('new')}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90"
        >
          <Plus size={14} /> New Question
        </button>
      </div>

      {/* Duplicate detection results panel */}
      {dupeResults !== null && (
        <div className="border border-amber-400/50 bg-amber-500/5 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
            <button
              onClick={() => setDupeOpen(o => !o)}
              className="flex items-center gap-2 text-sm font-semibold hover:text-amber-700 transition-colors"
            >
              <Layers2 size={15} className="text-amber-600" />
              {dupeResults.length === 0
                ? 'No duplicate groups found'
                : `${dupeResults.length} duplicate group${dupeResults.length !== 1 ? 's' : ''} found`}
              {dupeResults.length > 0 && (dupeOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
            </button>
            {dupeResults.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Selection helpers */}
                <button
                  onClick={selectAllDupeCopies}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-amber-400/60 text-amber-700 hover:bg-amber-500/10 transition-colors"
                >
                  Select all copies
                </button>
                {dupeSelected.size > 0 && (
                  <button
                    onClick={() => setDupeSelected(new Set())}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Deselect all
                  </button>
                )}
                {dupeSelected.size > 0 && (
                  <button
                    onClick={handleDeleteDupeSelected}
                    disabled={dupeBulkPending}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={10} /> Delete selected ({dupeSelected.size})
                  </button>
                )}
                <button
                  onClick={handleDeleteAllDuplicates}
                  disabled={dupeBulkPending}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={10} /> Delete all duplicates
                </button>
              </div>
            )}
          </div>

          {/* Group listing */}
          {dupeOpen && dupeResults.length > 0 && (
            <div className="divide-y divide-border border-t border-amber-400/30">
              {dupeResults.map((group, gi) => (
                <div key={gi} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Group {gi + 1} — {group.questions[0]?.subject}
                    </p>
                    <button
                      onClick={() => {
                        const copies = group.questions.slice(1).map((q: any) => q.id);
                        setDupeSelected(prev => {
                          const next = new Set(prev);
                          const allSelected = copies.every((id: number) => next.has(id));
                          if (allSelected) copies.forEach((id: number) => next.delete(id));
                          else copies.forEach((id: number) => next.add(id));
                          return next;
                        });
                      }}
                      className="text-[10px] text-amber-600 hover:underline"
                    >
                      {group.questions.slice(1).every((q: any) => dupeSelected.has(q.id)) ? 'Deselect copies' : 'Select copies'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.questions.map((q: any, qi: number) => {
                      const isFirst = qi === 0;
                      const isChecked = dupeSelected.has(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => !isFirst && toggleDupeSelect(q.id)}
                          className={clsx(
                            'bg-card border rounded-xl p-3 space-y-2 transition-colors',
                            isFirst
                              ? 'border-green-400/50 bg-green-500/5 cursor-default'
                              : isChecked
                                ? 'border-destructive/60 bg-destructive/5 cursor-pointer'
                                : 'border-border hover:border-amber-400/60 cursor-pointer',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {!isFirst && (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleDupeSelect(q.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="rounded accent-destructive"
                                />
                              )}
                              {isFirst && (
                                <span className="text-[9px] font-bold uppercase text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">Keep</span>
                              )}
                              <span className="font-mono text-[10px] text-muted-foreground">#{q.id}</span>
                            </div>
                            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', diffColor(q.difficulty))}>{q.difficulty}</span>
                          </div>
                          <p className="text-xs leading-relaxed line-clamp-3">{q.questionText}</p>
                          {!isFirst && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(q.id); }}
                              disabled={deleteMut.isPending || dupeBulkPending}
                              className="flex items-center gap-1 text-[11px] text-destructive hover:underline disabled:opacity-50"
                            >
                              <Trash2 size={11} /> Delete this one
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {anySelected && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
          <div className="flex-1" />
          {/* Bulk edit controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={bulkEditField}
              onChange={e => { setBulkEditField(e.target.value); setBulkEditValue(''); }}
              className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
            >
              <option value="">Edit field…</option>
              <option value="difficulty">Set difficulty</option>
              <option value="subject">Set subject</option>
            </select>
            {bulkEditField === 'difficulty' && (
              <select
                value={bulkEditValue}
                onChange={e => setBulkEditValue(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
              >
                <option value="">Pick difficulty…</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            )}
            {bulkEditField === 'subject' && (
              <select
                value={bulkEditValue}
                onChange={e => setBulkEditValue(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none"
              >
                <option value="">Pick subject…</option>
                {ALL_SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {bulkEditField && bulkEditValue && (
              <button
                onClick={handleBulkEdit}
                disabled={bulkEditPending}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
              >
                <SlidersHorizontal size={12} /> {bulkEditPending ? 'Applying…' : 'Apply'}
              </button>
            )}
          </div>
          {/* Bulk delete */}
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeletePending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-white rounded-lg text-xs font-bold hover:bg-destructive/90 disabled:opacity-50"
          >
            <Trash2 size={12} /> {bulkDeletePending ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Questions table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-3 py-3 text-center w-8">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-border accent-primary cursor-pointer"
                  title="Select all on this page"
                />
              </th>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Subject / Topic</th>
              <th className="px-4 py-3 text-left">Question</th>
              <th className="px-4 py-3 text-left">Diff</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">Loading…</td></tr>
            ) : questions.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No questions found.</td></tr>
            ) : questions.map(q => (
              <React.Fragment key={q.id}>
                <tr className={clsx('hover:bg-muted/30 transition-colors', selectedIds.has(q.id) && 'bg-primary/5')}>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="rounded border-border accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{q.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-xs">{q.subject}</div>
                    <div className="text-xs text-muted-foreground">{q.topic}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-xs">{q.questionText}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', diffColor(q.difficulty))}>{q.difficulty}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModalQ(q)} className="text-muted-foreground hover:text-primary p-1 rounded transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(deleteId === q.id ? null : q.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {deleteId === q.id && (
                  <tr className="bg-destructive/5">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-destructive font-semibold flex-1">Delete Q#{q.id}? This cannot be undone.</span>
                        <button onClick={() => setDeleteId(null)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deleteMut.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                        >
                          {deleteMut.isPending ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Page {currentPage} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-40"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {modalQ !== null && (
        <QuestionModal
          question={modalQ === 'new' ? undefined : modalQ}
          onClose={() => setModalQ(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}

const ROLE_OPTIONS_LIST = [
  { value: 'user', label: 'Student' },
  { value: 'editor', label: 'Editor' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'reviewer', label: 'MCQ Reviewer' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
];

const EXCEL_COLUMNS = [
  'questionText','imageUrl','optionA','optionB','optionC','optionD','optionE',
  'correctAnswer','explanation','explanationImageUrl','wrongAnswerExplanations',
  'references','subject','system','topic','subtopic','universityTag','examType',
  'qbankType','difficulty','tags','isFree',
];

function BulkUploadSection() {
  const { toast } = useToast();
  const bulkMut = useAdminBulkUpload();
  const [questions, setQuestions] = useState<unknown[]>([]);
  const [jsonInput, setJsonInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<{ count: number; mode: 'excel' | 'json' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseExcelFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const VALID_DIFFICULTY = ['easy', 'medium', 'hard'] as const;
        const VALID_EXAM_TYPE = Object.values(CreateQuestionRequestExamTypeEnum);

        const parsed = rows.map(row => {
          const q: Record<string, unknown> = {};
          EXCEL_COLUMNS.forEach(col => {
            const val = row[col];
            if (val !== undefined && val !== '') q[col] = val;
          });

          // Build options object from optionA-E columns
          if (q.optionA || q.optionB || q.optionC || q.optionD) {
            q.options = {
              A: String(q.optionA ?? ''),
              B: String(q.optionB ?? ''),
              C: String(q.optionC ?? ''),
              D: String(q.optionD ?? ''),
              ...(q.optionE ? { E: String(q.optionE) } : {}),
            };
            delete q.optionA; delete q.optionB; delete q.optionC; delete q.optionD; delete q.optionE;
          }

          // Normalize difficulty to lowercase enum value
          if (q.difficulty) {
            const dl = String(q.difficulty).toLowerCase().trim();
            q.difficulty = VALID_DIFFICULTY.includes(dl as typeof VALID_DIFFICULTY[number]) ? dl : 'medium';
          } else {
            q.difficulty = 'medium';
          }

          // Normalize examType — strip if not a valid enum value
          if (q.examType) {
            const et = String(q.examType).toLowerCase().trim();
            if (VALID_EXAM_TYPE.includes(et as typeof VALID_EXAM_TYPE[number])) {
              q.examType = et;
            } else {
              delete q.examType;
            }
          }

          // Ensure required string fields have fallbacks
          if (!q.subject) q.subject = 'General';
          if (!q.topic) q.topic = 'General';

          // Parse comma-separated tags string into array
          if (typeof q.tags === 'string' && q.tags) {
            q.tags = q.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          } else if (!Array.isArray(q.tags)) {
            delete q.tags;
          }

          // Normalize isFree to boolean
          if (q.isFree !== undefined) {
            const raw = String(q.isFree).toLowerCase().trim();
            q.isFree = raw === 'true' || raw === '1' || raw === 'yes';
          } else {
            q.isFree = false;
          }

          return q;
        });

        // Filter rows that are obviously incomplete (missing question text or options)
        const valid = parsed.filter(q => {
          const qq = q as Record<string, unknown>;
          return qq.questionText && qq.options && qq.correctAnswer && qq.explanation;
        });
        const skipped = parsed.length - valid.length;

        setQuestions(valid);
        setPreview({ count: valid.length, mode: 'excel' });
        toast({
          title: `Excel parsed: ${valid.length} questions ready`,
          description: skipped > 0 ? `${skipped} rows skipped (missing required fields)` : undefined,
        });
      } catch {
        toast({ title: 'Failed to parse Excel file', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleFileSelect = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      parseExcelFile(file);
    } else if (name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? '';
        setJsonInput(text);
        try {
          const parsed: unknown = JSON.parse(text);
          const qs = Array.isArray(parsed) ? parsed : [parsed];
          setQuestions(qs);
          setPreview({ count: qs.length, mode: 'json' });
        } catch {
          setPreview(null);
        }
      };
      reader.readAsText(file);
    } else {
      toast({ title: 'Only .xlsx, .xls or .json files accepted', variant: 'destructive' });
    }
  }, [parseExcelFile, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleJsonChange = (text: string) => {
    setJsonInput(text);
    setPreview(null);
    setQuestions([]);
    try {
      const parsed: unknown = JSON.parse(text);
      const qs = Array.isArray(parsed) ? parsed : [parsed];
      setQuestions(qs);
      setPreview({ count: qs.length, mode: 'json' });
    } catch { /* invalid json */ }
  };

  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleRows = [
      {
        questionText: 'A 25-year-old patient presents with fatigue and pallor. Blood smear shows hypochromic microcytic red cells. Which of the following is the most likely diagnosis?',
        imageUrl: '',
        optionA: 'Iron deficiency anaemia',
        optionB: 'Vitamin B12 deficiency',
        optionC: 'Folate deficiency',
        optionD: 'Thalassaemia major',
        optionE: '',
        correctAnswer: 'A',
        explanation: 'Iron deficiency anaemia is the most common cause of microcytic hypochromic anaemia worldwide. Low serum ferritin confirms the diagnosis.',
        explanationImageUrl: '',
        wrongAnswerExplanations: 'B12 and folate deficiency cause megaloblastic (macrocytic) anaemia. Thalassaemia also causes microcytic anaemia but differs in ferritin levels.',
        references: 'Robbins Basic Pathology, 10th ed., Chapter 13',
        subject: 'Pathology',
        system: 'Haematology',
        topic: 'Anaemia',
        subtopic: 'Iron Deficiency',
        universityTag: 'CPSP',
        examType: 'annual',
        difficulty: 'easy',
        tags: 'haematology,anaemia,iron',
      },
      {
        questionText: 'Which enzyme is deficient in Phenylketonuria (PKU)?',
        imageUrl: '',
        optionA: 'Phenylalanine hydroxylase',
        optionB: 'Tyrosinase',
        optionC: 'Homogentisate oxidase',
        optionD: 'Fumarylacetoacetase',
        optionE: '',
        correctAnswer: 'A',
        explanation: 'PKU is caused by deficiency of phenylalanine hydroxylase, leading to accumulation of phenylalanine and its toxic metabolites causing intellectual disability.',
        explanationImageUrl: '',
        wrongAnswerExplanations: 'Tyrosinase deficiency causes albinism. Homogentisate oxidase deficiency causes alkaptonuria. Fumarylacetoacetase deficiency causes tyrosinaemia type I.',
        references: 'Harper\'s Illustrated Biochemistry, 31st ed., Chapter 29',
        subject: 'Biochemistry',
        system: 'Metabolism',
        topic: 'Amino Acid Disorders',
        subtopic: 'Phenylalanine Metabolism',
        universityTag: '',
        examType: 'modular',
        difficulty: 'medium',
        tags: 'biochemistry,PKU,inborn errors',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: EXCEL_COLUMNS });

    // Style the header row (bold, background) - limited in xlsx, but set column widths
    ws['!cols'] = EXCEL_COLUMNS.map(col => ({
      wch: col === 'questionText' || col === 'explanation' ? 60 : col.startsWith('option') ? 30 : 20,
    }));

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'medicology_questions_template.xlsx');
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medicology_questions_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleUpload = async () => {
    const qs = questions.length > 0 ? questions : (() => {
      try { const p: unknown = JSON.parse(jsonInput); return Array.isArray(p) ? p : [p]; } catch { return []; }
    })();
    if (qs.length === 0) {
      toast({ title: 'No questions to upload', variant: 'destructive' });
      return;
    }
    try {
      const res = await bulkMut.mutateAsync({ data: { questions: qs } });
      const dupNote = (res as any).skippedDuplicates > 0 ? ` | Duplicates skipped: ${(res as any).skippedDuplicates}` : '';
      toast({ title: 'Bulk upload done', description: `Inserted: ${res.inserted} | Failed: ${res.failed}${dupNote}` });
      setJsonInput('');
      setQuestions([]);
      setPreview(null);
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err?.message ?? JSON.stringify(err) ?? 'Check backend logs',
        variant: 'destructive',
      });
    }
  };

  const hasData = questions.length > 0 || jsonInput.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-1">Download a pre-filled template, then replace the sample rows with your questions and upload.</p>
            <p className="font-mono break-all opacity-75">{EXCEL_COLUMNS.join(' · ')}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => downloadTemplate('xlsx')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-medium transition-colors"
            >
              <Download size={13} /> XLSX
            </button>
            <button
              onClick={() => downloadTemplate('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-medium transition-colors"
            >
              <Download size={13} /> CSV
            </button>
          </div>
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
          isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/40'
        )}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
        <FileUp size={24} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-semibold">Drop an <code className="bg-muted px-1 py-0.5 rounded text-xs">.xlsx</code> or <code className="bg-muted px-1 py-0.5 rounded text-xs">.json</code> file here</p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
      </div>

      {preview && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <CheckCircle size={14} className="text-green-600" />
          <span className="text-xs font-semibold text-green-800 dark:text-green-300">
            {preview.count} questions parsed from {preview.mode.toUpperCase()} — ready to upload
          </span>
          <button onClick={() => { setPreview(null); setQuestions([]); setJsonInput(''); }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Or paste JSON directly:</p>
        <textarea
          value={jsonInput}
          onChange={e => handleJsonChange(e.target.value)}
          rows={8}
          className="w-full p-4 border border-border rounded-xl font-mono text-xs bg-muted/50 focus:ring-2 focus:ring-primary/20 outline-none resize-y"
          placeholder={`[
  {
    "questionText": "What is the powerhouse of the cell?",
    "options": { "A": "Nucleus", "B": "Mitochondria", "C": "Ribosome", "D": "Golgi" },
    "correctAnswer": "B",
    "explanation": "Mitochondria produce ATP via oxidative phosphorylation.",
    "subject": "Biochemistry",
    "topic": "Cell Biology",
    "difficulty": "easy"
  }
]`}
        />
      </div>
      <button
        onClick={handleUpload}
        disabled={bulkMut.isPending || !hasData}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Upload size={16} /> {bulkMut.isPending ? 'Uploading…' : `Import ${preview ? `${preview.count} Questions` : 'Questions'}`}
      </button>
    </div>
  );
}

const EMPTY_MEMBER = { name: '', email: '', password: '', college: '', year: '1', role: 'user' as string };

function UsersSection() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState(EMPTY_MEMBER);
  const deleteMut = useAdminDeleteUser();
  const createMut = useAdminCreateUser();
  const resetMut = useAdminResetUserPassword();
  const limit = 50;

  const inputCls = 'w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setOffset(0); }, [debouncedSearch]);

  const { data, isLoading, refetch } = useAdminGetUsers({
    search: debouncedSearch || undefined,
    limit,
    offset,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handleDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: 'User deleted' });
      setDeleteId(null);
      refetch();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      await resetMut.mutateAsync({ id, data: { newPassword } });
      toast({ title: 'Password reset successfully' });
      setResetId(null);
      setNewPassword('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast({ title: msg, variant: 'destructive' });
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMut.mutateAsync({
        data: {
          name: newMember.name,
          email: newMember.email,
          password: newMember.password,
          college: newMember.college,
          year: Number(newMember.year),
          role: newMember.role as any,
        },
      });
      toast({ title: 'Member created successfully' });
      setNewMember(EMPTY_MEMBER);
      setShowAddForm(false);
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create member';
      toast({ title: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-8 pr-4 py-2 border border-border rounded-xl text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{total} user{total !== 1 ? 's' : ''}</span>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs px-3 py-2 rounded-xl font-bold hover:bg-primary/90 shrink-0">
          <UserPlus size={12} /> Add Member
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateMember} className="border border-border rounded-2xl bg-muted/20 p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><UserPlus size={14} /> Create New Member</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name *</label>
              <input value={newMember.name} onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))} required className={inputCls} placeholder="Dr. Ahmed Khan" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email *</label>
              <input type="email" value={newMember.email} onChange={e => setNewMember(m => ({ ...m, email: e.target.value }))} required className={inputCls} placeholder="ahmed@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Password *</label>
              <input type="password" value={newMember.password} onChange={e => setNewMember(m => ({ ...m, password: e.target.value }))} required minLength={6} className={inputCls} placeholder="Min 6 chars" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">College/Institution *</label>
              <input value={newMember.college} onChange={e => setNewMember(m => ({ ...m, college: e.target.value }))} required className={inputCls} placeholder="King Edward Medical University" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Year of Study *</label>
              <select value={newMember.year} onChange={e => setNewMember(m => ({ ...m, year: e.target.value }))} className={inputCls}>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Role</label>
              <select value={newMember.role} onChange={e => setNewMember(m => ({ ...m, role: e.target.value }))} className={inputCls}>
                {ROLE_OPTIONS_LIST.filter(r => isSuperAdmin || r.value !== 'superadmin').map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowAddForm(false); setNewMember(EMPTY_MEMBER); }}
              className="flex-1 py-2 text-sm rounded-xl border border-border hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 py-2 text-sm rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50">
              {createMut.isPending ? 'Creating…' : 'Create Member'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">College</th>
              <th className="px-4 py-3 text-left">Year</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
            ) : users.map((u: AdminUser) => (
              <React.Fragment key={u.id}>
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-xs">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="text-xs text-amber-500 font-bold">{u.rewardPoints} pts</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.college ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.year != null ? `Year ${u.year}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      (u as any).role === 'superadmin' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      u.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {(u as any).role ?? (u.isAdmin ? 'admin' : 'user')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {isSuperAdmin && (
                        <button
                          onClick={() => { setResetId(resetId === u.id ? null : u.id); setNewPassword(''); }}
                          className="text-muted-foreground hover:text-primary p-1.5 rounded-lg transition-colors"
                          title="Reset password"
                        >
                          <Lock size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteId(deleteId === u.id ? null : u.id)}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {resetId === u.id && (
                  <tr className="bg-blue-50 dark:bg-blue-900/10">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Lock size={14} className="text-blue-600 shrink-0" />
                        <span className="text-xs font-semibold shrink-0">New password for {u.name}:</span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs bg-background"
                        />
                        <button onClick={() => setResetId(null)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          disabled={resetMut.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {resetMut.isPending ? 'Resetting…' : 'Reset'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {deleteId === u.id && (
                  <tr className="bg-destructive/5">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-destructive font-semibold flex-1">Delete {u.name}? All their data will be removed.</span>
                        <button onClick={() => setDeleteId(null)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={deleteMut.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                        >
                          {deleteMut.isPending ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Page {currentPage} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-40"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlagsSection() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useAdminGetFlags();
  const deleteMut = useAdminDeleteFlag();
  const [flaggedQ, setFlaggedQ] = useState<{ id: number; text: string } | null>(null);

  const dismiss = async (id: number) => {
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: 'Flag dismissed' });
      refetch();
    } catch {
      toast({ title: 'Failed to dismiss', variant: 'destructive' });
    }
  };

  const flags = data?.flags ?? [];

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">{data?.total ?? 0} active flag{(data?.total ?? 0) !== 1 ? 's' : ''}</div>
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse">Loading…</div>
      ) : flags.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No question flags.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left">Flagged By</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flags.map((f: AdminFlag) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setFlaggedQ(flaggedQ?.id === f.questionId ? null : { id: f.questionId, text: f.questionText ?? '' })}
                      className="text-left group"
                      title="Click to preview question"
                    >
                      <div className="flex items-center gap-1 text-xs font-mono text-primary hover:underline mb-0.5">
                        Q#{f.questionId} <BookOpen size={10} />
                      </div>
                      <p className="text-xs truncate max-w-xs text-muted-foreground group-hover:text-foreground">{f.questionText ?? '—'}</p>
                    </button>
                    {flaggedQ?.id === f.questionId && (
                      <div className="mt-2 p-3 bg-muted rounded-xl text-xs border border-border">
                        <p className="font-medium text-foreground">{f.questionText}</p>
                        <p className="text-muted-foreground mt-1">Question ID: {f.questionId}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.userName ?? `User #${f.userId}`}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => dismiss(f.id)}
                      disabled={deleteMut.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/30',
};

interface Erratum {
  id: number;
  questionId: number;
  userId: number;
  errorType: string;
  description: string;
  correction?: string;
  referenceUrl?: string;
  status: string;
  adminNotes?: string;
  rewardPoints: number;
  createdAt: string;
}

interface ErrataApiResponse {
  errata: Erratum[];
}

function ErrataSection() {
  const { toast } = useToast();
  const [errata, setErrata] = useState<Erratum[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [adminNotes, setAdminNotes] = useState('');
  const [rewardPts, setRewardPts] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const fetchErrata = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/errata/admin', { headers: { Authorization: `Bearer ${TOKEN()}` } });
      const d = await res.json() as ErrataApiResponse;
      setErrata(d.errata ?? []);
    } catch {
      toast({ title: 'Failed to load errata', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { void fetchErrata(); }, []);

  const counts = {
    pending:  errata.filter(e => e.status === 'pending').length,
    approved: errata.filter(e => e.status === 'approved').length,
    rejected: errata.filter(e => e.status === 'rejected').length,
  };
  const filtered = errata.filter(e => filter === 'all' || e.status === filter);

  const openReview = (e: Erratum) => {
    setReviewId(e.id);
    setReviewStatus('approved');
    setAdminNotes('');
    setRewardPts(10);
  };

  const submitReview = async () => {
    if (!reviewId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/errata/admin/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ status: reviewStatus, adminNotes, rewardPoints: rewardPts }),
      });
      if (res.ok) {
        toast({
          title: `Report ${reviewStatus}`,
          description: reviewStatus === 'approved' ? `${rewardPts} pts awarded.` : 'Report rejected.',
        });
        setReviewId(null);
        void fetchErrata();
      } else {
        const d = await res.json() as { error?: string };
        toast({ title: 'Review failed', description: d.error ?? 'Try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(['pending','approved','rejected'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={clsx('rounded-xl p-3 text-left border-2 transition-all', filter === s ? `${STATUS_STYLES[s]} border-current` : 'bg-muted/50 border-border')}>
            <div className="text-xl font-extrabold">{counts[s]}</div>
            <div className="text-[10px] font-semibold capitalize text-muted-foreground">{s}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['all','pending','approved','rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border')}>
            {f} {f !== 'all' && `(${counts[f]})`}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No {filter} reports.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="bg-muted/30 border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs">Q#{e.questionId}</span>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', STATUS_STYLES[e.status])}>{e.status}</span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{e.errorType}</span>
                    {e.rewardPoints > 0 && <span className="text-[10px] font-bold text-amber-500"><Gift size={10} className="inline" /> {e.rewardPoints}pts</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{e.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(e.createdAt).toLocaleDateString()}</span>
                {expanded === e.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
              {expanded === e.id && (
                <div className="border-t border-border px-4 py-3 space-y-3 bg-card">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs font-semibold text-muted-foreground mb-1">Description</p><p className="text-xs">{e.description}</p></div>
                    {e.correction && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Correction</p><p className="text-xs">{e.correction}</p></div>}
                    {e.referenceUrl && <div className="col-span-full"><a href={e.referenceUrl} target="_blank" rel="noreferrer" className="text-primary text-xs underline">{e.referenceUrl}</a></div>}
                  </div>
                  {e.status === 'pending' && (
                    <div className="border-t border-border pt-3">
                      {reviewId === e.id ? (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <button onClick={() => setReviewStatus('approved')} className={clsx('flex-1 py-2 rounded-lg text-xs font-bold border', reviewStatus === 'approved' ? 'bg-green-500/10 border-green-500/40 text-green-600' : 'bg-muted border-border text-muted-foreground')}>
                              <CheckCircle size={12} className="inline mr-1" />Approve
                            </button>
                            <button onClick={() => setReviewStatus('rejected')} className={clsx('flex-1 py-2 rounded-lg text-xs font-bold border', reviewStatus === 'rejected' ? 'bg-red-500/10 border-red-500/40 text-red-600' : 'bg-muted border-border text-muted-foreground')}>
                              <XCircle size={12} className="inline mr-1" />Reject
                            </button>
                          </div>
                          {reviewStatus === 'approved' && (
                            <div className="flex items-center gap-3">
                              <label className="text-xs font-semibold text-muted-foreground">Points</label>
                              <input type="number" min={0} max={100} value={rewardPts} onChange={e => setRewardPts(Number(e.target.value))} className="w-20 bg-muted border border-border rounded-lg px-2 py-1 text-xs font-bold text-center focus:outline-none" />
                            </div>
                          )}
                          <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Admin notes…" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none" />
                          <div className="flex gap-2">
                            <button onClick={() => setReviewId(null)} className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted">Cancel</button>
                            <button onClick={() => void submitReview()} disabled={submitting} className={clsx('flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50', reviewStatus === 'approved' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}>
                              {submitting ? 'Saving…' : `Confirm ${reviewStatus}`}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openReview(e)} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90">
                          Review Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ROLE_OPTIONS = ROLE_OPTIONS_LIST;

const PERMISSION_KEYS = [
  { key: 'canAddQuestions', label: 'Add Questions' },
  { key: 'canEditQuestions', label: 'Edit Questions' },
  { key: 'canDeleteQuestions', label: 'Delete Questions' },
  { key: 'canBulkUpload', label: 'Bulk Upload' },
  { key: 'canViewUsers', label: 'View Users' },
  { key: 'canManageUsers', label: 'Manage Users' },
  { key: 'canManageAnnouncements', label: 'Manage Announcements' },
  { key: 'canViewFlags', label: 'View Flags' },
  { key: 'canManageFlags', label: 'Manage Flags' },
  { key: 'canViewStats', label: 'View Stats' },
] as const;

function RolesSection() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editingPerms, setEditingPerms] = useState<number | null>(null);
  const [permState, setPermState] = useState<Record<string, boolean>>({});
  const updateMut = useAdminUpdateUser();
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setOffset(0); }, [debouncedSearch]);

  const { data, refetch } = useAdminGetUsers({ search: debouncedSearch || undefined, limit, offset });
  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-8 space-y-2">
        <Shield size={32} className="mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Only SuperAdmin can manage roles and permissions.</p>
      </div>
    );
  }

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await updateMut.mutateAsync({ id: userId, data: { role: role as any } });
      toast({ title: 'Role updated' });
      refetch();
    } catch (e: any) {
      toast({ title: e?.message ?? 'Failed', variant: 'destructive' });
    }
  };

  const openPerms = (u: AdminUser) => {
    setEditingPerms(u.id);
    setPermState((u.customPermissions as Record<string, boolean>) ?? {});
  };

  const savePerms = async (userId: number) => {
    try {
      await updateMut.mutateAsync({ id: userId, data: { customPermissions: permState } });
      toast({ title: 'Permissions saved' });
      setEditingPerms(null);
      refetch();
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
        <Shield size={14} className="text-yellow-600" />
        <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">SuperAdmin view — manage user roles and custom permissions</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
          className="w-full pl-8 pr-4 py-2 border border-border rounded-xl text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Current Role</th>
              <th className="px-4 py-3 text-left">Change Role</th>
              <th className="px-4 py-3 text-right">Permissions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u: AdminUser) => (
              <React.Fragment key={u.id}>
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">{u.name}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {(u as any).role ?? 'user'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={(u as any).role ?? 'user'}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
                    >
                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => editingPerms === u.id ? setEditingPerms(null) : openPerms(u)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                      {editingPerms === u.id ? 'Cancel' : 'Set Permissions'}
                    </button>
                  </td>
                </tr>
                {editingPerms === u.id && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 bg-muted/20">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Custom Permissions for {u.name} (overrides role defaults for non-admin):</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {PERMISSION_KEYS.map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={permState[key] ?? false}
                                onChange={e => setPermState(p => ({ ...p, [key]: e.target.checked }))}
                                className="rounded"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <button onClick={() => savePerms(u.id)} disabled={updateMut.isPending}
                          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 mt-2">
                          <Save size={12} /> Save Permissions
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {Math.ceil(total / limit) > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)} ({total} total)</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-40">
              <ChevronLeft size={12} /> Prev
            </button>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-40">
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ANN_TYPES = [
  { value: 'popup', label: 'Popup (modal dialog)' },
  { value: 'banner', label: 'Banner (top bar)' },
  { value: 'ticker', label: 'Ticker (bottom scroll)' },
] as const;

function AnnouncementsSection() {
  const { toast } = useToast();
  const { data, refetch } = useAdminGetAnnouncements();
  const createMut = useAdminCreateAnnouncement();
  const updateMut = useAdminUpdateAnnouncement();
  const deleteMut = useAdminDeleteAnnouncement();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    type: 'banner' as 'popup' | 'banner' | 'ticker',
    title: '',
    content: '',
    buttonText: '',
    buttonUrl: '',
    targetRoles: 'all',
    isActive: false,
    expiresAt: '',
  });

  const resetForm = () => {
    setForm({ type: 'banner', title: '', content: '', buttonText: '', buttonUrl: '', targetRoles: 'all', isActive: false, expiresAt: '' });
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      type: a.type as any,
      title: a.title,
      content: a.content,
      buttonText: a.buttonText ?? '',
      buttonUrl: a.buttonUrl ?? '',
      targetRoles: a.targetRoles ?? 'all',
      isActive: a.isActive,
      expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      buttonText: form.buttonText || undefined,
      buttonUrl: form.buttonUrl || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    };
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, data: payload });
        toast({ title: 'Announcement updated' });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: 'Announcement created' });
      }
      resetForm();
      refetch();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleToggle = async (a: Announcement) => {
    try {
      await updateMut.mutateAsync({ id: a.id, data: { isActive: !a.isActive } as any });
      toast({ title: a.isActive ? 'Deactivated' : 'Activated' });
      refetch();
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: 'Deleted' });
      refetch();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const announcements = data?.announcements ?? [];
  const inputCls = 'w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'text-xs font-semibold text-muted-foreground mb-1 block';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{announcements.length} announcements</span>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs px-4 py-2 rounded-xl font-bold hover:bg-primary/90">
          <Plus size={13} /> New Announcement
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-2xl bg-muted/20 p-4 space-y-3">
          <h3 className="font-semibold text-sm">{editId ? 'Edit Announcement' : 'Create Announcement'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className={inputCls}>
                  {ANN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Target Audience</label>
                <select value={form.targetRoles} onChange={e => setForm(f => ({ ...f, targetRoles: e.target.value }))} className={inputCls}>
                  <option value="all">All Users</option>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Title *</label>
              <input name="title" id="ann-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className={inputCls} placeholder="Important notice…" />
            </div>
            <div>
              <label className={labelCls}>Content *</label>
              <textarea name="content" id="ann-content" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={3} className={inputCls} placeholder="Announcement details…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Button Text (optional)</label>
                <input value={form.buttonText} onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))} className={inputCls} placeholder="Learn More" />
              </div>
              <div>
                <label className={labelCls}>Button URL (optional)</label>
                <input type="url" value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))} className={inputCls} placeholder="https://…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={labelCls}>Expires At (optional)</label>
                <input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <span>Publish immediately</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm} className="flex-1 py-2 text-sm rounded-xl border border-border hover:bg-muted">Cancel</button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="flex-1 py-2 text-sm rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50">
                {editId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No announcements yet.</div>
      ) : (
        <div className="space-y-2">
          {announcements.map((a: Announcement) => (
            <div key={a.id} className={clsx(
              'flex items-start gap-3 p-4 rounded-xl border transition-colors',
              a.isActive ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : 'border-border bg-muted/10'
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold capitalize">{a.type}</span>
                  <span className={clsx('text-xs font-semibold', a.isActive ? 'text-green-600' : 'text-muted-foreground')}>
                    {a.isActive ? '● Active' : '○ Inactive'}
                  </span>
                  {a.expiresAt && <span className="text-xs text-muted-foreground">Expires: {new Date(a.expiresAt).toLocaleDateString()}</span>}
                </div>
                <p className="font-semibold text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(a)} title={a.isActive ? 'Deactivate' : 'Activate'}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  {a.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Notes Section ─────────────────────────────────────────────────────────── */

const NOTE_SUBJECTS = [
  'Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology',
  'Microbiology', 'Forensic Medicine', 'Community Medicine', 'Medicine',
  'Surgery', 'Gynecology & Obstetrics', 'Pediatrics', 'ENT',
  'Ophthalmology', 'Dermatology', 'Psychiatry', 'Radiology',
];

interface AdminNote {
  id: number;
  title: string;
  subject: string;
  content: string;
  tags: string;
  isActive: boolean;
  createdAt: string;
}

function NotesSection() {
  const { toast } = useToast();

  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subject: NOTE_SUBJECTS[0],
    content: '',
    tags: '',
    isActive: true,
  });

  const inputCls = 'w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'text-xs font-semibold text-muted-foreground mb-1 block';

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      // TODO: implement on backend
      const res = await fetch('/api/admin/notes', {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  const resetForm = () => {
    setForm({ title: '', subject: NOTE_SUBJECTS[0], content: '', tags: '', isActive: true });
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (note: AdminNote) => {
    setEditId(note.id);
    setForm({
      title: note.title,
      subject: note.subject,
      content: note.content,
      tags: note.tags,
      isActive: note.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (editId) {
        // TODO: implement on backend
        const res = await fetch(`/api/admin/notes/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast({ title: 'Note updated' });
      } else {
        // TODO: implement on backend
        const res = await fetch('/api/admin/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast({ title: 'Note created' });
      }
      resetForm();
      fetchNotes();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this note permanently?')) return;
    try {
      // TODO: implement on backend
      const res = await fetch(`/api/admin/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Note deleted' });
      fetchNotes();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (note: AdminNote) => {
    try {
      // TODO: implement on backend
      const res = await fetch(`/api/admin/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN()}` },
        body: JSON.stringify({ ...note, isActive: !note.isActive }),
      });
      if (!res.ok) throw new Error();
      toast({ title: note.isActive ? 'Note hidden' : 'Note published' });
      fetchNotes();
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading ? '…' : `${notes.length} note${notes.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs px-4 py-2 rounded-xl font-bold hover:bg-primary/90"
        >
          <Plus size={13} /> New Note
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-2xl bg-muted/20 p-4 space-y-3">
          <h3 className="font-semibold text-sm">{editId ? 'Edit Note' : 'Create Note'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className={inputCls}
                  placeholder="Brachial Plexus — Complete Guide"
                />
              </div>
              <div>
                <label className={labelCls}>Subject *</label>
                <select
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className={inputCls}
                >
                  {NOTE_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Content * (markdown supported)</label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                required
                rows={10}
                className={inputCls + ' font-mono text-xs resize-y'}
                placeholder="# Heading&#10;&#10;Write your note content here. Markdown formatting is supported."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className={labelCls}>Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className={inputCls}
                  placeholder="high-yield, anatomy, upper limb"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="rounded"
                />
                <span>Publish (visible to students)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm} className="flex-1 py-2 text-sm rounded-xl border border-border hover:bg-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-sm rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No notes yet. Click "New Note" to create one.</div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const tagList = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
            return (
              <div
                key={note.id}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                  note.isActive ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : 'border-border bg-muted/10'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{note.subject}</span>
                    <span className={clsx('text-xs font-semibold', note.isActive ? 'text-green-600' : 'text-muted-foreground')}>
                      {note.isActive ? '● Published' : '○ Hidden'}
                    </span>
                  </div>
                  <p className="font-semibold text-sm">{note.title}</p>
                  {tagList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tagList.slice(0, 5).map(tag => (
                        <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                      {tagList.length > 5 && <span className="text-[10px] text-muted-foreground">+{tagList.length - 5}</span>}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{note.content.replace(/[#*`>\-]/g, '').slice(0, 120)}…</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(note)}
                    title={note.isActive ? 'Hide note' : 'Publish note'}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {note.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(note)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  stats:         StatsSection,
  questions:     QuestionsSection,
  bulk:          BulkUploadSection,
  users:         UsersSection,
  roles:         RolesSection,
  announcements: AnnouncementsSection,
  notes:         NotesSection,
  flags:         FlagsSection,
  errata:        ErrataSection,
};

export default function Admin() {
  const [sectionOrder, setSectionOrder] = useSectionOrder();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = sectionOrder.indexOf(active.id as string);
      const newIdx = sectionOrder.indexOf(over.id as string);
      setSectionOrder(arrayMove(sectionOrder, oldIdx, newIdx));
    }
  };

  const toggle = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  return (
    <PageTransition className="max-w-5xl mx-auto pb-20 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div className="flex items-center gap-4">
          <ShieldAlert size={32} className="text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Drag panels to reorder • Click ↕ to collapse</p>
          </div>
        </div>
        <button
          onClick={() => setSectionOrder(DEFAULT_SECTIONS)}
          className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
        >
          Reset Layout
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {sectionOrder.map(id => {
              const SectionComp = SECTION_COMPONENTS[id];
              if (!SectionComp) return null;
              return (
                <SortablePanel key={id} id={id} collapsed={!!collapsed[id]} onToggle={() => toggle(id)}>
                  <SectionComp />
                </SortablePanel>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </PageTransition>
  );
}
