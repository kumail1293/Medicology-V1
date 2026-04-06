import { useState, useRef } from "react";
import { X, Image, Plus, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Flashcard, Deck, CardType, CardFlag, SUBJECTS, FLAG_COLORS, FLAG_LABELS } from "./types";
import { sm2Defaults } from "./storage";

interface Props {
  card: Flashcard | null;
  deckId: string;
  decks: Deck[];
  onSave: (card: Flashcard) => void;
  onCancel: () => void;
}

export default function EditCard({ card, deckId, decks, onSave, onCancel }: Props) {
  const isNew = !card?.id || !card.front;
  const [form, setForm] = useState<Flashcard>(card ?? {
    id: Date.now().toString(),
    front: "", back: "", subject: "Other", deckId,
    type: "basic", tags: [], flag: 0, suspended: false,
    createdAt: new Date().toISOString(),
    ...sm2Defaults(),
  });
  const [tagInput, setTagInput] = useState("");
  const [showFlagMenu, setShowFlagMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || form.tags.includes(t)) { setTagInput(""); return; }
    setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput("");
  };

  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Image too large (max 2MB)", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, image: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.front.trim()) { toast({ title: "Front is required", variant: "destructive" }); return; }
    if (form.type === "basic" && !form.back.trim()) { toast({ title: "Back is required", variant: "destructive" }); return; }
    onSave(form);
  };

  const set = (key: keyof Flashcard, val: any) => setForm(f => ({ ...f, [key]: val }));

  const CLOZE_HINT = `Use {{c1::answer}} for cloze deletions.\nExample: The {{c1::heart}} has {{c2::4}} chambers.`;

  return (
    <div className="space-y-4 animate-in fade-in max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-display">{isNew ? "New Card" : "Edit Card"}</h1>
        <Button variant="ghost" size="sm" onClick={onCancel}><X size={16} /></Button>
      </div>

      {/* Card type */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit text-sm">
        {(["basic", "cloze"] as CardType[]).map(t => (
          <button key={t} onClick={() => set("type", t)}
            className={cn("px-4 py-1.5 rounded-lg font-medium capitalize transition-all",
              form.type === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {/* Deck + Subject row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Deck</label>
          <select value={form.deckId} onChange={e => set("deckId", e.target.value)}
            className="w-full p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Subject</label>
          <select value={form.subject} onChange={e => set("subject", e.target.value)}
            className="w-full p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Front */}
      <div>
        <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">
          {form.type === "cloze" ? "Card Text (with cloze)" : "Front · Question / Term"}
        </label>
        {form.type === "cloze" && (
          <p className="text-xs text-muted-foreground mb-2 bg-muted/50 rounded-lg px-3 py-2 font-mono whitespace-pre">{CLOZE_HINT}</p>
        )}
        <textarea value={form.front} onChange={e => set("front", e.target.value)} rows={3}
          className="w-full p-3 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={form.type === "cloze" ? "The {{c1::mitochondria}} is the powerhouse\u2026" : "Enter question or term\u2026"} />
      </div>

      {/* Back */}
      {form.type === "basic" && (
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Back · Answer / Definition</label>
          <textarea value={form.back} onChange={e => set("back", e.target.value)} rows={4}
            className="w-full p-3 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Enter answer or definition\u2026" />
        </div>
      )}

      {/* Extra info (shown on back for cloze, optional for basic) */}
      {form.type === "cloze" && (
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Extra Info (shown with answer)</label>
          <textarea value={form.back} onChange={e => set("back", e.target.value)} rows={2}
            className="w-full p-3 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Optional extra context\u2026" />
        </div>
      )}

      {/* Private note */}
      <div>
        <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Private Note (shown during study)</label>
        <textarea value={form.note ?? ""} onChange={e => set("note", e.target.value)} rows={2}
          className="w-full p-3 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Mnemonic, tip, or extra context\u2026" />
      </div>

      {/* Image */}
      <div>
        <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Image</label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        {form.image ? (
          <div className="relative inline-block">
            <img src={form.image} alt="preview" className="max-h-40 rounded-xl object-contain border border-border" />
            <button onClick={() => set("image", undefined)} className="absolute top-1 right-1 bg-card rounded-full p-1 border border-border shadow">
              <X size={11} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center">
            <Image size={15} /> Add Image
          </button>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase tracking-wide">Tags</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {form.tags.map(t => (
            <span key={t} className="flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded-full">
              {t}
              <button onClick={() => removeTag(t)} className="hover:text-destructive transition-colors"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
            placeholder="Add tag\u2026 (Enter to add)"
            className="flex-1 p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={addTag} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors">
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Flag */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flag</label>
        <div className="relative">
          <button onClick={() => setShowFlagMenu(v => !v)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors", FLAG_COLORS[form.flag as CardFlag])}>
            <Flag size={13} fill={form.flag !== 0 ? "currentColor" : "none"} />
            {FLAG_LABELS[form.flag as CardFlag]}
          </button>
          {showFlagMenu && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden w-32">
              {([0, 1, 2, 3, 4] as CardFlag[]).map(f => (
                <button key={f} onClick={() => { set("flag", f); setShowFlagMenu(false); }}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors", FLAG_COLORS[f])}>
                  <Flag size={12} fill={f !== 0 ? "currentColor" : "none"} /> {FLAG_LABELS[f]}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground ml-auto cursor-pointer">
          <input type="checkbox" checked={form.suspended} onChange={e => set("suspended", e.target.checked)} className="rounded" />
          Suspended
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} className="flex-1">Save Card</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
