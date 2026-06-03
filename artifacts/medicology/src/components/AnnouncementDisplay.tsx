import React, { useState } from "react";
import { useGetActiveAnnouncements, Announcement } from "@workspace/api-client-react";
import { useAuth } from "../lib/auth";
import { X, ExternalLink, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

function PopupAnnouncement({ a, onClose }: { a: Announcement; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors">
          <X size={16} className="text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone size={18} className="text-primary" />
          </div>
          <h2 className="font-bold text-lg text-foreground leading-tight">{a.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{a.content}</p>
        {a.buttonText && a.buttonUrl && (
          <a
            href={a.buttonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            {a.buttonText} <ExternalLink size={13} />
          </a>
        )}
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Dismiss
        </button>
      </div>
    </div>
  );
}

function BannerAnnouncement({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [idx, setIdx] = useState(0);

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const current = visible[Math.min(idx, visible.length - 1)];

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Megaphone size={14} className="shrink-0" />
        <span className="font-semibold shrink-0">{current.title}:</span>
        <span className="truncate opacity-90">{current.content}</span>
        {current.buttonText && current.buttonUrl && (
          <a href={current.buttonUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 underline hover:no-underline font-medium flex items-center gap-1">
            {current.buttonText} <ExternalLink size={11} />
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {visible.length > 1 && (
          <>
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
              className="p-0.5 rounded hover:bg-white/20 disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span className="text-xs opacity-70">{idx + 1}/{visible.length}</span>
            <button onClick={() => setIdx(Math.min(visible.length - 1, idx + 1))} disabled={idx >= visible.length - 1}
              className="p-0.5 rounded hover:bg-white/20 disabled:opacity-40"><ChevronRight size={14} /></button>
          </>
        )}
        <button onClick={() => { setDismissed(prev => new Set([...prev, current.id])); setIdx(0); }}
          className="ml-1 p-1 rounded hover:bg-white/20">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function TickerAnnouncement({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || announcements.length === 0) return null;

  const tickerText = announcements.map(a => `${a.title}: ${a.content}`).join("   •   ");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9997] bg-muted border-t border-border px-4 py-1.5 flex items-center gap-3">
      <span className="text-xs font-semibold text-primary shrink-0 uppercase tracking-wide flex items-center gap-1">
        <Megaphone size={10} /> News
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="ticker-scroll text-xs text-muted-foreground whitespace-nowrap"
          style={{ animation: "ticker 30s linear infinite" }}>
          {tickerText} &nbsp;&nbsp;&nbsp; {tickerText}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 p-1 hover:bg-muted-foreground/10 rounded">
        <X size={12} />
      </button>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(100%); }
          to { transform: translateX(-100%); }
        }
        .ticker-scroll { display: inline-block; }
      `}</style>
    </div>
  );
}

const DISMISSED_KEY = "medicology_dismissed_popups";

export function AnnouncementDisplay() {
  const { token } = useAuth();
  const [dismissedPopups, setDismissedPopups] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")); }
    catch { return new Set(); }
  });
  const [currentPopupIdx, setCurrentPopupIdx] = useState(0);

  const { data } = useGetActiveAnnouncements({
    query: { queryKey: ["active-announcements"], enabled: !!token },
  });
  const announcements = data?.announcements ?? [];

  const banners = announcements.filter(a => a.type === "banner");
  const tickers = announcements.filter(a => a.type === "ticker");
  const popups = announcements.filter(a => a.type === "popup" && !dismissedPopups.has(a.id));

  const currentPopup = popups[currentPopupIdx] ?? null;

  const dismissPopup = (id: number) => {
    const updated = new Set([...dismissedPopups, id]);
    setDismissedPopups(updated);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...updated]));
    setCurrentPopupIdx(0);
  };

  if (!token) return null;

  return (
    <>
      {currentPopup && (
        <PopupAnnouncement a={currentPopup} onClose={() => dismissPopup(currentPopup.id)} />
      )}
      {banners.length > 0 && <BannerAnnouncement announcements={banners} />}
      {tickers.length > 0 && <TickerAnnouncement announcements={tickers} />}
    </>
  );
}
