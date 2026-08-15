import React, { useEffect, useState } from 'react';
import RichTextEditor from '@/components/RichTextEditor';

// ---------------------------------------------------------------------------
// Shared question editor modal — the same editor used for individual
// questions (Admin → Questions) is reused by the Bulk Import flow so imported
// rows can be polished with the full editor before entering the QBank.
// The modal owns the form state and taxonomy pickers; the caller supplies the
// initial form, a save handler (receives the built payload) and close/backdrop
// handling.
// ---------------------------------------------------------------------------

export interface QuestionFormState {
  questionText: string;
  questionType: string;
  subject: string;
  system?: string;
  topic: string;
  subtopic?: string;
  universityTag?: string;
  explanation: string;
  whyCorrect: string;
  whyWrong: string;
  examPearl: string;
  commonTrap: string;
  assertion?: string;
  reason?: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  difficulty: string;
  examType: string;
  tags: string;
  isFree: boolean;
  // Hybrid relational taxonomy IDs
  countryId?: number;
  examId?: number;
  programId?: number;
  yearId?: number;
  subjectId?: number;
  systemId?: number;
  topicId?: number;
  subtopicId?: number;
}

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  sba: 'Single Best Answer (SBA)',
  best_of_five: 'Best of Five (MCQ)',
  true_false: 'True / False',
  assertion_reason: 'Assertion / Reason',
  emq: 'Extended Matching (EMQ)',
  image_based: 'Image-based (ECG, X-ray, CT…)',
  clinical_vignette: 'Clinical Vignette',
  case_based: 'Case-based',
};

export const emptyQuestionForm = (): QuestionFormState => ({
  questionText: '',
  questionType: 'sba',
  subject: '',
  topic: '',
  explanation: '',
  whyCorrect: '',
  whyWrong: '',
  examPearl: '',
  commonTrap: '',
  correctAnswer: 'A',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  optionE: '',
  difficulty: 'medium',
  examType: '',
  tags: '',
  isFree: false,
  countryId: undefined,
  examId: undefined,
  programId: undefined,
  yearId: undefined,
  subjectId: undefined,
  systemId: undefined,
  topicId: undefined,
  subtopicId: undefined,
});

export function buildQuestionPayload(form: QuestionFormState) {
  const options = {
    A: form.optionA,
    B: form.optionB,
    C: form.optionC,
    D: form.optionD,
    ...(form.optionE ? { E: form.optionE } : {}),
  };

  return {
    questionText: form.questionText,
    questionType: form.questionType || 'sba',
    options,
    correctAnswer: form.correctAnswer,
    explanation: form.explanation,
    whyCorrect: form.whyCorrect || undefined,
    whyWrong: form.whyWrong || undefined,
    examPearl: form.examPearl || undefined,
    commonTrap: form.commonTrap || undefined,
    assertion: form.assertion || undefined,
    reason: form.reason || undefined,
    subject: form.subject,
    system: form.system || undefined,
    topic: form.topic,
    subtopic: form.subtopic || undefined,
    universityTag: form.universityTag || undefined,
    difficulty: form.difficulty || 'medium',
    examType: form.examType || undefined,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    isFree: form.isFree,
    countryId: form.countryId,
    examId: form.examId,
    programId: form.programId,
    yearId: form.yearId,
    subjectId: form.subjectId,
    systemId: form.systemId,
    topicId: form.topicId,
    subtopicId: form.subtopicId,
  };
}

interface TaxonomyNode {
  id: number;
  code?: string;
  name: string;
  flag?: string;
  icon?: string;
  status?: string;
  examSystems?: TaxonomyNode[];
  exams?: TaxonomyNode[];
  programs?: TaxonomyNode[];
  years?: TaxonomyNode[];
  systems?: TaxonomyNode[];
  topics?: TaxonomyNode[];
  subtopics?: TaxonomyNode[];
}

interface TaxonomyTree {
  countries: TaxonomyNode[];
  subjects: TaxonomyNode[];
}

interface QuestionEditorModalProps {
  open: boolean;
  title?: string;
  initial: QuestionFormState;
  onClose: () => void;
  /** Receives the built payload (same shape as the questions API). */
  onSave: (payload: Record<string, any>) => Promise<void> | void;
  submitLabel?: string;
  /** Set for True/False & Assertion/Reason so the editor adapts. */
  typeAware?: boolean;
}

export default function QuestionEditorModal({
  open,
  title = 'Edit Question',
  initial,
  onClose,
  onSave,
  submitLabel = 'Save',
  typeAware = true,
}: QuestionEditorModalProps) {
  const [form, setForm] = useState<QuestionFormState>(initial);
  const [taxonomy, setTaxonomy] = useState<TaxonomyTree>({ countries: [], subjects: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...emptyQuestionForm(), ...initial });
  }, [open, initial]);

  // Load the taxonomy tree once so the form can pick relational IDs.
  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await fetch('/api/taxonomy/tree');
        if (response.ok) {
          const data = await response.json();
          setTaxonomy({ countries: data.countries ?? [], subjects: data.subjects ?? [] });
        }
      } catch {
        // Taxonomy is optional — the form still works with free-text fields.
      }
    };
    if (open) void loadTaxonomy();
  }, [open]);

  if (!open) return null;

  const isTF = typeAware && form.questionType === 'true_false';
  const isAR = typeAware && form.questionType === 'assertion_reason';
  const showOptions = typeAware ? !isTF && !isAR : true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(buildQuestionPayload(form));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Question Text</label>
            <RichTextEditor
              value={form.questionText}
              onChange={(html) => setForm({ ...form, questionText: html })}
              placeholder="Stem — supports tables, images, flowcharts, formatting…"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Question Type</label>
            <select
              value={form.questionType}
              onChange={(event) => setForm({ ...form, questionType: event.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {(isTF || isAR) && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {isTF
                ? 'True/False question — Option A is locked to True and Option B to False. Set the Correct Answer to True or False.'
                : 'Assertion/Reason question — fill the Assertion and Reason below. The classic five answer choices (A–E) are generated automatically.'}
            </div>
          )}

          {isAR && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Assertion</label>
                <RichTextEditor
                  value={form.assertion ?? ''}
                  onChange={(html) => setForm({ ...form, assertion: html })}
                  placeholder="The assertion statement…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <RichTextEditor
                  value={form.reason ?? ''}
                  onChange={(html) => setForm({ ...form, reason: html })}
                  placeholder="The reason statement…"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <input
                required
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Topic</label>
              <input
                required
                value={form.topic}
                onChange={(event) => setForm({ ...form, topic: event.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </div>
          </div>

          {/* Hybrid taxonomy pickers — picking a node fills the text fields above. */}
          <TaxonomyPickers taxonomy={taxonomy} form={form} setForm={setForm} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Correct Answer</label>
              <select
                value={form.correctAnswer}
                onChange={(event) => setForm({ ...form, correctAnswer: event.target.value as QuestionFormState['correctAnswer'] })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {(['A', 'B', 'C', 'D', 'E'] as const).map((option) => (
                  <option key={option} value={option}>{isTF ? (option === 'A' ? 'True' : option === 'B' ? 'False' : option) : option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {showOptions && (
            <div className="grid gap-4 md:grid-cols-2">
              {(['optionA', 'optionB', 'optionC', 'optionD', 'optionE'] as const).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium">
                    {isTF ? (field === 'optionA' ? 'Option A (True)' : field === 'optionB' ? 'Option B (False)' : field.replace('option', 'Option ')) : field.replace('option', 'Option ')}
                  </label>
                  <input
                    value={form[field]}
                    disabled={isTF && (field === 'optionC' || field === 'optionD' || field === 'optionE')}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Explanation</label>
            <RichTextEditor
              value={form.explanation}
              onChange={(html) => setForm({ ...form, explanation: html })}
              placeholder="Explanation — tables, images, exam pearls…"
            />
          </div>

          {/* Structured explanations (P1 exam engine) */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="text-sm font-semibold">Structured Explanation (optional)</div>
            <div>
              <label className="mb-1 block text-sm font-medium text-green-600">Why this answer is correct</label>
              <RichTextEditor
                value={form.whyCorrect}
                onChange={(html) => setForm({ ...form, whyCorrect: html })}
                placeholder="The mechanism/reason the correct answer works…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-red-500">Why wrong answers are wrong</label>
              <RichTextEditor
                value={form.whyWrong}
                onChange={(html) => setForm({ ...form, whyWrong: html })}
                placeholder="Why the distractors fail…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-amber-600">Exam Pearl</label>
              <RichTextEditor
                value={form.examPearl}
                onChange={(html) => setForm({ ...form, examPearl: html })}
                placeholder="High-yield one-liner for the exam…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-purple-600">Common Trap</label>
              <RichTextEditor
                value={form.commonTrap}
                onChange={(html) => setForm({ ...form, commonTrap: html })}
                placeholder="The classic mistake students make…"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tags</label>
            <input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              placeholder="anatomy, physiology"
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFree}
              onChange={(event) => setForm({ ...form, isFree: event.target.checked })}
            />
            Free question
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TaxonomyPickersProps {
  taxonomy: TaxonomyTree;
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
}

/**
 * Cascading selects over the exam + subject taxonomy. Picking a node stores the
 * relational ID and auto-fills the legacy free-text columns (subject, topic,
 * universityTag) so both sides of the hybrid schema stay consistent.
 */
function TaxonomyPickers({ taxonomy, form, setForm }: TaxonomyPickersProps) {
  const update = (patch: Partial<QuestionFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  // Country → exam system → exam → program → year chain
  const countries = taxonomy.countries ?? [];
  const exams = countries.flatMap((c) => (c.examSystems ?? []).flatMap((es) => es.exams ?? []));
  const selectedExam = exams.find((e) => e.id === form.examId);
  const programs = selectedExam?.programs ?? [];
  const selectedProgram = programs.find((p) => p.id === form.programId);
  const years = selectedProgram?.years ?? [];

  const onCountry = (id: string) =>
    update({ countryId: id ? Number(id) : undefined, examId: undefined, programId: undefined, yearId: undefined, examType: undefined });
  const onExam = (id: string) =>
    update({
      examId: id ? Number(id) : undefined,
      programId: undefined,
      yearId: undefined,
      universityTag: id ? exams.find((e) => e.id === Number(id))?.code : undefined,
      examType: 'annual',
    });
  const onProgram = (id: string) => update({ programId: id ? Number(id) : undefined, yearId: undefined });
  const onYear = (id: string) => update({ yearId: id ? Number(id) : undefined });

  // Subject → system → topic → subtopic chain
  const subjects = taxonomy.subjects ?? [];
  const selectedSubject = subjects.find((s) => s.id === form.subjectId);
  const systems = selectedSubject?.systems ?? [];
  const selectedSystem = systems.find((s) => s.id === form.systemId);
  const topics = selectedSystem?.topics ?? [];
  const selectedTopic = topics.find((t) => t.id === form.topicId);
  const subtopics = selectedTopic?.subtopics ?? [];

  const onSubject = (id: string) =>
    update({
      subjectId: id ? Number(id) : undefined,
      systemId: undefined,
      topicId: undefined,
      subtopicId: undefined,
      subject: id ? subjects.find((s) => s.id === Number(id))?.name : undefined,
    });
  const onSystem = (id: string) =>
    update({
      systemId: id ? Number(id) : undefined,
      topicId: undefined,
      subtopicId: undefined,
      system: id ? systems.find((s) => s.id === Number(id))?.name : undefined,
    });
  const onTopic = (id: string) =>
    update({
      topicId: id ? Number(id) : undefined,
      subtopicId: undefined,
      topic: id ? topics.find((t) => t.id === Number(id))?.name : undefined,
    });
  const onSubtopic = (id: string) =>
    update({
      subtopicId: id ? Number(id) : undefined,
      subtopic: id ? subtopics.find((st) => st.id === Number(id))?.name : undefined,
    });

  if (countries.length === 0 && subjects.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exam &amp; Subject Taxonomy</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Country</label>
          <select
            value={form.countryId ?? ''}
            onChange={(event) => onCountry(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>{country.flag} {country.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">University / Exam</label>
          <select
            value={form.examId ?? ''}
            onChange={(event) => onExam(event.target.value)}
            disabled={exams.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— None —</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.code} — {exam.name}{exam.status === 'available' ? '' : ' (coming soon)'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Program</label>
          <select
            value={form.programId ?? ''}
            onChange={(event) => onProgram(event.target.value)}
            disabled={programs.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— None —</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Academic Year</label>
          <select
            value={form.yearId ?? ''}
            onChange={(event) => onYear(event.target.value)}
            disabled={years.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— None —</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
          <select
            value={form.subjectId ?? ''}
            onChange={(event) => onSubject(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.icon} {subject.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">System</label>
          <select
            value={form.systemId ?? ''}
            onChange={(event) => onSystem(event.target.value)}
            disabled={systems.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— None —</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>{system.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Topic</label>
          <select
            value={form.topicId ?? ''}
            onChange={(event) => onTopic(event.target.value)}
            disabled={topics.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— None —</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Subtopic</label>
          <select
            value={form.subtopicId ?? ''}
            onChange={(event) => onSubtopic(event.target.value)}
            disabled={subtopics.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— None —</option>
            {subtopics.map((subtopic) => (
              <option key={subtopic.id} value={subtopic.id}>{subtopic.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
