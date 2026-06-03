import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, Leaf, Monitor, Calculator, FlaskConical,
  StickyNote, PenLine, Highlighter, Maximize, Minimize,
  Settings, X, ChevronRight, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings";
import { Calculator as CalculatorWidget } from "./Calculator";
import { LabValues } from "./LabValues";
import { StickyNotesPanel } from "./StickyNotes";
import { PenTool } from "./PenTool";
import { HighlighterTool } from "./Highlighter";
import { useLocation } from "wouter";

type Panel = "calculator" | "lab" | "sticky" | "pen" | "highlighter" | null;

export function Toolbar() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [, setLocation] = useLocation();

  const togglePanel = (p: Panel) => setActivePanel((prev) => (prev === p ? null : p));

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  }, []);

  const cycleTheme = () => {
    const themes = ["light", "dark", "easy", "usmle"] as const;
    const idx = themes.indexOf(settings.theme as any);
    update({ theme: themes[(idx + 1) % themes.length] });
  };

  const themeIcon = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    easy: <Leaf className="h-4 w-4" />,
    oled: <Moon className="h-4 w-4" />,
    usmle: <Monitor className="h-4 w-4" />,
  }[settings.theme] ?? <Sun className="h-4 w-4" />;

  const themeLabel = {
    light: "Light",
    dark: "Dark",
    easy: "Sepia",
    oled: "OLED",
    usmle: "USMLE",
  }[settings.theme] ?? "Light";

  return (
    <>
      {/* Floating Toolbar Toggle Button */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed top-4 right-4 z-[800] p-3 rounded-full shadow-lg border border-border transition-all",
          "bg-card hover:shadow-xl",
          open ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-primary/50 scale-105" : ""
        )}
        title="Study Tools"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={open ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {open ? <X className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Toolbar Panel */}
      <AnimatePresence>
        {open && (
          <motion.div 
            className="fixed top-4 right-16 z-[800] flex flex-col gap-2 items-end"
            initial={{ opacity: 0, x: 20, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 20, y: -10 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <motion.div 
              className="bg-card rounded-2xl shadow-lg border border-border/50 p-2 flex flex-col gap-1 backdrop-blur-sm"
              layout
            >
              {/* Theme toggle */}
              <ToolBtn
                onClick={cycleTheme}
                icon={themeIcon}
                label={themeLabel}
                description="Cycle theme"
                active={false}
              />

              {/* Fullscreen */}
              <ToolBtn
                onClick={toggleFullscreen}
                icon={fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                label={fullscreen ? "Exit Full" : "Full Screen"}
                description="Toggle fullscreen"
                active={fullscreen}
              />

              <motion.div className="h-px bg-border/40 mx-1" layout />

              {/* Calculator */}
              <ToolBtn
                onClick={() => togglePanel("calculator")}
                icon={<Calculator className="h-4 w-4" />}
                label="Calculator"
                description="Scientific calculator"
                active={activePanel === "calculator"}
              />

              {/* Lab Values */}
              <ToolBtn
                onClick={() => togglePanel("lab")}
                icon={<FlaskConical className="h-4 w-4" />}
                label="Lab Values"
                description="Reference lab values"
                active={activePanel === "lab"}
              />

              <motion.div className="h-px bg-border/40 mx-1" layout />

              {/* Sticky Notes */}
              <ToolBtn
                onClick={() => togglePanel("sticky")}
                icon={<StickyNote className="h-4 w-4" />}
                label="Sticky Notes"
                description="Floating sticky notes"
                active={activePanel === "sticky"}
              />

              {/* Pen Tool */}
              <ToolBtn
                onClick={() => togglePanel("pen")}
                icon={<PenLine className="h-4 w-4" />}
                label="Pen & Draw"
                description="Draw & annotate"
                active={activePanel === "pen"}
              />

              {/* Highlighter */}
              <ToolBtn
                onClick={() => togglePanel("highlighter")}
                icon={<Highlighter className="h-4 w-4" />}
                label="Highlighter"
                description="Highlight text"
                active={activePanel === "highlighter"}
              />

              <motion.div className="h-px bg-border/40 mx-1" layout />

              {/* Flashcards */}
              <ToolBtn
                onClick={() => { setLocation("/flashcards"); setOpen(false); }}
                icon={<Layers className="h-4 w-4" />}
                label="Flashcards"
                description="Study flashcards"
                active={false}
              />

              {/* Settings */}
              <ToolBtn
                onClick={() => { setLocation("/settings"); setOpen(false); }}
                icon={<Settings className="h-4 w-4" />}
                label="Settings"
                description="Appearance & more"
                active={false}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Panels */}
      <AnimatePresence>
        {activePanel === "calculator" && (
          <motion.div 
            className="fixed top-20 right-4 z-[900]"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <CalculatorWidget onClose={() => setActivePanel(null)} />
          </motion.div>
        )}

        {activePanel === "lab" && (
          <motion.div 
            className="fixed top-4 right-4 z-[900] w-80 h-[85vh] bg-card rounded-2xl shadow-lg border border-border/50 flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <LabValues onClose={() => setActivePanel(null)} />
          </motion.div>
        )}

        {activePanel === "sticky" && (
          <motion.div 
            className="fixed top-20 right-4 z-[900]"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <StickyNotesPanel onClose={() => setActivePanel(null)} />
          </motion.div>
        )}

        {activePanel === "pen" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <PenTool onClose={() => setActivePanel(null)} />
          </motion.div>
        )}

        {activePanel === "highlighter" && (
          <motion.div 
            className="fixed top-20 right-4 z-[900]"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <HighlighterTool onClose={() => setActivePanel(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ToolBtn({
  onClick,
  icon,
  label,
  description,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      title={description}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left w-full font-medium text-sm",
        active
          ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md border border-primary/30"
          : "hover:bg-muted/80 text-foreground hover:shadow-sm border border-transparent"
      )}
    >
      <motion.span 
        className={cn("shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")}
        animate={active ? { rotate: 12 } : { rotate: 0 }}
      >
        {icon}
      </motion.span>
      <span>{label}</span>
    </motion.button>
  );
}
