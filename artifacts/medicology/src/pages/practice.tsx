import { useState } from "react";
import {
  useGetQuestions,
  useGetQuestionFilters,
  type GetQuestionsDifficulty,
} from "@workspace/api-client-react";
import { QuestionView } from "@/components/QuestionView";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Play, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PracticePage() {
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    subject: "all",
    system: "all",
    difficulty: "all",
    university: "all",
  });
  const { toast } = useToast();

  const { data: filterData } = useGetQuestionFilters();

  const { refetch, isFetching } = useGetQuestions(
    {
      subject: filters.subject !== "all" ? filters.subject : undefined,
      system: filters.system !== "all" ? filters.system : undefined,
      difficulty:
        filters.difficulty !== "all"
          ? (filters.difficulty as GetQuestionsDifficulty)
          : undefined,
      limit: 100,
    },
    { query: { queryKey: ["practice-questions"], enabled: false } }
  );

  const handleStart = async () => {
    const result = await refetch();
    const qs = result.data?.questions ?? [];
    if (qs.length > 0) {
      setQuestions(qs);
      setCurrentIdx(0);
      setStarted(true);
    } else {
      toast({
        title: "No Questions",
        description: "No questions found for the selected filters. Try broadening your search.",
        variant: "destructive",
      });
    }
  };

  const currentQuestion = questions[currentIdx];

  if (started && currentQuestion) {
    return (
      <div className="animate-in fade-in space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{currentIdx + 1} / {questions.length}</Badge>
            <Badge variant="outline">{currentQuestion.subject}</Badge>
            {currentQuestion.topic && (
              <Badge variant="outline" className="hidden sm:inline-flex">{currentQuestion.topic}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>Exit</Button>
        </div>
        <QuestionView
          question={currentQuestion}
          mode="practice"
          onNext={() => setCurrentIdx((i) => Math.min(i + 1, questions.length - 1))}
          onPrev={() => setCurrentIdx((i) => Math.max(i - 1, 0))}
          hasNext={currentIdx < questions.length - 1}
          hasPrev={currentIdx > 0}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Practice Mode</h1>
        <p className="text-sm text-muted-foreground mt-1">Untimed practice with instant feedback after each answer</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={filters.subject} onValueChange={(v) => setFilters((f) => ({ ...f, subject: v }))}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {filterData?.subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.system} onValueChange={(v) => setFilters((f) => ({ ...f, system: v }))}>
              <SelectTrigger><SelectValue placeholder="System" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Systems</SelectItem>
                {filterData?.systems.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.difficulty} onValueChange={(v) => setFilters((f) => ({ ...f, difficulty: v }))}>
              <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.university} onValueChange={(v) => setFilters((f) => ({ ...f, university: v }))}>
              <SelectTrigger><SelectValue placeholder="University" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universities</SelectItem>
                {filterData?.universities.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setFilters({ subject: "all", system: "all", difficulty: "easy", university: "all" })}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-1">🟢</div>
            <p className="font-semibold text-sm">Easy</p>
            <p className="text-xs text-muted-foreground">Build confidence</p>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setFilters({ subject: "all", system: "all", difficulty: "medium", university: "all" })}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-1">🟡</div>
            <p className="font-semibold text-sm">Medium</p>
            <p className="text-xs text-muted-foreground">Exam-level</p>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setFilters({ subject: "all", system: "all", difficulty: "hard", university: "all" })}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-1">🔴</div>
            <p className="font-semibold text-sm">Hard</p>
            <p className="text-xs text-muted-foreground">Challenge yourself</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Set your filters and start practicing</p>
        <Button onClick={handleStart} disabled={isFetching} size="lg">
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Start Practice
        </Button>
      </div>
    </div>
  );
}
