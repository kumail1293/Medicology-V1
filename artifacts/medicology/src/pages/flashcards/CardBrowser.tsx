import { useState, useMemo } from "react";
import { ArrowLeft, Search, Flag, Trash2, RotateCcw, EyeOff, Eye, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Flashcard, Deck, CardFlag, FLAG_COLORS } from "./types";
import { stripHtml } from "./storage";
import { useToast } from "@/hooks/use-toast";

type FilterState = "all" | "new" | "learning" | "review" | "suspended";

interface Props {
  cards: Flashcard[];
  decks: Deck[];
  onUpdate: (card: Flashcard) => void;
  onDelete: (id: string) => void;
  onEdit: (card: Flashcard) => void;
  onBack: () => void;
}

export default function CardBrowser({ cards, decks, onUpdate, onDelete, onEdit, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<FilterState>("all");
  const [filterDeck, setFilterDeck] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    cards.forEach(c => c.tags?.forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [cards]);

  const deckMap = useMemo(() => Object.fromEntries(decks.map(d => [d.id, d.name])), [decks]);

  const filtered = useMemo(() => {
    let res = cards;
    if (filterDeck !== "all") res = res.filter(c => c.deckId === filterDeck);
    if (filterTag !== "all") res = res.filter(c => c.tags?.includes(filterTag));
    if (filterState !== "all") {
      if (filterState === "suspended") res = res.filter(c => c.suspended);
      else res = res.filter(c => !c.suspended && c.state === filterState);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) || c.tags?.some(t => t.toLowerCase().includes(q)));
    }
    return res;
  }, [cards, filterDeck, filterTag, filterState, search]);

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };

  const bulkSuspend = (suspend: boolean) => {
    filtered.filter(c => selected.has(c.id)).forEach(c => onUpdate({ ...c, suspended: suspend }));
    toast({ title: `${selected.size} cards ${suspend ? "suspended" : "unsuspended"}` });
    setSelected(new Set());
  };

  const bulkReset = () => {
    filtered.filter(c => selected.has(c.id)).forEach(c => onUpdate({ ...c, state: "new", interval: 1, easeFactor: 2.5, repetitions: 0, lapses: 0, learningStep: 0 }));
    toast({ title: `${selected.size} cards reset` });
    setSelected(new Set());
  };

  const bulkDelete = () => {
    filtered.filter(c => selected.has(c.id)).forEach(c => onDelete(c.id));
    toast({ title: `${selected.size} cards deleted` });
    setSelected(new Set());
  };

  const STATE_FILTERS: { id: FilterState; label: string; color: string }[] = [
    { id: "all", label: "All", color: "" },
    { id: "new", label: "New", color: "text-blue-600 dark:text-blue-400" },
    { id: "learning", label: "Learning", color: "text-orange-500" },
    { id: "review", label: "Review", color: "text-green-600 dark:text-green-400" },
    { id: "suspended", label: "Suspended", color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-xl font-bold">Card Browser</h1>
            <p className="text-xs text-muted-foreground">{filtered.length} of {cards.length} cards</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search front, back, tags\u2026"
          className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {STATE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilterState(f.id)}
              className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-all", filterState === f.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground", f.color && filterState === f.id ? f.color : "")}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={filterDeck} onChange={e => setFilterDeck(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All decks</option>
          {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm flex-wrap">
          <span className="font-semibold text-primary">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkSuspend(true)}><EyeOff size={11} /> Suspend</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkSuspend(false)}><Eye size={11} /> Unsuspend</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={bulkReset}><RotateCcw size={11} /> Reset</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10" onClick={bulkDelete}><Trash2 size={11} /> Delete</Button>
          </div>
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        <input type="checkbox" className="rounded" checked={selected.size === filtered.length && filtered.length > 0}
          onChange={selectAll} />
        <span className="flex-1">Question</span>
        <span className="hidden sm:block w-32">Deck</span>
        <span className="hidden sm:block w-16 text-center">State</span>
        <span className="hidden sm:block w-12 text-center">Due</span>
        <span className="w-16"></span>
      </div>

      {/* Card list */}
      <div className="space-y-1">
        {filtered.map(card => (
          <div key={card.id}
            className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-muted/40 group",
              selected.has(card.id) ? "bg-primary/5 border-primary/30" : "border-transparent",
              card.suspended ? "opacity-50" : "")}>
            <input type="checkbox" className="rounded shrink-0" checked={selected.has(card.id)} onChange={() => toggleSelect(card.id)} />
            {card.flag !== 0 && <Flag size={12} className={cn("shrink-0", FLAG_COLORS[card.flag as CardFlag])} fill="currentColor" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate font-medium">{stripHtml(card.front).replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/g, "[$1]")}</p>
              <p className="text-xs text-muted-foreground truncate">{stripHtml(card.back)}</p>
              {card.tags?.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {card.tags.map(t => <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{t}</span>)}
                </div>
              )}
            </div>
            <span className="hidden sm:block text-xs text-muted-foreground w-32 truncate">{deckMap[card.deckId] || "?"}</span>
            <span className="hidden sm:flex w-16 justify-center">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                card.state === "new" ? "text-blue-600 border-blue-200 dark:text-blue-400" :
                card.state === "learning" || card.state === "relearning" ? "text-orange-500 border-orange-200" :
                "text-green-600 border-green-200 dark:text-green-400")}>
                {card.state === "relearning" ? "relearn" : card.state}
              </Badge>
            </span>
            <span className="hidden sm:block text-xs text-muted-foreground w-12 text-center">
              {card.state === "review" ? card.nextReviewDate?.slice(5) : card.interval + "d"}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
              <button onClick={() => onEdit(card)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs">Edit</button>
              <button onClick={() => onDelete(card.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Filter size={32} className="mx-auto mb-3 opacity-30" />
          <p>No cards match your filters</p>
        </div>
      )}
    </div>
  );
}
