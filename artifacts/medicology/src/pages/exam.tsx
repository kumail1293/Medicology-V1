import { useState, useEffect, useCallback, useMemo } from "react";
import { useGetQuestions, useGetQuestionFilters, useSubmitAnswer } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Timer, Play, Trophy, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Phase = "setup" | "running" | "results";

interface TestAnswer {
  questionId: number;
  selected: string | null;
}

export default function ExamMode() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [numQuestions, setNumQuestions] = useState(10);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const submitMutation = useSubmitAnswer();

  const { data: filterData } = useGetQuestionFilters();
  const { refetch, isFetching } = useGetQuestions(
    {
      subject: subjectFilter !== "all" ? subjectFilter : undefined,
      limit: 50,
    },
    { query: { enabled: false } }
  );

  const handleStartTest = async () => {
    const result = await refetch();
    const pool = result.data?.questions ?? [];
    if (pool.length === 0) {
      toast({ title: "No Questions", description: "No questions found for the selected filters.", variant: "destructive" });
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, numQuestions);
    setQuestions(shuffled);
    setAnswers(shuffled.map((q: any) => ({ questionId: q.id, selected: null })));
    setCurrentIdx(0);
    const t = shuffled.length * 60;
    setTimeLeft(t);
    setTotalTime(t);
    setPhase("running");
  };

  const submitTest = useCallback(() => {
    answers.forEach((a) => {
      if (!a.selected) return;
      submitMutation.mutate({ data: { questionId: a.questionId, selectedAnswer: a.selected, mode: "exam" } });
    });
    queryClient.invalidateQueries({ queryKey: ["getAnalytics"] });
    queryClient.invalidateQueries({ queryKey: ["getWrongQuestions"] });
    setPhase("results");
  }, [answers, submitMutation, queryClient]);

  useEffect(() => {
    if (phase !== "running") return;
    if (timeLeft <= 0) { submitTest(); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, submitTest]);

  const selectAnswer = (key: string) => {
    setAnswers((prev) => prev.map((a, i) => i === currentIdx ? { ...a, selected: key } : a));
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const results = useMemo(() => {
    const correct = answers.filter((a) => {
      const q = questions.find((x) => x.id === a.questionId);
      return q && a.selected === q.correctAnswer;
    }).length;
    const attempted = answers.filter((a) => a.selected !== null).length;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    return { correct, attempted, total: questions.length, score, timeTaken: totalTime - timeLeft };
  }, [answers, questions, totalTime, timeLeft]);

  if (phase === "setup") {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div>
          <h1 className="text-2xl font-bold font-display">Exam Mode</h1>
          <p className="text-sm text-muted-foreground mt-1">Timed simulation — 1 minute per question</p>
        </div>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div>
              <label className="text-sm font-medium mb-2 block">Number of Questions</label>
              <div className="flex gap-2 flex-wrap">
                {[5, 10, 15, 20, 30, 40].map((n) => (
                  <Button key={n} variant={numQuestions === n ? "default" : "outline"} size="sm" onClick={() => setNumQuestions(n)}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Subject (Optional)</label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {filterData?.subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
              <p>⏱️ Time limit: <strong>{numQuestions} minutes</strong></p>
              <p>📝 Questions: <strong>{numQuestions}</strong></p>
              <p>🔒 No feedback until you submit</p>
              <p>✅ Navigate freely between questions</p>
            </div>
          </CardContent>
        </Card>
        <Button onClick={handleStartTest} disabled={isFetching} size="lg">
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Start Exam
        </Button>
      </div>
    );
  }

  if (phase === "results") {
    const { correct, attempted, total, score, timeTaken } = results;
    const formatTimeTaken = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="text-center py-6">
          <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-3xl font-bold font-display mb-1">Exam Complete!</h1>
          <p className="text-muted-foreground">Here are your results</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{score}%</p>
            <p className="text-xs text-muted-foreground mt-1">Score</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{correct}</p>
            <p className="text-xs text-muted-foreground mt-1">Correct</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{total - correct}</p>
            <p className="text-xs text-muted-foreground mt-1">Incorrect</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{formatTimeTaken(timeTaken)}</p>
            <p className="text-xs text-muted-foreground mt-1">Time Taken</p>
          </CardContent></Card>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Score</span><span>{score}%</span>
            </div>
            <Progress value={score} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {score >= 80 ? "🎉 Excellent performance!" : score >= 60 ? "👍 Good job, keep practicing!" : "📚 Review your weak areas"}
            </p>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <h2 className="font-bold text-lg">Question Review</h2>
          {questions.map((q, i) => {
            const a = answers[i];
            const isCorrect = a.selected === q.correctAnswer;
            const wasAttempted = a.selected !== null;
            return (
              <Card key={q.id} className={cn("border-l-4", isCorrect ? "border-l-green-500" : wasAttempted ? "border-l-red-500" : "border-l-gray-300")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Badge variant="outline" className="text-xs shrink-0">Q{i + 1}</Badge>
                    <p className="text-sm font-medium">{q.questionText}</p>
                  </div>
                  <div className="text-xs space-y-1 ml-10">
                    <p>Your answer: <span className={cn("font-semibold", isCorrect ? "text-green-600" : "text-red-600")}>{a.selected ?? "Not attempted"}</span></p>
                    {!isCorrect && <p>Correct answer: <span className="font-semibold text-green-600">{q.correctAnswer}</span></p>}
                    {q.explanation && <p className="text-muted-foreground mt-1">{q.explanation}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Button onClick={() => setPhase("setup")} variant="outline" className="w-full">Take Another Exam</Button>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const currentA = answers[currentIdx];
  const progressPct = ((totalTime - timeLeft) / totalTime) * 100;
  const isLowTime = timeLeft < 60;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{currentIdx + 1} / {questions.length}</Badge>
        <div className={cn("flex items-center gap-1.5 font-mono font-bold text-sm px-3 py-1.5 rounded-lg", isLowTime ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-muted")}>
          <Timer className="h-3.5 w-3.5" />
          {formatTime(timeLeft)}
        </div>
        <Button size="sm" onClick={submitTest}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Submit
        </Button>
      </div>

      <Progress value={progressPct} className={cn("h-1.5", isLowTime && "[&>div]:bg-red-500")} />

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="secondary" className="text-xs">{currentQ.subject}</Badge>
            {currentQ.system && <Badge variant="outline" className="text-xs">{currentQ.system}</Badge>}
          </div>
          <p className="text-base leading-relaxed font-medium">{currentQ.questionText}</p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(Object.keys(currentQ.options) as string[]).map((key) => (
          <button
            key={key}
            onClick={() => selectAnswer(key)}
            className={cn(
              "w-full text-left p-4 rounded-lg border-2 transition-all",
              currentA.selected === key ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/50"
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                currentA.selected === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {key}
              </span>
              <span className="text-sm leading-relaxed pt-0.5">{currentQ.options[key]}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Prev
        </Button>
        {currentIdx < questions.length - 1 ? (
          <Button onClick={() => setCurrentIdx((i) => i + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={submitTest}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Submit Exam
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center pt-2">
        {answers.map((a, i) => (
          <button
            key={i}
            onClick={() => setCurrentIdx(i)}
            className={cn(
              "h-7 w-7 rounded-full text-xs font-semibold transition-colors",
              i === currentIdx ? "bg-primary text-primary-foreground" :
              a.selected ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/40" :
              "bg-muted text-muted-foreground"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
