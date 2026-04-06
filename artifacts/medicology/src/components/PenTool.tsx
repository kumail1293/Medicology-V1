import { useEffect, useRef, useState } from "react";
import { X, Trash2, PenLine, Type, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const PEN_COLORS = [
  { id: "black", hex: "#1a1a1a", label: "Black" },
  { id: "blue", hex: "#1565C0", label: "Blue" },
  { id: "red", hex: "#C62828", label: "Red" },
  { id: "green", hex: "#2E7D32", label: "Green" },
  { id: "purple", hex: "#6A1B9A", label: "Purple" },
  { id: "orange", hex: "#E65100", label: "Orange" },
];

const PEN_SIZES = [
  { id: "thin", size: 2, label: "Thin" },
  { id: "medium", size: 4, label: "Medium" },
  { id: "thick", size: 8, label: "Thick" },
  { id: "marker", size: 16, label: "Marker" },
];

interface PenToolProps {
  onClose: () => void;
}

export function PenTool({ onClose }: PenToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#1a1a1a");
  const [penSize, setPenSize] = useState(4);
  const [mode, setMode] = useState<"draw" | "text">("draw");
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "transparent";
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (mode === "text") {
      const pos = getPos(e);
      setTextPos(pos);
      return;
    }
    drawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current || mode === "text") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    const prev = lastPos.current ?? pos;

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => { drawing.current = false; lastPos.current = null; };

  const placeText = () => {
    if (!textPos || !textInput.trim()) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${penSize * 6}px 'Caveat', cursive`;
    ctx.fillStyle = color;
    ctx.fillText(textInput, textPos.x, textPos.y);
    setTextInput("");
    setTextPos(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current!;
    const link = document.createElement("a");
    link.download = "medicology-annotation.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pen-canvas-overlay"
        style={{ background: "transparent" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      {/* Text input popup */}
      {textPos && (
        <div
          className="fixed z-[10000] bg-card border border-border rounded-xl shadow-xl p-3 space-y-2"
          style={{ left: textPos.x, top: textPos.y - 80 }}
        >
          <input
            autoFocus
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") placeText(); if (e.key === "Escape") setTextPos(null); }}
            placeholder="Type and press Enter..."
            className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            style={{ fontFamily: "'Caveat', cursive", fontSize: `${Math.max(penSize * 3, 14)}px`, color }}
          />
          <div className="flex gap-2">
            <button onClick={placeText} className="text-xs px-2 py-1 bg-primary text-white rounded-lg">Place</button>
            <button onClick={() => setTextPos(null)} className="text-xs px-2 py-1 bg-muted rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] bg-card border border-border rounded-2xl shadow-2xl p-3 flex items-center gap-3 flex-wrap justify-center max-w-screen-sm">
        <div className="flex gap-1.5 items-center">
          <button
            onClick={() => setMode("draw")}
            className={cn("p-2 rounded-xl transition-colors", mode === "draw" ? "bg-primary text-white" : "hover:bg-muted")}
            title="Draw"
          >
            <PenLine className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMode("text")}
            className={cn("p-2 rounded-xl transition-colors", mode === "text" ? "bg-primary text-white" : "hover:bg-muted")}
            title="Text (handwriting)"
          >
            <Type className="h-4 w-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex gap-1.5 items-center">
          {PEN_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColor(c.hex)}
              className={cn("w-6 h-6 rounded-full border-2 transition-transform", color === c.hex ? "scale-125 border-foreground" : "border-transparent")}
              style={{ background: c.hex }}
              title={c.label}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex gap-1.5 items-center">
          {PEN_SIZES.map((s) => (
            <button
              key={s.id}
              onClick={() => setPenSize(s.size)}
              className={cn("rounded-full border-2 flex items-center justify-center transition-all",
                penSize === s.size ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                s.id === "thin" ? "w-6 h-6" : s.id === "medium" ? "w-7 h-7" : s.id === "thick" ? "w-8 h-8" : "w-9 h-9"
              )}
              title={s.label}
            >
              <div className="rounded-full" style={{ width: s.size, height: s.size, background: color }} />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex gap-1.5">
          <button onClick={clearCanvas} className="p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors" title="Clear all">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={downloadCanvas} className="p-2 rounded-xl hover:bg-muted transition-colors" title="Save as image">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" title="Exit pen tool">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
