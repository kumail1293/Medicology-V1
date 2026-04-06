import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeckOptions as DeckOptionsType, Deck, DEFAULT_DECK_OPTIONS } from "./types";

interface Props {
  deck: Deck;
  options: DeckOptionsType;
  onSave: (options: DeckOptionsType) => void;
  onClose: () => void;
}

export default function DeckOptionsModal({ deck, options: initial, onSave, onClose }: Props) {
  const [opts, setOpts] = useState<DeckOptionsType>(initial);
  const set = (key: keyof DeckOptionsType, val: any) => setOpts(o => ({ ...o, [key]: val }));
  const setSteps = (key: "learningSteps" | "lapseSteps", val: string) => {
    const nums = val.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    if (nums.length > 0) set(key, nums);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">{deck.name}</h2>
              <p className="text-xs text-muted-foreground">Deck options</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
          </div>

          <div className="space-y-4">
            {/* New cards */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">New Cards</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">New cards/day</label>
                  <input type="number" min={1} max={9999} value={opts.newPerDay}
                    onChange={e => set("newPerDay", parseInt(e.target.value) || 20)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Learning steps (min)</label>
                  <input type="text" value={opts.learningSteps.join(", ")}
                    onChange={e => setSteps("learningSteps", e.target.value)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated minutes</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Graduating interval</label>
                  <input type="number" min={1} value={opts.graduatingInterval}
                    onChange={e => set("graduatingInterval", parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Easy interval</label>
                  <input type="number" min={1} value={opts.easyInterval}
                    onChange={e => set("easyInterval", parseInt(e.target.value) || 4)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Reviews</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Max reviews/day</label>
                  <input type="number" min={1} max={9999} value={opts.maxReviews}
                    onChange={e => set("maxReviews", parseInt(e.target.value) || 200)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Leech threshold</label>
                  <input type="number" min={1} value={opts.leechThreshold}
                    onChange={e => set("leechThreshold", parseInt(e.target.value) || 8)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>

            {/* Lapses */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Lapses</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Relearning steps (min)</label>
                  <input type="text" value={opts.lapseSteps.join(", ")}
                    onChange={e => setSteps("lapseSteps", e.target.value)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Minimum interval</label>
                  <input type="number" min={1} value={opts.minimumInterval}
                    onChange={e => set("minimumInterval", parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(opts)} className="flex-1">Save Options</Button>
            <Button variant="outline" onClick={() => setOpts(DEFAULT_DECK_OPTIONS)}>Reset</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
