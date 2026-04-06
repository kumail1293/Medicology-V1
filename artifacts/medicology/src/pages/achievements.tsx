import { useState, useEffect, useRef } from "react";
import { PageTransition } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Share2, Download, Twitter, MessageCircle, Linkedin, Copy, Lock, Star, Zap, Target, Brain, Flame, BookOpen, CheckCircle, Gift, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  unlocked: boolean;
  value?: string;
  shareText?: string;
}

interface Analytics {
  totalAnswered?: number;
  totalCorrect?: number;
  avgAccuracy?: number;
  testsCompleted?: number;
  testsCreated?: number;
  avgTimePerQuestion?: number;
  streakDays?: number;
}

function computeAchievements(analytics: Analytics, sessions: any[]): Achievement[] {
  const { totalAnswered = 0, avgAccuracy = 0, testsCompleted = 0 } = analytics;
  const hasPerfect = sessions.some(s => s.totalCorrect === s.questionIds?.length && s.status === "completed" && s.questionIds?.length > 0);
  const hasHighScore = sessions.some(s => {
    const pct = s.totalCorrect && s.questionIds?.length ? Math.round((s.totalCorrect / s.questionIds.length) * 100) : 0;
    return pct >= 90;
  });

  return [
    {
      id: "first_test",
      title: "First Step",
      description: "Completed your first test",
      icon: <Trophy size={24} />,
      color: "from-yellow-400/20 to-yellow-600/10 border-yellow-500/40",
      unlocked: testsCompleted >= 1,
      value: `${testsCompleted} test${testsCompleted !== 1 ? "s" : ""} done`,
      shareText: `I completed my first test on Medicology! 🏆 Starting my medical journey! #Medicology #MBBS`,
    },
    {
      id: "first_10",
      title: "Getting Started",
      description: "Answered 10 questions",
      icon: <BookOpen size={24} />,
      color: "from-blue-400/20 to-blue-600/10 border-blue-500/40",
      unlocked: totalAnswered >= 10,
      value: `${totalAnswered} total questions`,
      shareText: `I've answered ${totalAnswered} medical questions on Medicology! 📚 #Medicology #MedStudent`,
    },
    {
      id: "century",
      title: "Century Maker",
      description: "Answered 100 questions",
      icon: <Star size={24} />,
      color: "from-purple-400/20 to-purple-600/10 border-purple-500/40",
      unlocked: totalAnswered >= 100,
      value: `${totalAnswered} questions answered`,
      shareText: `100+ questions answered on Medicology! 💯 Grinding hard for my exams! #Medicology #MBBS #MedStudent`,
    },
    {
      id: "high_scorer",
      title: "High Scorer",
      description: "Scored 90%+ on any test",
      icon: <Zap size={24} />,
      color: "from-amber-400/20 to-amber-600/10 border-amber-500/40",
      unlocked: hasHighScore,
      value: `${Math.round(avgAccuracy)}% avg accuracy`,
      shareText: `Just scored 90%+ on a Medicology test! 🔥 Top of my game! #Medicology #ExamPrep`,
    },
    {
      id: "perfect",
      title: "Perfectionist",
      description: "Scored 100% on any test",
      icon: <Target size={24} />,
      color: "from-green-400/20 to-green-600/10 border-green-500/40",
      unlocked: hasPerfect,
      value: hasPerfect ? "100% achieved!" : "Not yet",
      shareText: `Perfect score on Medicology! 🌟 100%! #Medicology #PerfectScore #MBBS`,
    },
    {
      id: "consistent",
      title: "Consistent Learner",
      description: "Completed 10 tests",
      icon: <Flame size={24} />,
      color: "from-orange-400/20 to-orange-600/10 border-orange-500/40",
      unlocked: testsCompleted >= 10,
      value: `${testsCompleted} tests completed`,
      shareText: `10 tests completed on Medicology! 🔥 Consistency is key! #Medicology #StudyHard`,
    },
    {
      id: "scholar",
      title: "Scholar",
      description: "Answered 500 questions",
      icon: <Brain size={24} />,
      color: "from-cyan-400/20 to-cyan-600/10 border-cyan-500/40",
      unlocked: totalAnswered >= 500,
      value: `${totalAnswered} questions`,
      shareText: `500+ questions answered on Medicology! 🧠 Becoming a medical scholar! #Medicology #MBBS`,
    },
    {
      id: "top_performer",
      title: "Top Performer",
      description: "Maintained 80%+ average accuracy",
      icon: <CheckCircle size={24} />,
      color: "from-teal-400/20 to-teal-600/10 border-teal-500/40",
      unlocked: avgAccuracy >= 80 && totalAnswered >= 20,
      value: `${Math.round(avgAccuracy)}% accuracy`,
      shareText: `Maintaining 80%+ accuracy on Medicology! 📈 Hard work paying off! #Medicology #TopPerformer`,
    },
  ];
}

function ShareModal({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const { toast } = useToast();
  const shareText = achievement.shareText || `I unlocked "${achievement.title}" on Medicology! ${achievement.description} 🎉 #Medicology #MedStudent`;
  const encoded = encodeURIComponent(shareText);

  const copyText = () => {
    navigator.clipboard.writeText(shareText);
    toast({ title: "Copied to clipboard!" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 space-y-5">
        <div>
          <h2 className="text-xl font-display font-extrabold">Share Achievement</h2>
          <p className="text-muted-foreground text-sm mt-1">Show the world your progress!</p>
        </div>

        {/* Achievement card preview */}
        <div className={cn("rounded-2xl p-5 bg-gradient-to-br border text-center", achievement.color)}>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 text-foreground">
            {achievement.icon}
          </div>
          <div className="font-extrabold text-lg">{achievement.title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{achievement.description}</div>
          {achievement.value && <div className="text-xs font-semibold mt-2 opacity-70">{achievement.value}</div>}
          <div className="text-xs text-primary font-bold mt-3">medicology.pk</div>
        </div>

        {/* Share text */}
        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
          {shareText}
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=${encoded}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20 text-sm font-semibold transition-colors border border-[#1DA1F2]/30"
          >
            <Twitter size={15} /> Twitter/X
          </a>
          <a
            href={`https://wa.me/?text=${encoded}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-sm font-semibold transition-colors border border-[#25D366]/30"
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://medicology.pk")}&summary=${encoded}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 text-sm font-semibold transition-colors border border-[#0A66C2]/30"
          >
            <Linkedin size={15} /> LinkedIn
          </a>
          <button
            onClick={copyText}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-sm font-semibold transition-colors border border-border"
          >
            <Copy size={15} /> Copy Text
          </button>
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const [analytics, setAnalytics] = useState<Analytics>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<Achievement | null>(null);
  const [rewardPoints, setRewardPoints] = useState<number>(0);
  const [errataCount, setErrataCount] = useState<number>(0);
  const { toast } = useToast();
  const token = localStorage.getItem("medicology_token");

  useEffect(() => {
    const load = async () => {
      try {
        const [anaRes, sesRes, errRes] = await Promise.all([
          fetch("/api/progress/analytics", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/sessions", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/errata/my", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [anaData, sesData, errData] = await Promise.all([anaRes.json(), sesRes.json(), errRes.json()]);
        setAnalytics(anaData || {});
        setSessions(sesData.sessions || []);
        const errata = errData.errata || [];
        setErrataCount(errata.length);
        const totalPts = errata.reduce((sum: number, e: any) => sum + (e.rewardPoints || 0), 0);
        setRewardPoints(totalPts);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const achievements = computeAchievements(analytics, sessions);
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-muted-foreground animate-pulse">Computing achievements…</div>
    </div>
  );

  return (
    <PageTransition className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Achievements</h1>
          <p className="text-muted-foreground mt-1">{unlocked.length} of {achievements.length} unlocked</p>
        </div>
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-500/10 px-4 py-2 rounded-2xl text-sm">
          <Trophy size={16} /> {unlocked.length} / {achievements.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-muted rounded-full h-2.5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-700"
          style={{ width: `${(unlocked.length / achievements.length) * 100}%` }} />
      </div>

      {/* Reward Points Card */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Gift size={22} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Reward Points</p>
            <p className="text-2xl font-extrabold text-amber-500">{rewardPoints}</p>
            <p className="text-[10px] text-muted-foreground">from erratum reports</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Reports Filed</p>
            <p className="text-2xl font-extrabold text-red-500">{errataCount}</p>
            <p className="text-[10px] text-muted-foreground">question errors reported</p>
          </div>
        </div>
      </div>

      {/* Unlocked achievements */}
      {unlocked.length > 0 && (
        <section>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Trophy size={16} /> Unlocked ({unlocked.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {unlocked.map(ach => (
              <Card key={ach.id} className={cn("border-2 bg-gradient-to-br relative overflow-hidden hover:-translate-y-0.5 transition-all", ach.color)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/30 dark:bg-white/10 flex items-center justify-center shrink-0">
                      {ach.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-base">{ach.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{ach.description}</p>
                      {ach.value && <Badge variant="secondary" className="mt-2 text-xs">{ach.value}</Badge>}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 bg-white/30 dark:bg-white/10 border-white/20"
                      onClick={() => setShareTarget(ach)}>
                      <Share2 size={12} /> Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Locked achievements */}
      {locked.length > 0 && (
        <section>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-muted-foreground">
            <Lock size={16} /> Locked ({locked.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {locked.map(ach => (
              <Card key={ach.id} className="border border-border opacity-60 hover:opacity-80 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                      <Lock size={18} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-muted-foreground">{ach.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{ach.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {unlocked.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <p className="font-semibold text-lg mb-2">No achievements yet</p>
            <p className="text-muted-foreground text-sm">Start answering questions and completing tests to earn achievements!</p>
          </CardContent>
        </Card>
      )}

      {shareTarget && <ShareModal achievement={shareTarget} onClose={() => setShareTarget(null)} />}
    </PageTransition>
  );
}
