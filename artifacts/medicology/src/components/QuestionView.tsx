import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Question, useSubmitAnswer, useAddBookmark, useRemoveBookmark } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import RichText from "@/components/RichText";

interface QuestionViewProps {
  question: Question;
  mode: "practice" | "test" | "review";
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onSelectAnswer?: (answer: string) => void;
  showExplanation?: boolean;
}

export function QuestionView({
  question,
  mode,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onSelectAnswer,
  showExplanation: forceShowExplanation,
}: QuestionViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [bookmarked, setBookmarked] = useState(question.isBookmarked ?? false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useSubmitAnswer();
  const addBookmarkMutation = useAddBookmark();
  const removeBookmarkMutation = useRemoveBookmark();

  const answered = selected !== null;
  const isCorrect = selected === question.correctAnswer;
  const shouldShowExplanation = forceShowExplanation || (mode === "practice" && showExplanation);

  const handleSelect = (key: string) => {
    if (answered && mode === "practice") return;
    if (mode === "test") {
      setSelected(key);
      onSelectAnswer?.(key);
      return;
    }
    setSelected(key);
    setShowExplanation(true);
    submitMutation.mutate({
      data: { questionId: question.id, selectedAnswer: key, mode: "practice" },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getAnalytics"] });
        queryClient.invalidateQueries({ queryKey: ["getWrongQuestions"] });
      }
    });
  };

  const handleBookmark = () => {
    const newState = !bookmarked;
    setBookmarked(newState);
    if (newState) {
      addBookmarkMutation.mutate({ data: { questionId: question.id } }, {
        onError: () => { setBookmarked(!newState); toast({ title: "Failed to bookmark", variant: "destructive" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getBookmarks"] }),
      });
    } else {
      removeBookmarkMutation.mutate({ questionId: question.id }, {
        onError: () => { setBookmarked(!newState); toast({ title: "Failed to remove bookmark", variant: "destructive" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getBookmarks"] }),
      });
    }
  };

  const handleNext = () => {
    setSelected(null);
    setShowExplanation(false);
    onNext?.();
  };

  const handlePrev = () => {
    setSelected(null);
    setShowExplanation(false);
    onPrev?.();
  };

  const QUESTION_TYPE_LABELS: Record<string, string> = {
  sba: 'SBA',
  best_of_five: 'MCQ',
  true_false: 'True/False',
  assertion_reason: 'A/R',
  emq: 'EMQ',
  image_based: 'Image',
  clinical_vignette: 'Vignette',
  case_based: 'Case',
};

// Standard True/False and Assertion/Reason option sets (mirrors session-v2).
const TRUE_FALSE_OPTIONS: Record<string, string> = { A: 'True', B: 'False' };
const ASSERTION_REASON_OPTIONS: Record<string, string> = {
  A: 'Both the assertion (A) and reason (R) are true, and R is the correct explanation of A',
  B: 'Both A and R are true, but R is NOT the correct explanation of A',
  C: 'A is true, but R is false',
  D: 'A is false, but R is true',
  E: 'Both A and R are false',
};

type OptionMap = Record<string, string>;

function viewOptions(question: Question): OptionMap {
  if (question.questionType === 'true_false') return TRUE_FALSE_OPTIONS;
  if (question.questionType === 'assertion_reason') return ASSERTION_REASON_OPTIONS;
  return question.options as unknown as OptionMap;
}

const optionKeys = Object.keys(viewOptions(question));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">{question.subject}</Badge>
              {question.questionType && (
                <Badge variant="secondary" className="text-xs text-primary">{QUESTION_TYPE_LABELS[question.questionType] ?? question.questionType}</Badge>
              )}
              {question.system && <Badge variant="outline" className="text-xs">{question.system}</Badge>}
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  question.difficulty === "easy" && "border-green-500/50 text-green-600",
                  question.difficulty === "medium" && "border-yellow-500/50 text-yellow-600",
                  question.difficulty === "hard" && "border-red-500/50 text-red-600"
                )}
              >
                {question.difficulty}
              </Badge>
              {question.tags?.includes("high_yield") && (
                <Badge className="text-xs bg-yellow-500 text-white">High Yield</Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={handleBookmark}>
              {bookmarked
                ? <BookmarkCheck className="h-4 w-4 text-primary" />
                : <Bookmark className="h-4 w-4 text-muted-foreground" />
              }
            </Button>
          </div>
          {(question as any).imageUrl && (
            <button
              onClick={() => setFullscreenImage((question as any).imageUrl)}
              className="mb-3 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-pointer block w-full"
            >
              <img src={(question as any).imageUrl} alt="Question" className="max-h-64 w-full object-contain" />
            </button>
          )}
          <RichText html={question.questionText} className="text-base leading-relaxed font-medium" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {optionKeys.map((key) => {
          const isThisCorrect = key === question.correctAnswer;
          const isSelected = selected === key;
          let optionStyle = "border-border hover:border-primary/50 hover:bg-accent/50";

          if (answered && mode === "practice") {
            if (isThisCorrect) optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20";
            else if (isSelected && !isThisCorrect) optionStyle = "border-red-500 bg-red-50 dark:bg-red-900/20";
            else optionStyle = "border-border opacity-60";
          } else if (isSelected) {
            optionStyle = "border-primary bg-accent";
          }

          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-all",
                optionStyle,
                answered && mode === "practice" && "cursor-default"
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  isSelected && !answered ? "bg-primary text-primary-foreground" :
                  answered && isThisCorrect && mode === "practice" ? "bg-green-500 text-white" :
                  answered && isSelected && !isThisCorrect && mode === "practice" ? "bg-red-500 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {key}
                </span>
                <span className="text-sm leading-relaxed pt-0.5">{viewOptions(question)[key]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {shouldShowExplanation && answered && (
        <Card className="animate-in fade-in border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-sm">Explanation</span>
              {isCorrect
                ? <Badge className="bg-green-500 text-white text-xs">Correct!</Badge>
                : <Badge variant="destructive" className="text-xs">Incorrect</Badge>
              }
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              <div>
                <p className="font-medium text-green-600 dark:text-green-400 mb-1">
                  ✓ Why {question.correctAnswer} is correct:
                </p>
                <RichText html={question.explanation} className="text-muted-foreground" />
                {(question as any).explanationImageUrl && (
                  <button
                    onClick={() => setFullscreenImage((question as any).explanationImageUrl)}
                    className="mt-2 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-pointer block max-w-full"
                  >
                    <img src={(question as any).explanationImageUrl} alt="Explanation" className="max-h-64 w-full object-contain" />
                  </button>
                )}
              </div>
              {question.whyWrong && (
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400 mb-1">✗ Why others are incorrect:</p>
                  <RichText html={question.whyWrong} className="text-muted-foreground" />
                </div>
              )}
              {question.wrongAnswerExplanations && !question.whyWrong && (
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400 mb-1">✗ Why others are incorrect:</p>
                  <p className="text-muted-foreground">{question.wrongAnswerExplanations}</p>
                </div>
              )}
              {question.examPearl && (
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400 mb-1">💎 Exam Pearl:</p>
                  <RichText html={question.examPearl} className="text-muted-foreground" />
                </div>
              )}
              {question.commonTrap && (
                <div>
                  <p className="font-medium text-purple-600 dark:text-purple-400 mb-1">⚠️ Common Trap:</p>
                  <RichText html={question.commonTrap} className="text-muted-foreground" />
                </div>
              )}
              {question.references && (
                <div>
                  <p className="font-medium mb-1">📚 References:</p>
                  <p className="text-muted-foreground">{question.references}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handlePrev} disabled={!hasPrev}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button onClick={handleNext} disabled={!hasNext}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={fullscreenImage}
              alt="Fullscreen"
              className="max-w-full max-h-[90vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
