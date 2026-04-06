import React, { useEffect, useState, useRef } from 'react';
import { useSessionStore } from '@/store/session';
import { useLocation } from 'wouter';
import { QuestionCard } from '@/components/question-card';
import { useSubmitAnswer, useCompleteDailyChallenge } from '@workspace/api-client-react';
import { PageTransition } from '@/components/layout';
import { ChevronLeft, ChevronRight, Flag, Timer } from 'lucide-react';
import { clsx } from 'clsx';

export default function Session() {
  const { 
    questions, currentIndex, mode, isDaily, answers, timeSpent,
    setAnswer, nextQuestion, prevQuestion, endSession, isFinished
  } = useSessionStore();
  const [, setLocation] = useLocation();
  
  const submitMutation = useSubmitAnswer();
  const completeDailyMutation = useCompleteDailyChallenge();
  
  // Timer logic
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!questions.length || isFinished) {
      setLocation('/practice');
      return;
    }
    
    // Reset local seconds when moving to new question
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, questions.length, isFinished, setLocation]);

  if (!questions.length) return null;

  const currentQ = questions[currentIndex];
  const hasAnswered = !!answers[currentQ.id];
  const showFeedback = mode === 'tutor' || (mode === 'practice' && hasAnswered);

  const handleAnswer = (optionKey: string) => {
    if (hasAnswered) return;
    setAnswer(currentQ.id, optionKey, seconds);
    
    // Send to backend async
    submitMutation.mutate({
      data: {
        questionId: currentQ.id,
        selectedAnswer: optionKey,
        timeTaken: seconds,
        mode: mode
      }
    });
  };

  const handleFinish = async () => {
    endSession();
    if (isDaily) {
      // calculate score
      const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
      await completeDailyMutation.mutateAsync({
        data: { score: correct, total: questions.length }
      });
    }
    setLocation('/results');
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <PageTransition className="max-w-4xl mx-auto py-4 h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 bg-card px-6 py-4 rounded-2xl shadow-sm border border-border">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg">Question {currentIndex + 1} of {questions.length}</span>
          <div className="w-32 sm:w-48 h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground font-mono font-medium bg-muted px-3 py-1.5 rounded-lg">
            <Timer size={18} />
            {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
          </div>
          <button 
            onClick={handleFinish}
            className="text-sm font-bold text-destructive hover:bg-destructive/10 px-4 py-2 rounded-lg transition-colors"
          >
            End Block
          </button>
        </div>
      </div>

      {/* Main Question Area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        <QuestionCard 
          question={currentQ}
          userAnswer={answers[currentQ.id]}
          showFeedback={showFeedback}
          onAnswer={handleAnswer}
          disabled={hasAnswered && mode !== 'tutor'}
        />
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 md:left-72 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={prevQuestion}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-foreground hover:bg-muted disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={20} /> Previous
          </button>
          
          {/* Quick jump map (optional, hide on mobile) */}
          <div className="hidden md:flex gap-1">
            {questions.map((q, i) => (
              <div 
                key={q.id} 
                className={clsx(
                  "w-3 h-3 rounded-full transition-all",
                  i === currentIndex ? "bg-primary scale-125 ring-4 ring-primary/20" :
                  answers[q.id] ? "bg-primary/40" : "bg-border"
                )}
              />
            ))}
          </div>

          {currentIndex === questions.length - 1 ? (
            <button 
              onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <Flag size={20} /> Finish Block
            </button>
          ) : (
            <button 
              onClick={nextQuestion}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              Next <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
