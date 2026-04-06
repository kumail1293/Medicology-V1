import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/layout";
import { Trophy, Medal, Users, BookOpen, Target } from "lucide-react";
import { clsx } from "clsx";

type LeaderboardEntry = {
  rank: number;
  userId: number;
  name: string;
  college: string;
  university?: string;
  accuracy: number;
  questionsSolved: number;
  rewardPoints: number;
};

type Filter = "all" | "university" | "subject";

const SUBJECTS = [
  "Anatomy", "Physiology", "Biochemistry", "Pathology",
  "Pharmacology", "Microbiology", "Medicine", "Surgery",
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="w-8 h-8 flex items-center justify-center text-sm font-bold text-muted-foreground tabular-nums">
      {rank}
    </span>
  );
}

function AvatarCircle({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
    "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0", color)}>
      {initials || "?"}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 animate-pulse">
      <div className="w-8 h-6 bg-muted rounded" />
      <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-muted rounded w-32" />
        <div className="h-3 bg-muted rounded w-48" />
      </div>
      <div className="text-right space-y-1.5">
        <div className="h-3.5 bg-muted rounded w-14 ml-auto" />
        <div className="h-3 bg-muted rounded w-20 ml-auto" />
      </div>
    </div>
  );
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const medals = ["🥇", "🥈", "🥉"];
  const highlights = [
    "from-yellow-50 to-amber-50 border-yellow-200 dark:from-yellow-950/30 dark:to-amber-950/30 dark:border-yellow-800/40",
    "from-slate-50 to-gray-50 border-slate-200 dark:from-slate-900/40 dark:to-gray-900/40 dark:border-slate-700/40",
    "from-orange-50 to-amber-50 border-orange-200 dark:from-orange-950/30 dark:to-amber-950/30 dark:border-orange-800/40",
  ];
  return (
    <div className={clsx("flex-1 bg-gradient-to-br rounded-2xl border p-4 text-center", highlights[entry.rank - 1])}>
      <div className="text-3xl mb-2">{medals[entry.rank - 1]}</div>
      <AvatarCircle name={entry.name} />
      <p className="font-semibold text-sm text-foreground mt-2 leading-tight line-clamp-1">{entry.name}</p>
      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">{entry.college}</p>
      <p className="text-lg font-bold text-primary">{entry.accuracy.toFixed(1)}%</p>
      <p className="text-xs text-muted-foreground">{entry.questionsSolved.toLocaleString()} solved</p>
    </div>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LeaderboardPage() {
  const { user, token } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [subject, setSubject] = useState(SUBJECTS[0]);

  const queryKey = filter === "subject"
    ? ["leaderboard", "subject", subject]
    : ["leaderboard", filter];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
      if (filter === "university" && user?.university) params.set("university", user.university);
      if (filter === "subject") params.set("subject", subject);
      const res = await fetch(`${BASE}/api/leaderboard?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not available yet");
      return res.json() as Promise<{ entries: LeaderboardEntry[] }>;
    },
    enabled: !!token,
    retry: false,
  });

  const entries: LeaderboardEntry[] = data?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const FILTERS: { id: Filter; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All Users", icon: <Users size={13} /> },
    { id: "university", label: "My University", icon: <BookOpen size={13} /> },
    { id: "subject", label: "By Subject", icon: <Target size={13} /> },
  ];

  return (
    <PageTransition className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Trophy size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Top performers across the platform</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {filter === "subject" && (
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                subject === s
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-background text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {isError && (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <p className="font-semibold text-foreground mb-1">Leaderboard coming soon</p>
          <p className="text-sm text-muted-foreground">Rankings will appear here once enough data is collected.</p>
        </div>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-semibold text-foreground mb-1">No data yet</p>
          <p className="text-sm text-muted-foreground">Start answering questions to appear on the leaderboard!</p>
        </div>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <>
          {top3.length > 0 && (
            <div className="flex gap-3">
              {top3.map((e) => (
                <PodiumCard key={e.userId} entry={e} />
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {rest.map((entry) => {
                const isMe = entry.userId === user?.id;
                return (
                  <div
                    key={entry.userId}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors",
                      isMe
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-muted/30"
                    )}
                  >
                    <div className="w-8 flex items-center justify-center">
                      <RankBadge rank={entry.rank} />
                    </div>
                    <AvatarCircle name={entry.name} />
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-sm font-semibold truncate", isMe && "text-primary")}>
                        {entry.name} {isMe && <span className="text-xs font-normal">(You)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{entry.college}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{entry.accuracy.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">{entry.questionsSolved.toLocaleString()} solved</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageTransition>
  );
}
