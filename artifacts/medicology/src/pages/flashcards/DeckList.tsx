import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown, FolderOpen, Upload, Settings, BarChart2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Deck, DeckOptions, SUBJECTS } from "./types";
import { Flashcard, StudyStats } from "./types";
import { SubjectIcon } from "@/components/SubjectIcon";

interface Props {
  decks: Deck[];
  cards: Flashcard[];
  allStats: Record<string, StudyStats>;
  onOpenDeck: (id: string) => void;
  onStudy: (id: string) => void;
  onCreateDeck: (name: string, subject: string) => void;
  onDeleteDeck: (id: string) => void;
  onImport: () => void;
  onOpenStats: () => void;
  onOpenOptions: (deckId: string) => void;
  onBrowse: () => void;
}

export default function DeckList({ decks, cards, allStats, onOpenDeck, onStudy, onCreateDeck, onDeleteDeck, onImport, onOpenStats, onOpenOptions, onBrowse }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("Other");
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateDeck(newName.trim(), newSubject);
    setNewName(""); setNewSubject("Other"); setShowNewDeck(false);
  };

  const totalCards = cards.length;
  const totalNew = Object.values(allStats).reduce((a, s) => a + s.new, 0);
  const totalDue = Object.values(allStats).reduce((a, s) => a + s.review, 0);

  const filtered = decks.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Flashcard Decks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{decks.length} decks · {totalCards} cards</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={onBrowse} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Card Browser">
            <Search size={18} />
          </button>
          <button onClick={onOpenStats} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Statistics">
            <BarChart2 size={18} />
          </button>
          <div className="relative shrink-0" ref={menuRef}>
            <Button onClick={() => setShowMenu(v => !v)} className="gap-1.5">
              <Plus size={16} /> New Deck <ChevronDown size={14} />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
                <button onClick={() => { setShowMenu(false); setShowNewDeck(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FolderOpen size={14} className="text-primary" />
                  </div>
                  <div><p className="font-medium">Create New Deck</p><p className="text-[11px] text-muted-foreground">Start from scratch</p></div>
                </button>
                <div className="border-t border-border" />
                <button onClick={() => { setShowMenu(false); onImport(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Upload size={14} className="text-primary" />
                  </div>
                  <div><p className="font-medium">Import Deck</p><p className="text-[11px] text-muted-foreground">Anki .apkg, CSV, text</p></div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {(totalNew > 0 || totalDue > 0) && (
        <div className="flex gap-3 p-3 bg-primary/5 border border-primary/20 rounded-2xl text-sm">
          {totalNew > 0 && <span className="text-blue-600 dark:text-blue-400 font-semibold">{totalNew} new</span>}
          {totalDue > 0 && <span className="text-green-600 dark:text-green-400 font-semibold">{totalDue} due today</span>}
        </div>
      )}

      {/* Create deck inline */}
      {showNewDeck && (
        <Card className="border-primary/40 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Create New Deck</h3>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="Deck name\u2026"
              className="w-full p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <select value={newSubject} onChange={e => setNewSubject(e.target.value)}
              className="w-full p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm">Create</Button>
              <Button variant="outline" size="sm" onClick={() => { setShowNewDeck(false); setNewName(""); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      {decks.length > 4 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search decks\u2026"
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      )}

      {/* Deck grid - Anki style table on larger screens */}
      <div className="space-y-2">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Deck</span>
          <span className="text-center w-12">New</span>
          <span className="text-center w-16">Learning</span>
          <span className="text-center w-12">Due</span>
          <span className="w-16"></span>
        </div>

        {filtered.map(deck => {
          const count = cards.filter(c => c.deckId === deck.id).length;
          const stats = allStats[deck.id] ?? { new: 0, learning: 0, review: 0 };
          const hasStudy = stats.new + stats.learning + stats.review > 0;

          return (
            <Card key={deck.id}
              className="group hover:border-primary/40 transition-all cursor-pointer hover:shadow-sm"
              onClick={() => onOpenDeck(deck.id)}>
              <CardContent className="p-3 sm:p-0">
                {/* Mobile layout */}
                <div className="flex items-center gap-3 sm:hidden">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <SubjectIcon name={deck.subject} size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{deck.name}</p>
                    <p className="text-xs text-muted-foreground">{count} cards · {deck.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {stats.new > 0 && <span className="text-blue-600 dark:text-blue-400 font-bold">{stats.new}</span>}
                    {stats.learning > 0 && <span className="text-orange-500 font-bold">{stats.learning}</span>}
                    {stats.review > 0 && <span className="text-green-600 dark:text-green-400 font-bold">{stats.review}</span>}
                  </div>
                  {hasStudy && (
                    <Button size="sm" className="h-7 text-xs px-3 shrink-0" onClick={e => { e.stopPropagation(); onStudy(deck.id); }}>Study</Button>
                  )}
                </div>

                {/* Desktop layout (Anki table style) */}
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <SubjectIcon name={deck.subject} size={15} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{deck.name}</p>
                      <p className="text-[11px] text-muted-foreground">{count} cards</p>
                    </div>
                  </div>
                  <span className="w-12 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">{stats.new || ""}</span>
                  <span className="w-16 text-center text-sm font-semibold text-orange-500">{stats.learning || ""}</span>
                  <span className="w-12 text-center text-sm font-semibold text-green-600 dark:text-green-400">{stats.review || ""}</span>
                  <div className="w-16 flex items-center justify-end gap-1">
                    {hasStudy && (
                      <Button size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); onStudy(deck.id); }}>Study</Button>
                    )}
                    <button onClick={e => { e.stopPropagation(); onOpenOptions(deck.id); }}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground">
                      <Settings size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDeleteDeck(deck.id); }}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && decks.length > 0 && (
        <p className="text-center text-muted-foreground py-8">No decks match \u201c{search}\u201d</p>
      )}
    </div>
  );
}
