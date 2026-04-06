import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Flag, RotateCcw, Keyboard, CheckCircle2, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Flashcard, Rating, DeckOptions, FLAG_COLORS } from "./types";
import { processRating, previewIntervals, renderClozeQuestion, renderClozeAnswer, sanitizeAnkiContent, isHtmlContent } from "./storage";

function CardBody({ text, className }: { text: string; className?: string }) {
  const clean = sanitizeAnkiContent(text);
  if (isHtmlContent(clean)) {
    return (
      <div
        className={cn("anki-card-html w-full", className)}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }
  return <p className={cn("whitespace-pre-wrap", className)}>{clean}</p>;
}

interface Props {
  queue: Flashcard[];
  deckName: string;
  options: DeckOptions;
  initialStats: { new: number; learning: number; review: number };
  onUpdate: (updated: Flashcard, log: { rating: Rating; timeTaken: number }) => void;
  onExit: () => void;
}

export default function StudySession({ queue: initialQueue, deckName, options, initialStats, onUpdate, onExit }: Props) {
  const [queue, setQueue] = useState<Flashcard[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ again: 0, good: 0, easy: 0, total: 0 });
  const [remaining, setRemaining] = useState({ new: initialStats.new, learning: initialStats.learning, review: initialStats.review });
  const [history, setHistory] = useState<{ card: Flashcard; rating: Rating }[]>([]);
  const startTimeRef = useRef(Date.now());
  const cardStartRef = useRef(Date.now());

  const card = queue[idx];

  const isCloze = card?.type === "cloze";

  const flip = useCallback(() => setFlipped(true), []);

  const rate = useCallback((rating: Rating) => {
    if (!card) return;
    const timeTaken = Date.now() - cardStartRef.current;
    const updated = processRating(card, rating, options);
    setHistory(h => [...h, { card, rating }]);
    onUpdate(updated, { rating, timeTaken });
    setStats(s => ({
      ...s,
      total: s.total + 1,
      again: rating === "again" ? s.again + 1 : s.again,
      good: rating === "good" || rating === "easy" ? s.good + 1 : s.good,
      easy: rating === "easy" ? s.easy + 1 : s.easy,
    }));
    setRemaining(r => ({
      new: card.state === "new" ? Math.max(0, r.new - 1) : r.new,
      learning: card.state === "learning" || card.state === "relearning" ? Math.max(0, r.learning - 1) : r.learning,
      review: card.state === "review" ? Math.max(0, r.review - 1) : r.review,
    }));

    if (updated.state === "learning" || updated.state === "relearning") {
      setQueue(q => {
        const rest = q.filter((_, i) => i !== idx);
        const insertAt = Math.min(rest.length, 3);
        return [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
      });
    } else {
      setQueue(q => q.filter((_, i) => i !== idx));
    }

    if (idx >= queue.length - 1) {
      setDone(true);
    } else {
      setFlipped(false);
      cardStartRef.current = Date.now();
    }
  }, [card, idx, options, onUpdate, queue.length]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setQueue(q => [last.card, ...q.filter(c => c.id !== last.card.id)]);
    setIdx(0);
    setFlipped(false);
    setDone(false);
  }, [history]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (done) { if (e.key === "Enter") onExit(); return; }
      if (!flipped) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      } else {
        if (e.key === "1") rate("again");
        else if (e.key === "2") rate("hard");
        else if (e.key === "3") rate("good");
        else if (e.key === "4") rate("easy");
        else if (e.key === " ") { e.preventDefault(); }
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) undo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, done, flip, rate, undo, onExit]);

  if (done || queue.length === 0) {
    const totalTime = Math.round((Date.now() - startTimeRef.current) / 1000);
    const accuracy = stats.total > 0 ? Math.round((stats.good / stats.total) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-in fade-in">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-muted-foreground">Great work on <span className="font-semibold text-foreground">{deckName}</span></p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Cards reviewed", value: stats.total, color: "text-primary" },
            { label: "Accuracy", value: `${accuracy}%`, color: accuracy >= 80 ? "text-green-500" : accuracy >= 50 ? "text-yellow-500" : "text-red-500" },
            { label: "Time spent", value: totalTime < 60 ? `${totalTime}s` : `${Math.round(totalTime / 60)}m`, color: "text-blue-500" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <XCircle size={16} className="text-red-500 shrink-0" />
            <div><p className="font-semibold text-red-600 dark:text-red-400">{stats.again}</p><p className="text-xs text-muted-foreground">Again</p></div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
            <div><p className="font-semibold text-green-600 dark:text-green-400">{stats.good}</p><p className="text-xs text-muted-foreground">Good</p></div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
            <div><p className="font-semibold text-blue-600 dark:text-blue-400">{stats.easy}</p><p className="text-xs text-muted-foreground">Easy</p></div>
          </div>
        </div>
        <Button className="w-full" onClick={onExit}>Back to Decks</Button>
      </div>
    );
  }

  const intervals = previewIntervals(card, options);

  return (
    <div className="space-y-4 animate-in fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} /> {deckName}
        </button>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button onClick={undo} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors" title="Undo (Ctrl+Z)">
              <RotateCcw size={12} /> Undo
            </button>
          )}
          <button onClick={() => setShowKeys(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Keyboard size={15} />
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <AnimatePresence>
        {showKeys && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="text-xs text-muted-foreground bg-muted rounded-xl px-4 py-2 flex gap-4 flex-wrap">
            <span><kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono">Space</kbd> Flip</span>
            <span><kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono">1</kbd> Again</span>
            <span><kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono">2</kbd> Hard</span>
            <span><kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono">3</kbd> Good</span>
            <span><kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono">4</kbd> Easy</span>
            <span><kbd className="bg-background border border-border rounded px-1.5 py-0.5 font-mono">Ctrl+Z</kbd> Undo</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress counts */}
      <div className="flex items-center gap-3 text-xs justify-center">
        <span className="text-blue-600 dark:text-blue-400 font-semibold">{remaining.new} new</span>
        <span className="text-orange-500 font-semibold">{remaining.learning + queue.filter(c => c.state === "learning" || c.state === "relearning").length} learning</span>
        <span className="text-green-600 dark:text-green-400 font-semibold">{remaining.review} review</span>
        <span className="text-muted-foreground ml-auto">{idx + 1}/{queue.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((stats.total) / (stats.total + queue.length)) * 100}%` }} />
      </div>

      {/* Card */}
      <div className="relative min-h-64 cursor-pointer" style={{ perspective: "1000px" }} onClick={!flipped ? flip : undefined}>
        <AnimatePresence mode="wait">
          <motion.div key={card.id + (flipped ? "-back" : "-front")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <Card className={cn("border-2 min-h-64 transition-colors", flipped ? "border-green-400/40" : "border-primary/30 hover:border-primary/60")}>
              <CardContent className="p-6 flex flex-col items-center justify-center min-h-64 text-center relative">
                {/* Flag indicator */}
                {card.flag !== 0 && (
                  <Flag size={14} className={cn("absolute top-3 right-3", FLAG_COLORS[card.flag])} fill="currentColor" />
                )}
                {/* Tags */}
                {card.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap justify-center mb-3">
                    {card.tags.map(t => (
                      <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
                {/* State badge */}
                <Badge variant="outline" className="mb-3 text-xs">
                  {flipped ? "Answer" : card.state === "new" ? "New" : card.state === "learning" ? "Learning" : card.state === "relearning" ? "Relearning" : "Review"}
                </Badge>

                {/* Front / Back content */}
                {!flipped ? (
                  <div className="space-y-3 w-full">
                    {isCloze ? (
                      <div className="text-xl font-semibold leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderClozeQuestion(sanitizeAnkiContent(card.front)) }} />
                    ) : (
                      <>
                        {card.image && <img src={card.image} alt="" className="max-h-32 object-contain rounded-lg mx-auto" />}
                        <CardBody text={card.front} className="text-xl font-semibold leading-relaxed" />
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">{isCloze ? "Recall the missing term" : "Tap to reveal answer"} · Space</p>
                  </div>
                ) : (
                  <div className="space-y-3 w-full">
                    {isCloze ? (
                      <>
                        <div className="text-lg leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderClozeAnswer(sanitizeAnkiContent(card.front)) }} />
                        {card.back && (
                          <div className="border-t border-border pt-3 mt-3 text-sm text-muted-foreground">
                            <CardBody text={card.back} />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <CardBody text={card.front} className="text-sm text-muted-foreground line-clamp-3 mb-1" />
                        <div className="border-t border-border pt-3 mt-2">
                          <CardBody text={card.back} className="text-xl font-semibold leading-relaxed" />
                        </div>
                      </>
                    )}
                    {card.note && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-left">
                        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Note</p>
                        <p className="text-muted-foreground">{card.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rating buttons */}
      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {([
            { r: "again" as Rating, label: "Again", color: "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400", key: "1" },
            { r: "hard" as Rating, label: "Hard", color: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400", key: "2" },
            { r: "good" as Rating, label: "Good", color: "bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400", key: "3" },
            { r: "easy" as Rating, label: "Easy", color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400", key: "4" },
          ]).map(({ r, label, color, key }) => (
            <button
              key={r}
              onClick={() => rate(r)}
              className={cn("flex flex-col items-center py-3 px-2 rounded-2xl border font-medium transition-all active:scale-95", color)}
            >
              <span className="text-sm">{label}</span>
              <span className="text-[10px] opacity-70 mt-0.5">{intervals[r]}</span>
              <span className="text-[9px] opacity-40 mt-0.5">[{key}]</span>
            </button>
          ))}
        </div>
      ) : (
        <Button className="w-full" onClick={flip} size="lg">
          Show Answer <span className="ml-2 text-xs opacity-70">[Space]</span>
        </Button>
      )}
    </div>
  );
}
