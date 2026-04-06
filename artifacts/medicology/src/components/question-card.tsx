import React, { useState } from 'react';
import { Question, useExplainQuestion, useAddBookmark, useRemoveBookmark } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Sparkles, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '@/hooks/use-toast';

interface QuestionCardProps {
  question: Question;
  userAnswer?: string | null;
  showFeedback: boolean;
  onAnswer?: (option: string) => void;
  disabled?: boolean;
}

export function QuestionCard({ question, userAnswer, showFeedback, onAnswer, disabled }: QuestionCardProps) {
  const { toast } = useToast();
  const [showExplanation, setShowExplanation] = useState(showFeedback);
  const [aiExplanation, setAiExplanation] = useState<any>(null);
  
  const explainMutation = useExplainQuestion();
  const addBookmarkMutation = useAddBookmark();
  const removeBookmarkMutation = useRemoveBookmark();
  
  const [isBookmarked, setIsBookmarked] = useState(question.isBookmarked || false);

  const toggleBookmark = async () => {
    try {
      if (isBookmarked) {
        await removeBookmarkMutation.mutateAsync({ questionId: question.id });
        setIsBookmarked(false);
      } else {
        await addBookmarkMutation.mutateAsync({ data: { questionId: question.id } });
        setIsBookmarked(true);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update bookmark", variant: "destructive" });
    }
  };

  const handleExplainAI = async () => {
    if (aiExplanation) return;
    try {
      const res = await explainMutation.mutateAsync({
        data: {
          questionId: question.id,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer
        }
      });
      setAiExplanation(res);
    } catch (err) {
      toast({ title: "AI Error", description: "Could not fetch AI explanation.", variant: "destructive" });
    }
  };

  const optionsEntries = Object.entries(question.options).filter(([_, val]) => !!val);

  return (
    <div className="bg-card rounded-3xl shadow-md hover:shadow-lg border border-border/50 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/40 flex justify-between items-center bg-gradient-mesh">
        <div className="flex gap-2 flex-wrap">
          <span className="badge-primary">{question.subject}</span>
          <span className="badge-accent">{question.topic}</span>
        </div>
        <motion.button 
          onClick={toggleBookmark}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={clsx("p-2.5 rounded-full transition-all duration-200", isBookmarked ? "text-primary bg-primary/15 shadow-md" : "text-muted-foreground hover:bg-muted/80")}
        >
          <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
        </motion.button>
      </div>

      {/* Question Text */}
      <div className="p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-display font-semibold text-foreground leading-relaxed mb-8">
          {question.questionText}
        </h3>

        {/* Options */}
        <div className="space-y-3">
          {optionsEntries.map(([key, text], idx) => {
            const isSelected = userAnswer === key;
            const isCorrect = key === question.correctAnswer;
            
            let btnClass = "bg-background/50 border-border hover:border-primary/50 hover:bg-muted/80 text-foreground hover:shadow-md";
            let icon = null;

            if (showFeedback) {
              if (isCorrect) {
                btnClass = "bg-success/15 border-success/50 text-foreground shadow-md";
                icon = <CheckCircle2 className="text-success" size={20} />;
              } else if (isSelected && !isCorrect) {
                btnClass = "bg-destructive/15 border-destructive/50 text-foreground shadow-md";
                icon = <AlertCircle className="text-destructive" size={20} />;
              } else {
                btnClass = "bg-background/30 border-border/30 opacity-60";
              }
            } else if (isSelected) {
              btnClass = "bg-primary/15 border-primary/50 text-foreground font-medium shadow-lg shadow-primary/20";
            }

            return (
              <motion.button
                key={key}
                disabled={disabled || showFeedback}
                onClick={() => onAnswer && onAnswer(key)}
                whileHover={(!disabled && !showFeedback) ? { scale: 1.02, y: -2 } : {}}
                whileTap={(!disabled && !showFeedback) ? { scale: 0.98 } : {}}
                className={clsx(
                  "w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between group",
                  btnClass,
                  (!disabled && !showFeedback) && "cursor-pointer"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-200 flex-shrink-0",
                    (showFeedback && isCorrect) ? "bg-success text-white shadow-md" :
                    (showFeedback && isSelected && !isCorrect) ? "bg-destructive text-white shadow-md" :
                    isSelected ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground group-hover:bg-primary/30 group-hover:text-primary"
                  )}>
                    {key}
                  </div>
                  <span className="text-base">{text as string}</span>
                </div>
                {icon && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>{icon}</motion.div>}
              </motion.button>
            );
          })}
        </div>

        {/* Feedback & Explanation */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: 20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="mt-8 overflow-hidden"
            >
              <div className="bg-gradient-soft border border-primary/30 rounded-3xl p-6 shadow-md">
                <h4 className="font-bold text-lg text-primary mb-4 flex items-center gap-2">
                  <motion.div initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}>
                    <CheckCircle2 size={20} />
                  </motion.div>
                  Explanation
                </h4>
                <p className="text-muted-foreground leading-relaxed">{question.explanation}</p>
                
                {question.wrongAnswerExplanations && (
                  <div className="mt-5 pt-5 border-t border-primary/15">
                    <h5 className="font-semibold text-sm mb-2 text-foreground">Why others are incorrect:</h5>
                    <p className="text-sm text-muted-foreground">{question.wrongAnswerExplanations}</p>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-primary/15">
                  <motion.button 
                    onClick={handleExplainAI}
                    disabled={explainMutation.isPending}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent to-fuchsia-500 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 btn-press"
                  >
                    <motion.div animate={{ rotate: explainMutation.isPending ? 360 : 0 }} transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}>
                      <Sparkles size={18} />
                    </motion.div>
                    {explainMutation.isPending ? "Asking AI..." : "Explain with AI"}
                  </motion.button>
                </div>

                {/* AI Explanation Area */}
                <AnimatePresence>
                  {aiExplanation && (
                    <motion.div 
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -15, scale: 0.95 }}
                      className="mt-5 bg-background/80 rounded-2xl p-5 border-2 border-accent/30 shadow-md backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-2 mb-4 text-accent font-bold animate-pulse-soft">
                        <Sparkles size={18} /> AI Analysis
                      </div>
                      <div className="space-y-4 text-sm text-foreground">
                        <div>
                          <span className="font-semibold text-accent">Summary:</span> {aiExplanation.explanation}
                        </div>
                        <div className="p-3 bg-success/10 rounded-xl border border-success/30 shadow-md">
                          <span className="font-semibold text-success block mb-1">✓ Why Correct:</span>
                          {aiExplanation.whyCorrect}
                        </div>
                        <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/30 shadow-md">
                          <span className="font-semibold text-destructive block mb-1">✕ Common Pitfalls:</span>
                          {aiExplanation.whyOthersWrong}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
