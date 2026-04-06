import React from 'react';
import { useSessionStore } from '@/store/session';
import { Link, useLocation } from 'wouter';
import { PageTransition } from '@/components/layout';
import { Trophy, Clock, Target, ArrowRight, LayoutDashboard, Stethoscope } from 'lucide-react';
import { QuestionCard } from '@/components/question-card';

export default function Results() {
  const { questions, answers, timeSpent } = useSessionStore();
  const [, setLocation] = useLocation();

  if (!questions.length) {
    setLocation('/dashboard');
    return null;
  }

  const total = questions.length;
  const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
  const accuracy = Math.round((correct / total) * 100);
  
  const totalSeconds = Object.values(timeSpent).reduce((a, b) => a + b, 0);
  const avgSeconds = totalSeconds / total;

  return (
    <PageTransition className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 text-primary mb-6">
          <Trophy size={48} />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-foreground mb-4">Session Complete!</h1>
        <p className="text-xl text-muted-foreground">Here's how you performed</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm text-center">
          <Target className="mx-auto text-primary mb-3" size={32} />
          <h3 className="text-3xl font-bold">{accuracy}%</h3>
          <p className="text-muted-foreground font-medium">Accuracy</p>
        </div>
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-3 text-success">
            <span className="text-2xl font-bold">{correct}</span>
            <span className="text-muted-foreground">/ {total}</span>
          </div>
          <h3 className="text-xl font-bold">Correct</h3>
          <p className="text-muted-foreground font-medium">Score</p>
        </div>
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm text-center">
          <Clock className="mx-auto text-orange-500 mb-3" size={32} />
          <h3 className="text-xl font-bold">{Math.round(avgSeconds)}s</h3>
          <p className="text-muted-foreground font-medium">Avg Time / Question</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-16">
        <Link href="/dashboard">
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-muted text-foreground hover:bg-border transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </button>
        </Link>
        <Link href="/practice">
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg hover:-translate-y-0.5 transition-all">
            <Stethoscope size={20} /> Practice Again
          </button>
        </Link>
      </div>

      {/* Review Questions */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold border-b border-border pb-4">Detailed Review</h2>
        {questions.map((q, i) => (
          <div key={q.id} className="relative">
            <div className="absolute -left-4 top-6 bottom-6 w-1 rounded-full bg-border"></div>
            <div className="absolute -left-6 top-6 w-5 h-5 rounded-full border-4 border-background bg-border flex items-center justify-center text-[10px] font-bold">
              {i+1}
            </div>
            <QuestionCard 
              question={q} 
              userAnswer={answers[q.id]} 
              showFeedback={true}
              disabled={true}
            />
          </div>
        ))}
      </div>
    </PageTransition>
  );
}
