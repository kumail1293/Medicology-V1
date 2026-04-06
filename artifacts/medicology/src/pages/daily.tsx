import React, { useState } from 'react';
import { useGetDailyChallenge } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import { CalendarHeart, Flame, CheckCircle2, Play, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DailyChallenge() {
  const { data, isLoading } = useGetDailyChallenge();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);

  if (isLoading) return <div className="p-12 text-center">Loading today&apos;s challenge...</div>;

  const startChallenge = async () => {
    if (!data?.questions?.length) {
      toast({ title: 'No questions available', description: 'Check back later.', variant: 'destructive' });
      return;
    }

    setStarting(true);
    try {
      const token = localStorage.getItem('medicology_token');
      const questionIds = data.questions.map((q: { id: number }) => q.id);

      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          specificQuestionIds: questionIds,
          mode: 'tutor',
          title: `Daily Challenge — ${format(new Date(), 'MMM d, yyyy')}`,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.session) {
        toast({ title: 'Could not start challenge', description: result.error || 'Try again.', variant: 'destructive' });
        return;
      }

      setLocation(`/session/${result.session.id}`);
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  };

  return (
    <PageTransition className="max-w-3xl mx-auto py-12 text-center">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-500/10 text-orange-500 mb-8">
        <CalendarHeart size={48} />
      </div>
      <h1 className="text-4xl font-display font-extrabold mb-4">Daily Challenge</h1>
      <p className="text-xl text-muted-foreground mb-8">
        {format(new Date(), 'EEEE, MMMM do, yyyy')}
      </p>

      <div className="inline-flex items-center gap-3 bg-card px-6 py-3 rounded-full border border-border shadow-sm mb-12">
        <Flame className="text-orange-500" size={24} />
        <span className="text-lg font-bold">Current Streak: {data?.streak || 0} Days</span>
      </div>

      {data?.isCompleted ? (
        <div className="bg-green-500/10 border border-green-500/20 p-12 rounded-3xl">
          <CheckCircle2 className="mx-auto text-green-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-green-600 mb-2">Challenge Completed!</h2>
          <p className="text-muted-foreground">You&apos;ve finished today&apos;s questions. Come back tomorrow to keep your streak alive.</p>
        </div>
      ) : (
        <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
          <p className="text-lg mb-8 leading-relaxed">
            Test your knowledge with {data?.questions?.length ?? 40} curated questions. Complete the challenge to maintain your streak and climb the leaderboard.
          </p>
          <button
            onClick={startChallenge}
            disabled={starting}
            className="w-full sm:w-auto px-12 py-4 text-xl bg-orange-500 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mx-auto disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {starting
              ? <><Loader2 size={24} className="animate-spin" /> Starting…</>
              : <><Play fill="currentColor" size={24} /> Start Challenge</>
            }
          </button>
        </div>
      )}
    </PageTransition>
  );
}
