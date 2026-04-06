import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface StickyNote {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

const COLORS = [
  { id: "yellow", bg: "bg-yellow-200", border: "border-yellow-300", text: "text-yellow-900" },
  { id: "green",  bg: "bg-green-200",  border: "border-green-300",  text: "text-green-900" },
  { id: "blue",   bg: "bg-blue-200",   border: "border-blue-300",   text: "text-blue-900" },
  { id: "pink",   bg: "bg-pink-200",   border: "border-pink-300",   text: "text-pink-900" },
  { id: "purple", bg: "bg-purple-200", border: "border-purple-300", text: "text-purple-900" },
];

const STORAGE_KEY = "medicology_sticky_notes";

function loadNotes(): StickyNote[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveNotes(notes: StickyNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

interface StickyNotesProps {
  onClose: () => void;
}

export function StickyNotesPanel({ onClose }: StickyNotesProps) {
  const [notes, setNotes] = useState<StickyNote[]>(loadNotes);
  const [color, setColor] = useState("yellow");

  const update = (fn: (prev: StickyNote[]) => StickyNote[]) => {
    setNotes((prev) => { const next = fn(prev); saveNotes(next); return next; });
  };

  const addNote = () => {
    const note: StickyNote = {
      id: Date.now().toString(),
      text: "",
      color,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    update((p) => [...p, note]);
  };

  const deleteNote = (id: string) => update((p) => p.filter((n) => n.id !== id));
  const updateText = (id: string, text: string) =>
    update((p) => p.map((n) => (n.id === id ? { ...n, text } : n)));
  const updatePos = (id: string, x: number, y: number) =>
    update((p) => p.map((n) => (n.id === id ? { ...n, x, y } : n)));

  return (
    <>
      {/* Control Panel */}
      <div className="w-56 bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-yellow-400 text-yellow-900">
          <span className="text-xs font-bold">Sticky Notes</span>
          <button onClick={onClose} className="p-0.5 hover:bg-yellow-500/40 rounded transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Color</p>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform",
                    c.bg,
                    color === c.id ? "border-foreground scale-110" : "border-transparent"
                  )}
                />
              ))}
            </div>
          </div>
          <button
            onClick={addNote}
            className="w-full flex items-center justify-center gap-2 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-sm rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Note
          </button>
          {notes.length > 0 && (
            <p className="text-xs text-center text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""} on screen</p>
          )}
        </div>
      </div>

      {/* Floating Notes */}
      {notes.map((note) => (
        <DraggableNote
          key={note.id}
          note={note}
          onDelete={deleteNote}
          onTextChange={updateText}
          onMove={updatePos}
        />
      ))}
    </>
  );
}

function DraggableNote({ note, onDelete, onTextChange, onMove }: {
  note: StickyNote;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const colorObj = COLORS.find((c) => c.id === note.color) ?? COLORS[0];

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "BUTTON") return;
    dragging.current = true;
    offset.current = { x: e.clientX - note.x, y: e.clientY - note.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove_ = (e: MouseEvent) => {
      if (!dragging.current) return;
      onMove(note.id, e.clientX - offset.current.x, e.clientY - offset.current.y);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove_); window.removeEventListener("mouseup", onUp); };
  }, [note.id, onMove]);

  return (
    <div
      ref={ref}
      className={cn("sticky-note fixed w-48 rounded-xl border shadow-lg z-[9000]", colorObj.bg, colorObj.border)}
      style={{ left: note.x, top: note.y, userSelect: "none" }}
    >
      <div
        onMouseDown={onMouseDown}
        className={cn("flex items-center justify-between px-2 py-1 cursor-grab active:cursor-grabbing rounded-t-xl", colorObj.bg)}
      >
        <GripHorizontal className="h-3 w-3 opacity-50" />
        <button onClick={() => onDelete(note.id)} className="p-0.5 hover:bg-black/10 rounded transition-colors">
          <Trash2 className="h-3 w-3 opacity-60" />
        </button>
      </div>
      <textarea
        value={note.text}
        onChange={(e) => onTextChange(note.id, e.target.value)}
        placeholder="Write your note..."
        className={cn(
          "w-full bg-transparent p-2 text-sm resize-none focus:outline-none placeholder:opacity-50 rounded-b-xl font-handwriting",
          colorObj.text
        )}
        rows={4}
        style={{ fontFamily: "'Caveat', cursive", fontSize: "1rem" }}
      />
    </div>
  );
}
