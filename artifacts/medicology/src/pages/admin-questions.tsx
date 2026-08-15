import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import type { Question } from '@workspace/api-client-react';
import QuestionEditorModal, {
  QuestionFormState,
  emptyQuestionForm,
  QUESTION_TYPE_LABELS,
} from '@/components/QuestionEditorModal';

function formFromQuestion(question: Question): QuestionFormState {
  return {
    questionText: question.questionText || '',
    subject: question.subject || '',
    system: (question as any).system || '',
    topic: question.topic || '',
    subtopic: (question as any).subtopic || '',
    universityTag: (question as any).universityTag || '',
    explanation: question.explanation || '',
    questionType: (question as any).questionType || 'sba',
    whyCorrect: (question as any).whyCorrect || '',
    whyWrong: (question as any).whyWrong || '',
    examPearl: (question as any).examPearl || '',
    commonTrap: (question as any).commonTrap || '',
    assertion: (question as any).assertion || '',
    reason: (question as any).reason || '',
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
  };
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [initialForm, setInitialForm] = useState<QuestionFormState>(emptyQuestionForm());
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
    setInitialForm(emptyQuestionForm());
    setIsModalOpen(true);
  };

  const openEditModal = (question: Question) => {
    setEditingQuestion(question);
    setInitialForm(formFromQuestion(question));
    setIsModalOpen(true);
  };

  const handleSave = async (payload: Record<string, any>) => {
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
                    {(question as any).questionType && (question as any).questionType !== 'sba' && (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{QUESTION_TYPE_LABELS[(question as any).questionType] || (question as any).questionType}</span>
                    )}
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

      <QuestionEditorModal
        open={isModalOpen}
        title={editingQuestion ? 'Edit Question' : 'Create Question'}
        initial={initialForm}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        submitLabel={editingQuestion ? 'Save Changes' : 'Create Question'}
      />
    </div>
  );
}
