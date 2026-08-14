import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Archive, Globe, FileText, ArrowLeft, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";
import { richTextToPlain } from "@/lib/richText";

interface Deck {
  id: number;
  slug: string;
  name: string;
  subject: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  cardCount: number;
}

interface Card {
  id: number;
  deckId: number;
  front: string;
  back: string;
  note: string | null;
  tags: string[];
  image: string | null;
  sortOrder: number;
}

const SUBJECTS = [
  "Anatomy", "Physiology", "Biochemistry", "Pharmacology", "Pathology",
  "Microbiology", "Medicine", "Surgery", "ENT", "Ophthalmology",
  "Dermatology", "Psychiatry", "Radiology", "Gynecology & Obstetrics",
  "Pediatrics", "Forensic Medicine", "Community Medicine", "Other",
];

const emptyCard = (deckId: number): Card => ({ id: 0, deckId, front: "", back: "", note: null, tags: [], image: null, sortOrder: 0 });

export default function AdminFlashcardsPage() {
  const { toast } = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [deckModal, setDeckModal] = useState(false);
  const [deckForm, setDeckForm] = useState({ id: 0, slug: "", name: "", subject: "Other", description: "", status: "draft" as Deck["status"] });

  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardModal, setCardModal] = useState(false);
  const [cardForm, setCardForm] = useState<Card>(emptyCard(0));
  const [bulkText, setBulkText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/flashcards/admin/decks");
      if (!res.ok) throw new Error("Failed to load decks");
      const data = await res.json();
      setDecks(data.decks || []);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load decks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDecks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDeck = async (deck: Deck) => {
    setActiveDeck(deck);
    try {
      const res = await apiFetch(`/api/flashcards/admin/decks/${deck.id}/cards`);
      if (!res.ok) throw new Error("Failed to load cards");
      const data = await res.json();
      setCards(data.cards || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load cards", variant: "destructive" });
      setCards([]);
    }
  };

  /* ── Deck CRUD ──────────────────────────────────────────────────── */
  const openDeckModal = (deck?: Deck) => {
    setDeckForm(deck
      ? { id: deck.id, slug: deck.slug, name: deck.name, subject: deck.subject, description: deck.description ?? "", status: deck.status }
      : { id: 0, slug: "", name: "", subject: "Other", description: "", status: "draft" });
    setDeckModal(true);
  };

  const saveDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...deckForm, description: deckForm.description || null };
      const res = deckForm.id
        ? await apiFetch(`/api/flashcards/admin/decks/${deckForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await apiFetch("/api/flashcards/admin/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save deck");
      toast({ title: "Success", description: deckForm.id ? "Deck updated" : "Deck created" });
      setDeckModal(false);
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const archiveDeck = async (deck: Deck) => {
    if (!window.confirm(`Archive "${deck.name}"? Students will no longer see it.`)) return;
    try {
      const res = await apiFetch(`/api/flashcards/admin/decks/${deck.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Archive failed");
      toast({ title: "Success", description: "Deck archived" });
      if (activeDeck?.id === deck.id) setActiveDeck(null);
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: "Failed to archive deck", variant: "destructive" });
    }
  };

  const togglePublish = async (deck: Deck) => {
    try {
      const next = deck.status === "published" ? "draft" : "published";
      const res = await apiFetch(`/api/flashcards/admin/decks/${deck.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Success", description: next === "published" ? "Deck published — visible to students" : "Deck moved back to draft" });
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: "Failed to change status", variant: "destructive" });
    }
  };

  /* ── Card CRUD ──────────────────────────────────────────────────── */
  const openCardModal = (card?: Card) => {
    setCardForm(card ? { ...card, tags: card.tags || [] } : emptyCard(activeDeck?.id ?? 0));
    setCardModal(true);
  };

  const saveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { front: cardForm.front, back: cardForm.back, note: cardForm.note || null, tags: cardForm.tags, image: cardForm.image || null };
      const res = cardForm.id
        ? await apiFetch(`/api/flashcards/admin/cards/${cardForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await apiFetch(`/api/flashcards/admin/decks/${cardForm.deckId}/cards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save card");
      toast({ title: "Success", description: "Card saved" });
      setCardModal(false);
      if (activeDeck) await openDeck(activeDeck);
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (card: Card) => {
    if (!window.confirm("Delete this card?")) return;
    try {
      const res = await apiFetch(`/api/flashcards/admin/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Success", description: "Card deleted" });
      if (activeDeck) await openDeck(activeDeck);
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete card", variant: "destructive" });
    }
  };

  /* ── Bulk add (whole deck of cards from plain text) ─────────────── */
  const runBulk = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const cardsToAdd: { front: string; back: string }[] = [];
    let current: { front: string; back: string } | null = null;
    for (const line of lines) {
      const q = line.match(/^Q:\s*(.+)$/i);
      const a = line.match(/^A:\s*(.+)$/i);
      if (q) { current = { front: q[1], back: "" }; cardsToAdd.push(current); }
      else if (a && current) { current.back = (current.back ? current.back + "\n" : "") + a[1]; }
      else if (current) { current.back = (current.back ? current.back + "\n" : "") + line; }
      else { cardsToAdd.push({ front: line, back: "" }); }
    }
    if (cardsToAdd.length === 0) { toast({ title: "Nothing to import", description: "Add lines starting with Q: / A: or plain lines", variant: "destructive" }); return; }
    if (!activeDeck) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/flashcards/admin/decks/${activeDeck.id}/cards/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: cardsToAdd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Bulk add failed");
      toast({ title: "Success", description: `${data.inserted} card(s) added` });
      setBulkText("");
      setBulkOpen(false);
      await openDeck(activeDeck);
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Bulk add failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sortedDecks = useMemo(() => [...decks].sort((a, b) => String(a.name).localeCompare(String(b.name))), [decks]);

  const statusBadge = (s: Deck["status"]) => (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
      s === "published" ? "bg-green-500/15 text-green-600" :
      s === "archived" ? "bg-muted text-muted-foreground" :
      "bg-amber-500/15 text-amber-600")}>
      {s}
    </span>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Flashcard Decks</h2>
          <p className="text-sm text-muted-foreground">Create official decks with rich content — tables, images and flowcharts. Students sync them into their study system.</p>
        </div>
        <button onClick={() => openDeckModal()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus size={16} /> New Deck
        </button>
      </div>

      {/* Deck list */}
      <div className="space-y-2">
        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading decks…</p>}
        {!loading && sortedDecks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No decks yet. Create your first deck above.</p>
        )}
        {sortedDecks.map((deck) => (
          <div key={deck.id}
            className={cn("flex items-center gap-3 rounded-xl border border-border p-3 transition-colors",
              activeDeck?.id === deck.id ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40")}>
            <button onClick={() => void openDeck(deck)} className="flex flex-1 items-center gap-3 text-left min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{deck.name} {statusBadge(deck.status)}</p>
                <p className="truncate text-xs text-muted-foreground">{deck.subject} · {deck.cardCount} cards{deck.description ? ` · ${deck.description}` : ""}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => void togglePublish(deck)} title={deck.status === "published" ? "Unpublish" : "Publish"}
                className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground">
                <Globe size={15} className={cn(deck.status === "published" && "text-green-500")} />
              </button>
              <button onClick={() => openDeckModal(deck)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground" title="Edit">
                <Pencil size={15} />
              </button>
              <button onClick={() => void archiveDeck(deck)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive" title="Archive">
                <Archive size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Active deck: cards */}
      {activeDeck && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveDeck(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><ArrowLeft size={16} /></button>
              <div>
                <h3 className="font-semibold">{activeDeck.name}</h3>
                <p className="text-xs text-muted-foreground">{cards.length} cards</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBulkOpen(v => !v)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Bulk add</button>
              <button onClick={() => openCardModal()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
                <Plus size={13} /> Add card
              </button>
            </div>
          </div>

          {bulkOpen && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">One card per block — lines starting with <code className="rounded bg-muted px-1">Q:</code> start a card, <code className="rounded bg-muted px-1">A:</code> lines become the answer. Plain lines become cards too.</p>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6}
                placeholder={"Q: What is the powerhouse of the cell?\nA: The mitochondria.\n\nQ: Most common cause of community-acquired pneumonia?\nA: Streptococcus pneumoniae"}
                className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm" />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setBulkOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
                <button onClick={() => void runBulk()} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  {saving ? "Adding…" : "Add cards"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {cards.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No cards yet.</p>}
            {cards.map((card) => (
              <div key={card.id} className="group flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/40">
                <FileText size={15} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{richTextToPlain(card.front)}</p>
                  <p className="truncate text-xs text-muted-foreground">{richTextToPlain(card.back) || "—"}</p>
                  {card.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {card.tags.map((t) => <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => openCardModal(card)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={14} /></button>
                  <button onClick={() => void deleteCard(card)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deck modal */}
      {deckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-semibold">{deckForm.id ? "Edit Deck" : "New Deck"}</h3>
            <form onSubmit={saveDeck} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <input required value={deckForm.name} onChange={(e) => setDeckForm({ ...deckForm, name: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Slug</label>
                  <input required value={deckForm.slug} onChange={(e) => setDeckForm({ ...deckForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="usmle-pharmacology" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Subject</label>
                  <select value={deckForm.subject} onChange={(e) => setDeckForm({ ...deckForm, subject: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Status</label>
                  <select value={deckForm.status} onChange={(e) => setDeckForm({ ...deckForm, status: e.target.value as Deck["status"] })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <input value={deckForm.description} onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDeckModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save Deck"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card modal */}
      {cardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{cardForm.id ? "Edit Card" : "New Card"}</h3>
              <button onClick={() => setCardModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={saveCard} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Front · Question / Term</label>
                <RichTextEditor value={cardForm.front} onChange={(html) => setCardForm({ ...cardForm, front: html })} placeholder="Question / term — tables, images, flowcharts…" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Back · Answer / Definition</label>
                <RichTextEditor value={cardForm.back} onChange={(html) => setCardForm({ ...cardForm, back: html })} placeholder="Answer / definition…" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Note (optional)</label>
                <RichTextEditor value={cardForm.note ?? ""} onChange={(html) => setCardForm({ ...cardForm, note: html || null })} placeholder="Mnemonic or extra context…" minHeight={80} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Image URL (optional)</label>
                <input value={cardForm.image ?? ""} onChange={(e) => setCardForm({ ...cardForm, image: e.target.value || null })} placeholder="https://… or /api/storage/uploads/…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tags (comma separated)</label>
                <input value={cardForm.tags.join(", ")} onChange={(e) => setCardForm({ ...cardForm, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="cardiology, first-line" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCardModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  <CheckCircle2 size={14} /> {saving ? "Saving…" : "Save Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
