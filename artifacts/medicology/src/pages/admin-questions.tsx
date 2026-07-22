import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Pencil, Trash2, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Question } from '@workspace/api-client-react';

interface QuestionFormState {
  questionText: string;
  subject: string;
  topic: string;
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
    topic: form.topic,
    difficulty: form.difficulty || 'medium',
    examType: form.examType || undefined,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    isFree: form.isFree,
  };
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [form, setForm] = useState<QuestionFormState>(emptyForm());
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
      topic: question.topic || '',
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
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary" />
                    <p className="font-semibold">{question.questionText}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">{question.subject}</span>
                    <span className="rounded-full bg-muted px-2 py-1">{question.topic}</span>
                    <span className="rounded-full bg-muted px-2 py-1">{question.difficulty}</span>
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
                <textarea
                  required
                  rows={3}
                  value={form.questionText}
                  onChange={(event) => setForm({ ...form, questionText: event.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
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
                <textarea
                  rows={3}
                  value={form.explanation}
                  onChange={(event) => setForm({ ...form, explanation: event.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
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
