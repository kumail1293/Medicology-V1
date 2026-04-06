import { useMemo } from "react";
import { ArrowLeft, TrendingUp, Calendar, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flashcard, ReviewLog, Deck } from "./types";
import { todayStr } from "./storage";

interface Props {
  cards: Flashcard[];
  decks: Deck[];
  logs: ReviewLog[];
  onBack: () => void;
}

export default function StatsView({ cards, decks, logs, onBack }: Props) {
  const today = todayStr();

  const last30 = useMemo(() => {
    const map: Record<string, { again: number; good: number; total: number }> = {};
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const s = d.toISOString().split("T")[0];
      days.push(s);
      map[s] = { again: 0, good: 0, total: 0 };
    }
    logs.forEach(l => {
      if (map[l.date]) {
        map[l.date].total++;
        if (l.rating === "again") map[l.date].again++;
        else map[l.date].good++;
      }
    });
    return days.map(d => ({ date: d, label: d.slice(5).replace("-", "/"), ...map[d] }));
  }, [logs]);

  const forecast = useMemo(() => {
    const map: Record<string, number> = {};
    cards.filter(c => c.state === "review").forEach(c => {
      map[c.nextReviewDate] = (map[c.nextReviewDate] ?? 0) + 1;
    });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const s = d.toISOString().split("T")[0];
      return { date: s.slice(5).replace("-", "/"), count: map[s] ?? 0, isToday: s === today };
    });
  }, [cards, today]);

  const heatmap = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => { map[l.date] = (map[l.date] ?? 0) + 1; });
    const weeks: { date: string; count: number }[][] = [];
    const start = new Date(); start.setDate(start.getDate() - 6 * 7);
    let week: { date: string; count: number }[] = [];
    for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const s = d.toISOString().split("T")[0];
      week.push({ date: s, count: map[s] ?? 0 });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) weeks.push(week);
    return weeks;
  }, [logs]);

  const totalReviews = logs.length;
  const todayReviews = logs.filter(l => l.date === today).length;
  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    while (true) {
      const ds = d.toISOString().split("T")[0];
      if (!logs.find(l => l.date === ds)) break;
      s++; d.setDate(d.getDate() - 1);
    }
    return s;
  }, [logs]);

  const mature = cards.filter(c => c.state === "review" && c.interval >= 21).length;
  const young = cards.filter(c => c.state === "review" && c.interval < 21).length;
  const learning = cards.filter(c => c.state === "learning" || c.state === "relearning").length;
  const unseen = cards.filter(c => c.state === "new").length;
  const suspended = cards.filter(c => c.suspended).length;

  const heatColor = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count < 10) return "bg-green-200 dark:bg-green-900";
    if (count < 25) return "bg-green-400 dark:bg-green-700";
    if (count < 50) return "bg-green-500 dark:bg-green-600";
    return "bg-green-600 dark:bg-green-500";
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-bold">Statistics</h1>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today", value: todayReviews, icon: <Calendar size={16} />, color: "text-primary" },
          { label: "Streak", value: `${streak}d`, icon: <TrendingUp size={16} />, color: "text-orange-500" },
          { label: "Total reviews", value: totalReviews, icon: <Target size={16} />, color: "text-green-600 dark:text-green-400" },
          { label: "Mature cards", value: mature, icon: <Calendar size={16} />, color: "text-blue-600 dark:text-blue-400" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
            <div className={cn("shrink-0", s.color)}>{s.icon}</div>
            <div><p className={cn("text-xl font-bold", s.color)}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Card state breakdown */}
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Card States</h3>
        <div className="space-y-2">
          {[
            { label: "New", count: unseen, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
            { label: "Learning", count: learning, color: "bg-orange-400", textColor: "text-orange-500" },
            { label: "Young", count: young, color: "bg-green-400", textColor: "text-green-500" },
            { label: "Mature", count: mature, color: "bg-green-600", textColor: "text-green-700 dark:text-green-400" },
            { label: "Suspended", count: suspended, color: "bg-muted-foreground", textColor: "text-muted-foreground" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16 shrink-0">{s.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", s.color)}
                  style={{ width: `${cards.length > 0 ? (s.count / cards.length) * 100 : 0}%` }} />
              </div>
              <span className={cn("text-xs font-semibold w-8 text-right", s.textColor)}>{s.count}</span>
            </div>
          ))}
        </div>
      </CardContent></Card>

      {/* Review heatmap */}
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Review Activity (6 weeks)</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-1" style={{ minWidth: "320px" }}>
            {heatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map(day => (
                  <div key={day.date} title={`${day.date}: ${day.count} reviews`}
                    className={cn("w-3.5 h-3.5 rounded-sm transition-colors cursor-default", heatColor(day.count), day.date === today && "ring-1 ring-primary")} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          {["bg-muted","bg-green-200 dark:bg-green-900","bg-green-400 dark:bg-green-700","bg-green-600 dark:bg-green-500"].map((c, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-sm", c)} />
          ))}
          <span>More</span>
        </div>
      </CardContent></Card>

      {/* Daily reviews bar chart */}
      {totalReviews > 0 && (
        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Daily Reviews (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={last30} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={6} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: any, name: string) => [v, name === "good" ? "Correct" : "Again"]} labelStyle={{ fontSize: 11 }} />
              <Bar dataKey="good" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="again" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}

      {/* Forecast */}
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Due Forecast (Next 14 Days)</h3>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={forecast} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip labelStyle={{ fontSize: 11 }} formatter={(v: any) => [v, "Due"]} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {forecast.map((entry, i) => (
                <Cell key={i} fill={entry.isToday ? "#0ea5e9" : "#6366f1"} fillOpacity={entry.isToday ? 1 : 0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>
    </div>
  );
}
