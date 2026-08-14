import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Pencil, Trash2, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import type { Question } from '@workspace/api-client-react';

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

interface QuestionFormState {
  questionText: string;
  subject: string;
  system?: string;
  topic: string;
  subtopic?: string;
  universityTag?: string;
  explanation: string;
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

const emptyForm = (): QuestionFormState => ({
  questionText: '',
  subject: '',
  topic: '',
  explanation: '',
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

function buildPayload(form: QuestionFormState) {
  const options = {
    A: form.optionA,
    B: form.optionB,
    C: form.optionC,
    D: form.optionD,
    ...(form.optionE ? { E: form.optionE } : {}),
  };

  return {
    questionText: form.questionText,
    options,
    correctAnswer: form.correctAnswer,
    explanation: form.explanation,
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

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [form, setForm] = useState<QuestionFormState>(emptyForm());
  const [taxonomy, setTaxonomy] = useState<TaxonomyTree>({ countries: [], subjects: [] });
  const { toast } = useToast();

  const fetchQuestions = async (query = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (query.trim()) params.set('search', query.trim());

      const response = await fetch(`/api/admin/questions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load questions');

      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load questions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchQuestions(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

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
    void loadTaxonomy();
  }, []);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (question: Question) => {
    setEditingQuestion(question);
    setForm({
      questionText: question.questionText || '',
      subject: question.subject || '',
      system: (question as any).system || '',
      topic: question.topic || '',
      subtopic: (question as any).subtopic || '',
      universityTag: (question as any).universityTag || '',
      explanation: question.explanation || '',
      correctAnswer: (question.correctAnswer as QuestionFormState['correctAnswer']) || 'A',
      optionA: question.options?.A || '',
      optionB: question.options?.B || '',
      optionC: question.options?.C || '',
      optionD: question.options?.D || '',
      optionE: question.options?.E || '',
      difficulty: question.difficulty || 'medium',
      examType: (question as any).examType || '',
      tags: Array.isArray(question.tags) ? question.tags.join(', ') : '',
      isFree: Boolean((question as any).isFree),
      countryId: (question as any).countryId ?? undefined,
      examId: (question as any).examId ?? undefined,
      programId: (question as any).programId ?? undefined,
      yearId: (question as any).yearId ?? undefined,
      subjectId: (question as any).subjectId ?? undefined,
      systemId: (question as any).systemId ?? undefined,
      topicId: (question as any).topicId ?? undefined,
      subtopicId: (question as any).subtopicId ?? undefined,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = buildPayload(form);
      const url = editingQuestion ? `/api/admin/questions/${editingQuestion.id}` : '/api/admin/questions';
      const method = editingQuestion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to save question');
      }

      toast({ title: 'Success', description: editingQuestion ? 'Question updated' : 'Question created' });
      setIsModalOpen(false);
      await fetchQuestions();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Save failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (questionId: number) => {
    if (!window.confirm('Delete this question?')) return;

    try {
      const response = await fetch(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete question');
      toast({ title: 'Success', description: 'Question deleted' });
      await fetchQuestions();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Delete failed', variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Question Management</h2>
          <p className="text-sm text-muted-foreground">Create, review, and maintain the question bank.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          New Question
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by question text, subject, or topic"
            className="w-full border-0 bg-transparent outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading questions…</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No questions found.</div>
        ) : (
          <div className="divide-y divide-border">
            {questions.map((question) => (
              <div key={question.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {(question as any).qid && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                        {(question as any).qid}
                      </span>
                    )}
                    <BookOpen size={16} className="text-primary" />
                    <p className="font-semibold">{question.questionText}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">{question.subject}</span>
                    <span className="rounded-full bg-muted px-2 py-1">{question.topic}</span>
                    <span className="rounded-full bg-muted px-2 py-1">{question.difficulty}</span>
                    {(question as any).status && (question as any).status !== 'published' && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-600">{(question as any).status}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(question)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => void handleDelete(question.id)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingQuestion ? 'Edit Question' : 'Create Question'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
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
                      <option key={option} value={option}>{option}</option>
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

              <div className="grid gap-4 md:grid-cols-2">
                {(['optionA', 'optionB', 'optionC', 'optionD', 'optionE'] as const).map((field) => (
                  <div key={field}>
                    <label className="mb-1 block text-sm font-medium">{field.replace('option', 'Option ')}</label>
                    <input
                      value={form[field]}
                      onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Explanation</label>
                <RichTextEditor
                  value={form.explanation}
                  onChange={(html) => setForm({ ...form, explanation: html })}
                  placeholder="Explanation — tables, images, exam pearls…"
                />
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
