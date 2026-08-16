import React, { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Archive, Globe, FileText, ArrowLeft, Layers, CheckCircle2, Upload, Download, FileSpreadsheet, AlertTriangle, XCircle, Search, ChevronLeft, ChevronRight, SkipForward, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";
import { richTextToPlain } from "@/lib/richText";

// Backend errors come in two shapes: { error: "msg" } (route-level) or
// { error: { code, message } } (global error handler, e.g. body too large).
// Normalize to a string so the UI never shows "[object Object]".
function apiError(data: any, fallback: string): string {
  const e = data?.error;
  if (typeof e === "string" && e) return e;
  if (e && typeof e.message === "string" && e.message) return e.message;
  return fallback;
}

interface Deck {
  id: number;
  slug: string;
  name: string;
  subject: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  cardCount: number;
  country?: string | null;
  exam?: string | null;
  program?: string | null;
  year?: string | null;
  system?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  countryId?: number | null;
  examId?: number | null;
  programId?: number | null;
  yearId?: number | null;
  subjectId?: number | null;
  systemId?: number | null;
  topicId?: number | null;
  subtopicId?: number | null;
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
  const [deckForm, setDeckForm] = useState({ id: 0, slug: "", name: "", subject: "Other", description: "", status: "draft" as Deck["status"], exam: "", program: "", year: "", country: "", system: "", topic: "", subtopic: "" });

  // Bulk deck import
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [downloadTemplate, setDownloadTemplate] = useState<"xlsx" | "csv" | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  // Per-note-type field mapping (only for .apkg previews): mid → { front, back[] }
  // where values are field names (indices also accepted by the API).
  const [fieldMap, setFieldMap] = useState<Record<string, { front: string; back: string[] }>>({});
  // Per-card review inside the preview: edit modal target + list controls.
  const [editImportRow, setEditImportRow] = useState<any>(null); // { index, row }
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  // Baseline copy of the server-parsed rows at preview time — used to compute
  // the execute delta (only edited rows + skipped indices are sent back, not
  // the whole deck).
  const baselineRowsRef = useRef<any[] | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const PREVIEW_PAGE_SIZE = 20;

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
      ? { id: deck.id, slug: deck.slug, name: deck.name, subject: deck.subject, description: deck.description ?? "", status: deck.status, exam: deck.exam ?? "", program: deck.program ?? "", year: deck.year ?? "", country: deck.country ?? "", system: deck.system ?? "", topic: deck.topic ?? "", subtopic: deck.subtopic ?? "" }
      : { id: 0, slug: "", name: "", subject: "Other", description: "", status: "draft", exam: "", program: "", year: "", country: "", system: "", topic: "", subtopic: "" });
    setDeckModal(true);
  };

  const saveDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = { ...deckForm, description: deckForm.description || null };
      for (const key of ["exam", "program", "year", "country", "system", "topic", "subtopic"]) {
        payload[key] = deckForm[key as keyof typeof deckForm] || null;
      }
      const res = deckForm.id
        ? await apiFetch(`/api/flashcards/admin/decks/${deckForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await apiFetch("/api/flashcards/admin/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiError(data, "Failed to save deck"));
      toast({ title: "Success", description: deckForm.id ? "Deck updated" : "Deck created" });
      setDeckModal(false);
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Bulk deck import ───────────────────────────────────────────── */
  const handleImportFile = (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv|tsv|txt|apkg)$/.test(name)) {
      toast({ title: "Invalid file", description: "Use .xlsx, .xls, .csv, .tsv, .txt (Anki text) or .apkg (Anki package)", variant: "destructive" });
      return;
    }
    setImportFile(file);
    setImportPreview(null);
    setFieldMap({});
  };

  const runImportPreview = async (withFieldMap = true) => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      // Send the current per-note-type field mapping so .apkg previews respect
      // the admin's front/back choices (field picker).
      if (withFieldMap && Object.keys(fieldMap).length > 0) {
        formData.append("fieldMap", JSON.stringify(fieldMap));
      }
      const res = await apiFetch("/api/flashcards/admin/decks/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(apiError(data, "Preview failed"));
      setImportPreview(data);
      baselineRowsRef.current = (data.rows ?? []).map((r: any) => ({ ...r, data: { ...(r.data ?? {}) } }));
      // Seed the field picker from the resolved mapping (only when the user
      // hasn't already picked fields for this file).
      if (data.noteTypes?.length && Object.keys(fieldMap).length === 0) {
        const seed: Record<string, { front: string; back: string[] }> = {};
        for (const nt of data.noteTypes) {
          seed[nt.mid] = {
            front: nt.fieldNames[nt.frontIndex] ?? "",
            back: (nt.backIndices ?? []).map((i: number) => nt.fieldNames[i]).filter(Boolean),
          };
        }
        setFieldMap(seed);
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Preview failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const runImportExecute = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      // Build a small delta: only rows whose data changed from the baseline
      // (per-row edits) plus the skipped indices. The server merges these into
      // its own parsed copy — the full deck is never re-sent, so huge decks
      // (e.g. AnKing) can't exceed the request body limit.
      const baseline = baselineRowsRef.current ?? [];
      const edits: Record<number, any> = {};
      const skipped: number[] = [];
      (importPreview.rows ?? []).forEach((r: any, i: number) => {
        if (r.status === "skipped") {
          skipped.push(i);
          return;
        }
        const b = baseline[i]?.data ?? {};
        const cur = r.data ?? {};
        const changed =
          (cur.front ?? "") !== (b.front ?? "") ||
          (cur.back ?? "") !== (b.back ?? "") ||
          (cur.note ?? "") !== (b.note ?? "") ||
          JSON.stringify(cur.tags ?? []) !== JSON.stringify(b.tags ?? []);
        if (changed) edits[i] = cur;
      });
      const res = await apiFetch("/api/flashcards/admin/decks/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: importPreview.previewId,
          edits,
          skipped,
          deck: { ...importPreview.deck, slug: importPreview.deck.slug },
          createMissingTaxonomy: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiError(data, "Import failed"));
      toast({ title: "Import complete", description: `${data.inserted} card(s) in deck "${data.deck?.name ?? ""}"`, variant: data.inserted > 0 ? "default" : "destructive" });
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setEditImportRow(null);
      setPreviewSearch("");
      setPreviewPage(0);
      if (importFileRef.current) importFileRef.current.value = "";
      await loadDecks();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  /* ── Per-card review inside the import preview ───────────────────── */
  // Update one row's card fields in place (front/back/note/tags) and clear
  // its error state so it can be imported.
  const updateImportRow = (index: number, patch: Partial<any>) => {
    setImportPreview((p: any) => {
      if (!p || !p.rows[index]) return p;
      const rows = p.rows.map((r: any, i: number) => {
        if (i !== index) return r;
        const next = { ...r, data: { ...r.data, ...patch } };
        next.status = next.data.front ? "valid" : "error";
        next.messages = next.data.front ? [] : ["Missing front text"];
        return next;
      });
      return { ...p, rows };
    });
  };

  // Toggle a row in/out of the import (skipped rows keep their data but are
  // excluded from the execute step, which only imports status === 'valid').
  const toggleImportRow = (index: number) => {
    setImportPreview((p: any) => {
      if (!p || !p.rows[index]) return p;
      const rows = p.rows.map((r: any, i: number) => {
        if (i !== index) return r;
        const next = { ...r };
        if (next.status === "skipped") {
          next.status = next.data.front ? "valid" : "error";
          next.messages = next.data.front ? [] : ["Missing front text"];
        } else {
          next.status = "skipped";
        }
        return next;
      });
      return { ...p, rows };
    });
  };

  // Live counts from the (possibly edited) rows — recomputed so the summary
  // and the Create-deck button reflect skips/edits.
  const previewValid = importPreview?.rows?.filter((r: any) => r.status === "valid").length ?? 0;
  const previewSkipped = importPreview?.rows?.filter((r: any) => r.status === "skipped").length ?? 0;

  const filteredPreviewRows = (importPreview?.rows ?? []).filter((r: any) => {
    const q = previewSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = `${r.data?.front ?? ""} ${r.data?.back ?? ""} ${r.data?.tags ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
  const previewPageCount = Math.max(1, Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE));
  const safePreviewPage = Math.min(previewPage, previewPageCount - 1);
  const pageRows = filteredPreviewRows.slice(safePreviewPage * PREVIEW_PAGE_SIZE, (safePreviewPage + 1) * PREVIEW_PAGE_SIZE);

  const downloadDeckTemplate = async (format: "xlsx" | "csv") => {
    setDownloadTemplate(format);
    try {
      const res = await apiFetch(`/api/flashcards/admin/decks/template?format=${format}`);
      if (!res.ok) throw new Error("Template download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `medicology-flashcard-deck-template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast({ title: "Template ready", description: "Deck-metadata block + card rows + Guide sheet." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Template download failed", variant: "destructive" });
    } finally {
      setDownloadTemplate(null);
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
      if (!res.ok) throw new Error(apiError(data, "Failed to save card"));
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
      if (!res.ok) throw new Error(apiError(data, "Bulk add failed"));
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void downloadDeckTemplate("xlsx")}
            disabled={downloadTemplate !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <Download size={15} />
            {downloadTemplate === "xlsx" ? "Preparing…" : "Deck template"}
          </button>
          <button
            onClick={() => { setImportOpen(true); setImportFile(null); setImportPreview(null); }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            <Upload size={15} /> Bulk Import Deck
          </button>
          <button onClick={() => openDeckModal()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus size={16} /> New Deck
          </button>
        </div>
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
                <p className="truncate text-xs text-muted-foreground">
                  {[deck.country, deck.exam, deck.program, deck.year].filter(Boolean).join(" · ") || deck.subject} · {deck.cardCount} cards
                  {deck.description ? ` · ${deck.description}` : ""}
                </p>
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
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taxonomy (exam hierarchy)</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Country</label>
                    <input value={deckForm.country} onChange={(e) => setDeckForm({ ...deckForm, country: e.target.value })} placeholder="Pakistan" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam / University</label>
                    <input value={deckForm.exam} onChange={(e) => setDeckForm({ ...deckForm, exam: e.target.value })} placeholder="UHS" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Program</label>
                    <input value={deckForm.program} onChange={(e) => setDeckForm({ ...deckForm, program: e.target.value })} placeholder="MBBS" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Year</label>
                    <input value={deckForm.year} onChange={(e) => setDeckForm({ ...deckForm, year: e.target.value })} placeholder="Final Year" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">System</label>
                    <input value={deckForm.system} onChange={(e) => setDeckForm({ ...deckForm, system: e.target.value })} placeholder="Cardiovascular" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Topic</label>
                    <input value={deckForm.topic} onChange={(e) => setDeckForm({ ...deckForm, topic: e.target.value })} placeholder="Ischemic Heart Disease" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Subtopic</label>
                    <input value={deckForm.subtopic} onChange={(e) => setDeckForm({ ...deckForm, subtopic: e.target.value })} placeholder="Myocardial Infarction" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDeckModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save Deck"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Bulk Import Flashcard Deck</h3>
              <button onClick={() => setImportOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void downloadDeckTemplate("xlsx")} disabled={downloadTemplate !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary">
                  <Download size={13} /> {downloadTemplate === "xlsx" ? "Preparing…" : "Excel template (.xlsx)"}
                </button>
                <button onClick={() => void downloadDeckTemplate("csv")} disabled={downloadTemplate !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary">
                  <Download size={13} /> {downloadTemplate === "csv" ? "Preparing…" : "CSV template"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deck metadata block (name, slug, exam, program, year…) + one row per card (Front, Back, Note, Tags, Image, taxonomy).
                Anki text files (<code className="rounded bg-muted px-1">front&lt;TAB&gt;back</code> per line) and full Anki packages (<code className="rounded bg-muted px-1">.apkg</code> — e.g. AnKing decks, with images) work too.
              </p>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,.apkg"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
              {!importFile ? (
                <button onClick={() => importFileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-center hover:border-primary/40">
                  <FileSpreadsheet size={32} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Choose a file to import</p>
                    <p className="text-xs text-muted-foreground">.xlsx · .xls · .csv · .tsv · .txt (Anki text) · .apkg (Anki package)</p>
                  </div>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-4">
                  <FileSpreadsheet size={18} className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => { setImportFile(null); setImportPreview(null); if (importFileRef.current) importFileRef.current.value = ""; }} className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Remove</button>
                  <button onClick={() => void runImportPreview()} disabled={importing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                    <Upload size={13} /> {importing ? "Parsing…" : "Validate & Preview"}
                  </button>
                </div>
              )}

              {importPreview && (
                <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold">Deck: {importPreview.deck?.name}</span>
                    <span className="font-mono text-xs text-primary">{importPreview.deck?.slug}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{importPreview.deck?.subject || "Other"}</span>
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">{previewValid} ready</span>
                    {importPreview.stats?.error > 0 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600">{importPreview.stats.error} errors</span>}
                  </div>
                  {importPreview.taxonomyNotes?.length > 0 && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <div>{importPreview.taxonomyNotes.slice(0, 6).map((n: string, i: number) => <p key={i}>{n}</p>)}</div>
                    </div>
                  )}

                  {/* Per-note-type field picker (.apkg only) */}
                  {importPreview.noteTypes?.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">Field mapping — assign which Anki field becomes the card front / back per note type</p>
                        {importPreview.format === "apkg" && (
                          <button
                            onClick={() => void runImportPreview()}
                            disabled={importing}
                            className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
                            title="Re-run preview with the mapping above"
                          >
                            {importing ? "Reparsing…" : "Apply mapping"}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {importPreview.noteTypes.map((nt: any) => {
                          const entry = fieldMap[nt.mid];
                          return (
                            <div key={nt.mid} className="rounded-lg border border-border bg-background p-2.5 text-xs">
                              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{nt.name}</span>
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{nt.rowCount} note{nt.rowCount === 1 ? "" : "s"}</span>
                                {nt.isCloze && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">cloze</span>}
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Front</span>
                                  <select
                                    value={entry?.front ?? ""}
                                    onChange={(e) => setFieldMap((m) => ({ ...m, [nt.mid]: { ...(m[nt.mid] ?? { back: [] }), front: e.target.value } }))}
                                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                                  >
                                    {nt.fieldNames.map((f: string, i: number) => <option key={i} value={f}>{i}: {f}</option>)}
                                  </select>
                                </label>
                                <div>
                                  <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Back fields (multi-select)</span>
                                  <div className="flex flex-wrap gap-1">
                                    {nt.fieldNames.map((f: string, i: number) => {
                                      const selected = entry?.back?.includes(f) ?? false;
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => setFieldMap((m) => {
                                            const cur = m[nt.mid]?.back ?? [];
                                            const next = selected ? cur.filter((x: string) => x !== f) : [...cur, f];
                                            return { ...m, [nt.mid]: { ...(m[nt.mid] ?? { front: entry?.front ?? "" }), back: next } };
                                          })}
                                          className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${selected ? "border-primary/50 bg-primary/15 font-medium text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
                                        >
                                          {i}: {f}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1">
                      <Search size={13} className="shrink-0 text-muted-foreground" />
                      <input
                        value={previewSearch}
                        onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(0); }}
                        placeholder="Search front / back / tags…"
                        className="w-full bg-transparent text-xs outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <button onClick={() => setPreviewPage(Math.max(0, safePreviewPage - 1))} disabled={safePreviewPage === 0} className="rounded-lg border border-border p-1 disabled:opacity-40"><ChevronLeft size={13} /></button>
                      <span className="whitespace-nowrap">{safePreviewPage + 1}/{previewPageCount}</span>
                      <button onClick={() => setPreviewPage(Math.min(previewPageCount - 1, safePreviewPage + 1))} disabled={safePreviewPage >= previewPageCount - 1} className="rounded-lg border border-border p-1 disabled:opacity-40"><ChevronRight size={13} /></button>
                    </div>
                  </div>

                  {/* Editable row list */}
                  <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {pageRows.length === 0 && (
                      <div className="p-4 text-center text-xs text-muted-foreground">No rows match.</div>
                    )}
                    {pageRows.map((r: any) => {
                      const rowIndex = (importPreview.rows ?? []).indexOf(r);
                      const skipped = r.status === "skipped";
                      const invalid = r.status === "error";
                      return (
                        <div key={`${r.rowNumber}-${rowIndex}`} className={`flex items-start gap-2 p-2 text-xs ${skipped ? "opacity-50" : ""} ${invalid ? "bg-red-500/5" : ""}`}>
                          <div className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">{r.rowNumber}</div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 font-medium">{richTextToPlain(r.data?.front ?? "") || "<empty>"}</p>
                            <p className="line-clamp-1 text-muted-foreground">{richTextToPlain(r.data?.back ?? "") || ""}</p>
                            {invalid && <p className="text-red-500">{r.messages.join("; ")}</p>}
                            {r.data?.tags?.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {r.data.tags.slice(0, 4).map((t: string, ti: number) => (
                                  <span key={ti} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => setEditImportRow({ index: rowIndex, row: r })}
                              title="Edit this card before importing"
                              className="rounded-md border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-primary"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => toggleImportRow(rowIndex)}
                              title={skipped ? "Include in import" : "Skip this card"}
                              className={`rounded-md border p-1 ${skipped ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                            >
                              <SkipForward size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600">{previewValid} ready</span>
                      {previewSkipped > 0 && <span className="rounded-full bg-muted px-2 py-0.5">{previewSkipped} skipped</span>}
                      {(importPreview.stats?.error ?? 0) > 0 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-600">{importPreview.stats.error} need attention</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setImportPreview(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Back</button>
                      <button onClick={() => void runImportExecute()} disabled={importing || previewValid === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                        {importing ? "Importing…" : `Create deck with ${previewValid} card(s)`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-card edit modal inside the import preview */}
      {editImportRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Edit Card {editImportRow.row?.rowNumber}</h3>
              <button onClick={() => setEditImportRow(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Front · Question / Term</label>
                <RichTextEditor
                  value={editImportRow.row?.data?.front ?? ""}
                  onChange={(html) => updateImportRow(editImportRow.index, { front: html })}
                  placeholder="Question / term — tables, images, flowcharts…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Back · Answer / Definition</label>
                <RichTextEditor
                  value={editImportRow.row?.data?.back ?? ""}
                  onChange={(html) => updateImportRow(editImportRow.index, { back: html })}
                  placeholder="Answer / definition…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tags (comma separated)</label>
                <input
                  value={Array.isArray(editImportRow.row?.data?.tags) ? editImportRow.row.data.tags.join(", ") : ""}
                  onChange={(e) => updateImportRow(editImportRow.index, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="cardiology, first-line"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => toggleImportRow(editImportRow.index)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-primary"
                >
                  {editImportRow.row?.status === "skipped" ? <RotateCcw size={13} /> : <SkipForward size={13} />}
                  {editImportRow.row?.status === "skipped" ? "Include in import" : "Skip this card"}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setEditImportRow(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                  <button onClick={() => setEditImportRow(null)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                    <Save size={14} /> Done
                  </button>
                </div>
              </div>
            </div>
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
