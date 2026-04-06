import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Flashcard, Deck, DeckOptions, ReviewLog, Rating, StudyStats,
  DEFAULT_DECK_OPTIONS,
} from "./types";
import {
  loadDecks, saveDecks,
  loadOptions, saveOptions,
  getDeckOptions, buildStudyQueue, getDeckStudyStats,
  todayStr, stripHtml,
} from "./storage";
import {
  dbLoadCards, dbUpsertCard, dbDeleteCard, dbSaveCards,
  dbLoadLogs, dbAppendLog, dbTrimLogs, migrateFromLocalStorage,
} from "./db";
import DeckList from "./DeckList";
import StudySession from "./StudySession";
import CardBrowser from "./CardBrowser";
import StatsView from "./StatsView";
import EditCard from "./EditCard";
import ImportView from "./ImportView";
import DeckOptionsModal from "./DeckOptions";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type View =
  | { type: "decks" }
  | { type: "deck"; deckId: string }
  | { type: "study"; deckId: string }
  | { type: "edit"; card: Flashcard | null; deckId: string }
  | { type: "import" }
  | { type: "browser" }
  | { type: "stats" }
  | { type: "options"; deckId: string };

const SEEN_KEY = "medi_fc_seen_today_v2";

function getSeenToday(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}
function saveSeenToday(data: Record<string, string[]>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(data));
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [allOptions, setAllOptions] = useState<Record<string, DeckOptions>>({});
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [view, setView] = useState<View>({ type: "decks" });
  const [seenToday, setSeenToday] = useState<Record<string, string[]>>({});
  const { toast } = useToast();

  /* ── Load on mount ──────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      await migrateFromLocalStorage();
      const [loadedCards, loadedLogs] = await Promise.all([dbLoadCards(), dbLoadLogs()]);
      setCards(loadedCards);
      setLogs(loadedLogs);
    })();
    setDecks(loadDecks());
    setAllOptions(loadOptions());
    setSeenToday(getSeenToday());
  }, []);

  const persistDecks = useCallback((d: Deck[]) => { setDecks(d); saveDecks(d); }, []);
  const persistOptions = useCallback((o: Record<string, DeckOptions>) => { setAllOptions(o); saveOptions(o); }, []);

  /* ── Deck operations ────────────────────────────────────────────── */
  const createDeck = (name: string, subject: string): Deck => {
    const deck: Deck = { id: `deck_${Date.now()}`, name, subject, description: "", createdAt: new Date().toISOString() };
    persistDecks([...decks, deck]);
    return deck;
  };

  const deleteDeck = (id: string) => {
    if (!window.confirm("Delete this deck and all its cards?")) return;
    persistDecks(decks.filter(d => d.id !== id));
    const remaining = cards.filter(c => c.deckId !== id);
    setCards(remaining);
    dbSaveCards(remaining).catch(console.error);
    toast({ title: "Deck deleted" });
  };

  /* ── Card operations ────────────────────────────────────────────── */
  const saveCard = (card: Flashcard) => {
    const existing = cards.find(c => c.id === card.id);
    if (existing) {
      setCards(prev => prev.map(c => c.id === card.id ? card : c));
      toast({ title: "Card updated" });
    } else {
      setCards(prev => [...prev, card]);
      toast({ title: "Card saved" });
    }
    dbUpsertCard(card).catch(console.error);
    setView({ type: "deck", deckId: card.deckId });
  };

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    dbDeleteCard(id).catch(console.error);
  };

  const updateCard = (card: Flashcard) => {
    setCards(prev => prev.map(c => c.id === card.id ? card : c));
    dbUpsertCard(card).catch(console.error);
  };

  /* ── Study callbacks ────────────────────────────────────────────── */
  const handleRating = (updated: Flashcard, { rating, timeTaken }: { rating: Rating; timeTaken: number }) => {
    setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    dbUpsertCard(updated).catch(console.error);

    if (updated.state === "new" || (updated.state === "learning" && updated.learningStep === 0)) {
      const deck = view.type === "study" ? view.deckId : "";
      if (deck) {
        const todaySeen = { ...seenToday };
        todaySeen[deck] = [...(todaySeen[deck] ?? []), updated.id];
        setSeenToday(todaySeen);
        saveSeenToday(todaySeen);
      }
    }

    const log: ReviewLog = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cardId: updated.id, deckId: updated.deckId,
      date: todayStr(), time: Date.now(), rating,
      interval: updated.interval, ease: updated.easeFactor,
      timeTaken,
    };
    setLogs(prev => [...prev, log]);
    dbAppendLog(log).then(() => dbTrimLogs()).catch(console.error);

    if (updated.lapses >= getDeckOptions(updated.deckId, allOptions).leechThreshold && updated.lapses % 2 === 0) {
      toast({ title: `Leech detected: \u201c${updated.front.slice(0, 30)}\u2026\u201d`, description: "This card has lapsed many times. Consider editing it.", variant: "destructive" });
    }
  };

  /* ── Import ──────────────────────────────────────────────────────── */
  const handleImport = (newCards: Flashcard[], newDeck?: Omit<Deck, "id">) => {
    let deckId = newCards[0]?.deckId ?? "";
    if (newDeck) {
      const deck: Deck = { id: deckId || `deck_${Date.now()}`, ...newDeck };
      persistDecks([...decks, deck]);
      const fixed = newCards.map(c => ({ ...c, deckId: deck.id }));
      const merged = [...cards, ...fixed];
      setCards(merged);
      dbSaveCards(merged).catch(console.error);
    } else {
      const merged = [...cards, ...newCards];
      setCards(merged);
      dbSaveCards(merged).catch(console.error);
    }
    setView({ type: "decks" });
    toast({ title: `Imported ${newCards.length} cards` });
  };

  /* ── Stats helpers ──────────────────────────────────────────────── */
  const allStats: Record<string, StudyStats> = {};
  decks.forEach(d => {
    const opts = getDeckOptions(d.id, allOptions);
    allStats[d.id] = getDeckStudyStats(cards, d.id, opts, seenToday[d.id] ?? []);
  });

  /* ── Deck view (cards in deck) ──────────────────────────────────── */
  const deckCards = view.type === "deck" ? cards.filter(c => c.deckId === view.deckId) : [];
  const currentDeck = view.type === "deck" || view.type === "options" || view.type === "study"
    ? decks.find(d => d.id === (view as any).deckId)
    : null;

  /* ─────────────────────────────── RENDER ────────────────────────── */

  /* Study */
  if (view.type === "study" && currentDeck) {
    const opts = getDeckOptions(view.deckId, allOptions);
    const queue = buildStudyQueue(cards, view.deckId, opts, seenToday[view.deckId] ?? []);
    if (queue.length === 0) {
      toast({ title: "All caught up! No cards due." });
      setView({ type: "deck", deckId: view.deckId });
      return null;
    }
    return (
      <StudySession
        queue={queue}
        deckName={currentDeck.name}
        options={opts}
        initialStats={allStats[view.deckId] ?? { new: 0, learning: 0, review: 0 }}
        onUpdate={handleRating}
        onExit={() => setView({ type: "deck", deckId: view.deckId })}
      />
    );
  }

  /* Deck options modal */
  if (view.type === "options" && currentDeck) {
    return (
      <DeckOptionsModal
        deck={currentDeck}
        options={getDeckOptions(view.deckId, allOptions)}
        onSave={opts => {
          persistOptions({ ...allOptions, [view.deckId]: opts });
          toast({ title: "Options saved" });
          setView({ type: "deck", deckId: view.deckId });
        }}
        onClose={() => setView({ type: "deck", deckId: (view as any).deckId })}
      />
    );
  }

  /* Card edit */
  if (view.type === "edit") {
    return (
      <EditCard
        card={view.card}
        deckId={view.deckId}
        decks={decks}
        onSave={saveCard}
        onCancel={() => setView(view.card ? { type: "deck", deckId: view.deckId } : { type: "decks" })}
      />
    );
  }

  /* Import */
  if (view.type === "import") {
    return (
      <ImportView
        decks={decks}
        defaultDeckId={decks[0]?.id ?? ""}
        onImport={handleImport}
        onBack={() => setView({ type: "decks" })}
      />
    );
  }

  /* Browser */
  if (view.type === "browser") {
    return (
      <CardBrowser
        cards={cards}
        decks={decks}
        onUpdate={updateCard}
        onDelete={deleteCard}
        onEdit={card => setView({ type: "edit", card, deckId: card.deckId })}
        onBack={() => setView({ type: "decks" })}
      />
    );
  }

  /* Stats */
  if (view.type === "stats") {
    return (
      <StatsView
        cards={cards}
        decks={decks}
        logs={logs}
        onBack={() => setView({ type: "decks" })}
      />
    );
  }

  /* Deck detail */
  if (view.type === "deck" && currentDeck) {
    const opts = getDeckOptions(currentDeck.id, allOptions);
    const stats = allStats[currentDeck.id] ?? { new: 0, learning: 0, review: 0 };
    const hasStudy = stats.new + stats.learning + stats.review > 0;

    return (
      <div className="space-y-5 animate-in fade-in">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView({ type: "decks" })}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
              ← Decks
            </button>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-xl font-bold font-display">{currentDeck.name}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView({ type: "options", deckId: currentDeck.id })}>Options</Button>
            <Button variant="outline" size="sm" onClick={() => setView({ type: "edit", card: null, deckId: currentDeck.id })}>
              <Plus size={14} className="mr-1" /> Card
            </Button>
            {hasStudy && (
              <Button size="sm" onClick={() => setView({ type: "study", deckId: currentDeck.id })}>
                <BookOpen size={14} className="mr-1" /> Study
              </Button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "New", count: stats.new, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
            { label: "Learning", count: stats.learning, color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20" },
            { label: "Review", count: stats.review, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
          ].map(s => (
            <Card key={s.label} className={cn("border-0", s.color)}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs opacity-70">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!hasStudy && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            All cards reviewed for today! Come back tomorrow.
          </div>
        )}

        {/* Card list */}
        <div className="space-y-1.5">
          {deckCards.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <BookOpen size={36} className="mx-auto text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No cards yet</p>
              <Button variant="outline" size="sm" onClick={() => setView({ type: "edit", card: null, deckId: currentDeck.id })}>
                <Plus size={14} className="mr-1" /> Add first card
              </Button>
            </div>
          ) : (
            deckCards.map(card => (
              <div key={card.id}
                className={cn("flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 group transition-colors cursor-pointer", card.suspended && "opacity-50")}
                onClick={() => setView({ type: "edit", card, deckId: card.deckId })}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{stripHtml(card.front).replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/g, "[$1]")}</p>
                  <p className="text-xs text-muted-foreground truncate">{stripHtml(card.back)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {card.tags?.map(t => <span key={t} className="hidden sm:inline text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>)}
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                    card.state === "new" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                    card.state === "learning" || card.state === "relearning" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" :
                    "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400")}>
                    {card.state === "relearning" ? "relearn" : card.state}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  /* Deck list (home) */
  return (
    <DeckList
      decks={decks}
      cards={cards}
      allStats={allStats}
      onOpenDeck={id => setView({ type: "deck", deckId: id })}
      onStudy={id => setView({ type: "study", deckId: id })}
      onCreateDeck={(name, subject) => {
        const d = createDeck(name, subject);
        setView({ type: "deck", deckId: d.id });
      }}
      onDeleteDeck={deleteDeck}
      onImport={() => setView({ type: "import" })}
      onOpenStats={() => setView({ type: "stats" })}
      onOpenOptions={id => setView({ type: "options", deckId: id })}
      onBrowse={() => setView({ type: "browser" })}
    />
  );
}
