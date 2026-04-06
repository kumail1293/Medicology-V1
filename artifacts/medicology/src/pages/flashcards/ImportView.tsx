import { useState, useRef } from "react";
import { ArrowLeft, Upload, FileText, Table, Type, FolderOpen, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Flashcard, Deck, SUBJECTS } from "./types";
import { sm2Defaults, todayStr } from "./storage";

type ImportTab = "anki" | "ankitext" | "csv" | "manual";

interface Props {
  decks: Deck[];
  defaultDeckId: string;
  onImport: (cards: Flashcard[], deck?: Omit<Deck, "id">) => void;
  onBack: () => void;
}

interface Preview { front: string; back: string; }

export default function ImportView({ decks, defaultDeckId, onImport, onBack }: Props) {
  const [tab, setTab] = useState<ImportTab>("anki");
  const [deckId, setDeckId] = useState(defaultDeckId);
  const [newDeckName, setNewDeckName] = useState("");
  const [subject, setSubject] = useState("Other");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [rawText, setRawText] = useState("");
  const [manualFront, setManualFront] = useState("");
  const [manualBack, setManualBack] = useState("");
  const [manualList, setManualList] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const makeCard = (front: string, back: string, deckIdToUse: string): Flashcard => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    front: front.trim(), back: back.trim(),
    subject, deckId: deckIdToUse,
    type: /\{\{c\d+::/.test(front) ? "cloze" : "basic",
    tags: [], flag: 0, suspended: false,
    createdAt: new Date().toISOString(),
    ...sm2Defaults(),
  });

  const getTargetDeckId = (): string => deckId === "__new__" ? `deck_${Date.now()}` : deckId;

  const handleFinish = (cards: Flashcard[]) => {
    if (cards.length === 0) { setError("No cards to import"); return; }
    const newDeck = deckId === "__new__" && newDeckName.trim()
      ? { name: newDeckName.trim(), subject, description: "", createdAt: new Date().toISOString() } as Omit<Deck, "id">
      : undefined;
    onImport(cards, newDeck);
    toast({ title: `Imported ${cards.length} cards` });
  };

  /* ── Anki .apkg parsing ─────────────────────────────────────────── */
  const parseApkg = async (file: File) => {
    setLoading(true); setError("");
    try {
      const JSZip = (await import("jszip")).default;
      const initSqlJs = (await import("sql.js")).default;
      const wasmPath = "/sql-wasm.wasm";
      const SQL = await initSqlJs({ locateFile: () => wasmPath });

      const zip = await JSZip.loadAsync(file);
      const dbFile = zip.file("collection.anki2") || zip.file("collection.anki21");
      if (!dbFile) throw new Error("collection.anki2 not found in package");

      const dbBuf = await dbFile.async("arraybuffer");
      const db = new SQL.Database(new Uint8Array(dbBuf));
      const res = db.exec("SELECT flds FROM notes");
      if (!res.length || !res[0].values.length) throw new Error("No notes found");

      const rawCards = res[0].values.map((row: any[]) => {
        const [front, back] = String(row[0] ?? "").split("\x1f");
        return { front: front || "", back: back || "" };
      }).filter((c: { front: string; back: string }) => c.front);

      setPreviews(rawCards.slice(0, 5));
      const tid = getTargetDeckId();
      handleFinish(rawCards.map((c: { front: string; back: string }) => makeCard(c.front, c.back, tid)));
      db.close();
    } catch (e: any) {
      setError(`Failed to parse Anki package: ${e.message}`);
    } finally { setLoading(false); }
  };

  /* ── Anki text format ───────────────────────────────────────────── */
  const parseAnkiText = () => {
    const lines = rawText.trim().split("\n").filter(l => !l.startsWith("#") && l.includes("\t"));
    const cards = lines.map(l => { const [front, back] = l.split("\t"); return { front, back: back || "" }; }).filter(c => c.front);
    if (!cards.length) { setError("No valid tab-separated lines found"); return; }
    setPreviews(cards.slice(0, 5));
    const tid = getTargetDeckId();
    handleFinish(cards.map(c => makeCard(c.front, c.back, tid)));
  };

  /* ── CSV ────────────────────────────────────────────────────────── */
  const parseCsv = () => {
    const lines = rawText.trim().split("\n");
    const cards: Preview[] = [];
    for (const line of lines) {
      const [front, back] = line.split(",").map(s => s.replace(/^"|"$/g, "").trim());
      if (front && back) cards.push({ front, back });
    }
    if (!cards.length) { setError("No valid CSV rows found"); return; }
    setPreviews(cards.slice(0, 5));
    const tid = getTargetDeckId();
    handleFinish(cards.map(c => makeCard(c.front, c.back, tid)));
  };

  const addManual = () => {
    if (!manualFront.trim()) return;
    setManualList(l => [...l, { front: manualFront.trim(), back: manualBack.trim() }]);
    setManualFront(""); setManualBack("");
  };

  const TABS: { id: ImportTab; label: string; icon: React.ReactNode }[] = [
    { id: "anki", label: "Anki Package", icon: <Upload size={13} /> },
    { id: "ankitext", label: "Anki Text", icon: <FileText size={13} /> },
    { id: "csv", label: "CSV", icon: <Table size={13} /> },
    { id: "manual", label: "Manual", icon: <Type size={13} /> },
  ];

  return (
    <div className="space-y-5 animate-in fade-in max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-bold font-display">Import Deck</h1>
      </div>

      {/* Deck selector */}
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Import into Deck</h3>
        <select value={deckId} onChange={e => setDeckId(e.target.value)}
          className="w-full p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
          {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          <option value="__new__">+ Create new deck</option>
        </select>
        {deckId === "__new__" && (
          <div className="grid grid-cols-2 gap-3">
            <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="New deck name\u2026"
              className="p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <select value={subject} onChange={e => setSubject(e.target.value)}
              className="p-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </CardContent></Card>

      {/* Format tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-2xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(""); setPreviews([]); setRawText(""); }}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium transition-all",
              tab === t.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "anki" && (
        <Card><CardContent className="p-5 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Anki Package (.apkg)</h3>
            <p className="text-sm text-muted-foreground">Export a deck from Anki desktop and upload the .apkg file here.</p>
          </div>
          <input ref={fileRef} type="file" accept=".apkg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseApkg(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-border rounded-2xl hover:border-primary/50 hover:bg-muted/30 transition-all">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Parsing\u2026</div>
            ) : (
              <>
                <Upload size={28} className="text-muted-foreground" />
                <div className="text-center"><p className="font-medium">Drop .apkg file or click to browse</p><p className="text-xs text-muted-foreground mt-1">Supports Anki 2.0, 2.1 packages</p></div>
              </>
            )}
          </button>
        </CardContent></Card>
      )}

      {tab === "ankitext" && (
        <Card><CardContent className="p-5 space-y-3">
          <div>
            <h3 className="font-semibold mb-1">Anki Text Export</h3>
            <p className="text-sm text-muted-foreground">Paste the content of an Anki .txt export (tab-separated front/back per line).</p>
          </div>
          <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={8}
            className="w-full p-3 border border-border rounded-xl bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={"Front question\tBack answer\nAnother front\tAnother back"} />
          <Button onClick={parseAnkiText} className="w-full" disabled={!rawText.trim()}>Import Cards</Button>
        </CardContent></Card>
      )}

      {tab === "csv" && (
        <Card><CardContent className="p-5 space-y-3">
          <div>
            <h3 className="font-semibold mb-1">CSV Format</h3>
            <p className="text-sm text-muted-foreground">Paste CSV data. Each row: <code className="bg-muted px-1 rounded text-xs">front,back</code></p>
          </div>
          <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={8}
            className="w-full p-3 border border-border rounded-xl bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={"What is ATP?,Adenosine triphosphate\nWhere is insulin produced?,Pancreatic beta cells"} />
          <Button onClick={parseCsv} className="w-full" disabled={!rawText.trim()}>Import Cards</Button>
        </CardContent></Card>
      )}

      {tab === "manual" && (
        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-semibold">Add Cards Manually</h3>
          <div className="space-y-2">
            <textarea value={manualFront} onChange={e => setManualFront(e.target.value)} rows={3} placeholder="Front (question / term)\u2026"
              className="w-full p-3 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <textarea value={manualBack} onChange={e => setManualBack(e.target.value)} rows={3} placeholder="Back (answer / definition)\u2026"
              className="w-full p-3 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <Button variant="outline" onClick={addManual} disabled={!manualFront.trim()} className="w-full">Add Card</Button>
          </div>
          {manualList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">{manualList.length} card{manualList.length !== 1 ? "s" : ""} ready</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {manualList.map((c, i) => (
                  <div key={i} className="text-xs p-2 bg-muted rounded-lg flex items-start gap-2">
                    <CheckCircle2 size={11} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="truncate">{c.front}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => { const tid = getTargetDeckId(); handleFinish(manualList.map(c => makeCard(c.front, c.back, tid))); }}>
                Save {manualList.length} Cards
              </Button>
            </div>
          )}
        </CardContent></Card>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {previews.length > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview (first {previews.length} cards)</p>
          {previews.map((p, i) => (
            <div key={i} className="text-xs p-2.5 bg-muted rounded-xl">
              <p className="font-medium">{p.front.slice(0, 60)}{p.front.length > 60 ? "\u2026" : ""}</p>
              <p className="text-muted-foreground mt-0.5">{p.back.slice(0, 60)}{p.back.length > 60 ? "\u2026" : ""}</p>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
