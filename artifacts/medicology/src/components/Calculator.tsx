import { useState } from "react";
import { X, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorProps {
  onClose: () => void;
}

export function Calculator({ onClose }: CalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState("");
  const [op, setOp] = useState("");
  const [fresh, setFresh] = useState(true);

  const pressDigit = (d: string) => {
    if (fresh) { setDisplay(d === "." ? "0." : d); setFresh(false); return; }
    if (d === "." && display.includes(".")) return;
    setDisplay(display === "0" && d !== "." ? d : display + d);
  };

  const pressOp = (o: string) => {
    setPrev(display);
    setOp(o);
    setFresh(true);
  };

  const calculate = () => {
    if (!op || !prev) return;
    const a = parseFloat(prev), b = parseFloat(display);
    let result = 0;
    if (op === "+") result = a + b;
    else if (op === "−") result = a - b;
    else if (op === "×") result = a * b;
    else if (op === "÷") result = b !== 0 ? a / b : NaN;
    else if (op === "%") result = a % b;
    const str = isNaN(result) ? "Error" : parseFloat(result.toPrecision(10)).toString();
    setDisplay(str);
    setPrev("");
    setOp("");
    setFresh(true);
  };

  const clear = () => { setDisplay("0"); setPrev(""); setOp(""); setFresh(true); };
  const del = () => {
    if (fresh || display.length <= 1) { setDisplay("0"); setFresh(true); return; }
    setDisplay(display.slice(0, -1));
  };
  const negate = () => setDisplay((parseFloat(display) * -1).toString());

  const btn = (label: string, action: () => void, variant: "num" | "op" | "eq" | "fn" = "num") => (
    <button
      key={label}
      onClick={action}
      className={cn(
        "h-12 rounded-xl text-sm font-semibold transition-all active:scale-95",
        variant === "num" && "bg-card border border-border hover:bg-muted",
        variant === "op" && "bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25",
        variant === "eq" && "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20",
        variant === "fn" && "bg-muted/80 text-muted-foreground hover:bg-muted border border-border"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="w-64 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground">Calculator</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-3 bg-muted/30 text-right">
        <div className="text-xs text-muted-foreground h-4">{prev} {op}</div>
        <div className="text-3xl font-bold font-mono overflow-hidden text-ellipsis">
          {display.length > 12 ? display.slice(0, 12) + "…" : display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 p-3">
        {btn("C", clear, "fn")}
        {btn("+/−", negate, "fn")}
        {btn("%", () => pressOp("%"), "fn")}
        {btn("÷", () => pressOp("÷"), "op")}

        {btn("7", () => pressDigit("7"))}
        {btn("8", () => pressDigit("8"))}
        {btn("9", () => pressDigit("9"))}
        {btn("×", () => pressOp("×"), "op")}

        {btn("4", () => pressDigit("4"))}
        {btn("5", () => pressDigit("5"))}
        {btn("6", () => pressDigit("6"))}
        {btn("−", () => pressOp("−"), "op")}

        {btn("1", () => pressDigit("1"))}
        {btn("2", () => pressDigit("2"))}
        {btn("3", () => pressDigit("3"))}
        {btn("+", () => pressOp("+"), "op")}

        <button
          onClick={() => pressDigit("0")}
          className="h-12 col-span-2 rounded-xl text-sm font-semibold bg-card border border-border hover:bg-muted transition-all active:scale-95 text-left px-4"
        >
          0
        </button>
        {btn(".", () => pressDigit("."))}
        {btn("=", calculate, "eq")}
      </div>
    </div>
  );
}
