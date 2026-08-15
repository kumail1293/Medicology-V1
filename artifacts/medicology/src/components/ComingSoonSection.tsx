import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Clock, Users, Bell, BellRing } from "lucide-react";
import { clsx } from "clsx";
import { ComingSoonEntry, COMING_SOON_CATEGORY_LABELS, listComingSoon, notifyComingSoon } from "@/lib/comingSoon";

const CATEGORY_EMOJI: Record<string, string> = {
  exam: "🎓",
  qbank: "📚",
  feature: "✨",
  program: "📦",
  resource: "🚀",
};

export function ComingSoonSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ComingSoonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    listComingSoon()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || entries.length === 0) return null;

  const notify = async (entry: ComingSoonEntry) => {
    let email: string | undefined;
    if (!user) {
      email = window.prompt(`Enter your email to be notified when "${entry.name}" goes live:`) ?? "";
      if (!email.trim()) return;
    }
    setBusy(entry.id);
    try {
      const res = await notifyComingSoon(entry.id, email);
      setNotified((prev) => ({ ...prev, [entry.id]: true }));
      toast({
        title: res.alreadyRegistered ? "Already registered" : "You're on the list!",
        description: res.alreadyRegistered
          ? `You'll be notified when "${entry.name}" goes live.`
          : `We'll email you when "${entry.name}" launches.`,
      });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not register interest", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Coming Soon</h2>
          <p className="text-sm text-muted-foreground">Exams, QBanks and features we're building — tell us you want them.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const done = notified[entry.id];
          return (
            <div key={entry.id} className="flex flex-col rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{entry.icon || CATEGORY_EMOJI[entry.category]}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {COMING_SOON_CATEGORY_LABELS[entry.category]}
                </span>
              </div>
              <h3 className="mt-2 font-semibold">{entry.name}</h3>
              {entry.audience && <p className="text-xs text-muted-foreground">For {entry.audience}</p>}
              {entry.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {entry.expectedRelease && (
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {new Date(entry.expectedRelease).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
                )}
                {(entry.interestCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1"><Users size={12} /> {entry.interestCount} interested</span>
                )}
              </div>
              {entry.notifyMe && (
                <button
                  onClick={() => notify(entry)}
                  disabled={busy === entry.id || done}
                  className={clsx(
                    "mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    done
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                  )}
                >
                  {done ? <BellRing size={14} /> : <Bell size={14} />}
                  {done ? "You're on the list" : entry.ctaLabel || "Notify Me"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
