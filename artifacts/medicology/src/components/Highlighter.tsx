import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Highlighter as HighlighterIcon, X } from "lucide-react";

const HIGHLIGHT_COLORS = [
  { id: "yellow", class: "hl-yellow", label: "Yellow", hex: "#FFEB3B" },
  { id: "green",  class: "hl-green",  label: "Green",  hex: "#4CAF50" },
  { id: "blue",   class: "hl-blue",   label: "Blue",   hex: "#2196F3" },
  { id: "pink",   class: "hl-pink",   label: "Pink",   hex: "#E91E63" },
  { id: "orange", class: "hl-orange", label: "Orange", hex: "#FF9800" },
];

interface HighlighterProps {
  onClose: () => void;
}

export function HighlighterTool({ onClose }: HighlighterProps) {
  const [active, setActive] = useState(true);
  const [color, setColor] = useState("hl-yellow");
  const [label, setLabel] = useState("Click text to highlight");

  useEffect(() => {
    if (!active) return;

    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      if (!range.toString().trim()) return;

      try {
        const mark = document.createElement("mark");
        mark.className = color;
        range.surroundContents(mark);
        sel.removeAllRanges();
        setLabel("Highlighted! Select more text.");
      } catch {
        setLabel("Cannot highlight across elements");
      }
    };

    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, [active, color]);

  const clearHighlights = () => {
    document.querySelectorAll("mark[class^='hl-']").forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    setLabel("All highlights cleared");
  };

  return (
    <div className="w-60 bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-yellow-400 text-yellow-900">
        <div className="flex items-center gap-1.5">
          <HighlighterIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">Highlighter</span>
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-yellow-500/40 rounded transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div>
          <p className="text-xs font-medium mb-1.5">Color</p>
          <div className="flex gap-2">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setColor(c.class)}
                className={cn("w-7 h-7 rounded-full border-2 transition-transform",
                  color === c.class ? "scale-110 border-foreground" : "border-transparent hover:scale-105"
                )}
                style={{ background: c.hex }}
                title={c.label}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setActive(!active); setLabel(active ? "Highlighter paused" : "Select text to highlight"); }}
            className={cn("flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors",
              active ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {active ? "Active" : "Paused"}
          </button>
          <button
            onClick={clearHighlights}
            className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
