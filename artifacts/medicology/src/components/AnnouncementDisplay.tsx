import React, { useState } from "react";
import { useLocation } from "wouter";
import { useGetActiveAnnouncements, Announcement } from "@workspace/api-client-react";
import { useAuth } from "../lib/auth";
import { X, ExternalLink, Megaphone, ChevronLeft, ChevronRight, Bell, AlertTriangle, Sparkles } from "lucide-react";
import RichText from "./RichText";
import { richTextToPlain } from "../lib/richText";

// Theme → Tailwind surface classes for themed announcement containers.
const THEME_STYLES: Record<string, { bar: string; icon: string; badge: string }> = {
  info: { bar: "bg-sky-600", icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  success: { bar: "bg-green-600", icon: "bg-green-500/15 text-green-600 dark:text-green-400", badge: "bg-green-500/15 text-green-600 dark:text-green-400" },
  warning: { bar: "bg-amber-500", icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  error: { bar: "bg-red-600", icon: "bg-red-500/15 text-red-600 dark:text-red-400", badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
  primary: { bar: "bg-primary", icon: "bg-primary/10 text-primary", badge: "bg-primary/10 text-primary" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  exam_alert: <AlertTriangle size={16} />,
  promotion: <Sparkles size={16} />,
  toast: <Bell size={16} />,
};

function themeOf(a: Announcement): string {
  return a.theme || "info";
}

// Dismissal tracking honours frequency: once → forever, daily → per day,
// every_visit → this page session.
function dismissalKey(a: Announcement): string | null {
  if (a.dismissible === false) return null;
  const freq = a.frequency || "every_visit";
  if (freq === "once") return `medicology_ann_dismiss_${a.id}`;
  if (freq === "daily") return `medicology_ann_dismiss_${a.id}_${new Date().toISOString().slice(0, 10)}`;
  return null; // every_visit → in-memory only
}

function useDismissed(a: Announcement): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    const key = dismissalKey(a);
    if (!key) return false;
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  const dismiss = () => {
    const key = dismissalKey(a);
    if (key) {
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
    }
    setDismissed(true);
  };
  return [dismissed, dismiss];
}

function CloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`p-1.5 rounded-lg hover:bg-black/10 transition-colors ${className ?? ""}`}>
      <X size={16} />
    </button>
  );
}

function CTA({ a, className }: { a: Announcement; className?: string }) {
  if (!a.buttonText || !a.buttonUrl) return null;
  return (
    <a href={a.buttonUrl} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 font-medium ${className ?? ""}`}>
      {a.buttonText} <ExternalLink size={13} />
    </a>
  );
}

function PopupAnnouncement({ a, onClose }: { a: Announcement; onClose: () => void }) {
  const theme = themeOf(a);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
        <CloseButton onClick={onClose} className="absolute top-3 right-3 text-muted-foreground" />
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${THEME_STYLES[theme]?.icon ?? THEME_STYLES.info.icon}`}>
            <Megaphone size={18} />
          </div>
          <h2 className="font-bold text-lg text-foreground leading-tight">{a.title}</h2>
        </div>
        <RichText html={a.content} className="text-sm text-muted-foreground leading-relaxed" />
        {a.buttonText && a.buttonUrl && (
          <CTA a={a} className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm hover:bg-primary/90 transition-colors" />
        )}
        {a.dismissible !== false && (
          <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function ModalAnnouncement({ a, onClose }: { a: Announcement; onClose: () => void }) {
  const theme = themeOf(a);
  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-top-4">
        <div className={`flex items-center justify-between gap-3 rounded-t-2xl px-5 py-3 text-white ${THEME_STYLES[theme]?.bar ?? THEME_STYLES.info.bar}`}>
          <div className="flex items-center gap-2 font-bold text-sm">
            {TYPE_ICON[a.type] ?? <Megaphone size={15} />} {a.title}
          </div>
          {a.dismissible !== false && <CloseButton onClick={onClose} className="text-white/80 hover:bg-white/20" />}
        </div>
        <div className="p-5">
          <RichText html={a.content} className="text-sm text-muted-foreground leading-relaxed" />
          {a.buttonText && a.buttonUrl && (
            <CTA a={a} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm hover:bg-primary/90" />
          )}
        </div>
      </div>
    </div>
  );
}

function ToastAnnouncement({ a, onClose }: { a: Announcement; onClose: () => void }) {
  const theme = themeOf(a);
  return (
    <div className="fixed bottom-5 right-5 z-[9997] w-full max-w-sm animate-in slide-in-from-bottom-4">
      <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className={`h-1.5 ${THEME_STYLES[theme]?.bar ?? THEME_STYLES.info.bar}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span className={THEME_STYLES[theme]?.icon ?? THEME_STYLES.info.icon}>{TYPE_ICON[a.type] ?? <Bell size={14} />}</span>
              {a.title}
            </div>
            {a.dismissible !== false && <CloseButton onClick={onClose} className="text-muted-foreground" />}
          </div>
          <RichText html={a.content} className="mt-1.5 text-xs text-muted-foreground leading-relaxed" />
          {a.buttonText && a.buttonUrl && <CTA a={a} className="mt-2 text-xs text-primary" />}
        </div>
      </div>
    </div>
  );
}

function BannerAnnouncement({ announcements }: { announcements: Announcement[] }) {
  const [sessionDismissed, setSessionDismissed] = useState<Set<number>>(new Set());
  const [idx, setIdx] = useState(0);

  const visible = announcements.filter(a => {
    if (sessionDismissed.has(a.id)) return false;
    if (a.dismissible === false) return true;
    const key = dismissalKey(a);
    if (key) {
      try { if (localStorage.getItem(key) === "1") return false; } catch { /* ignore */ }
    }
    return true;
  });
  if (visible.length === 0) return null;

  const current = visible[Math.min(idx, visible.length - 1)];
  const theme = themeOf(current);

  const dismiss = (id: number) => {
    const key = dismissalKey(current);
    if (key) { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } }
    setSessionDismissed(prev => new Set([...prev, id]));
    setIdx(0);
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9998] ${THEME_STYLES[theme]?.bar ?? THEME_STYLES.info.bar} text-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm shadow-md`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Megaphone size={14} className="shrink-0" />
        <span className="font-semibold shrink-0">{current.title}:</span>
        <span className="truncate opacity-90">{richTextToPlain(current.content)}</span>
        <CTA a={current} className="shrink-0 underline hover:no-underline" />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {visible.length > 1 && (
          <>
            <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="p-0.5 rounded hover:bg-white/20 disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span className="text-xs opacity-70">{idx + 1}/{visible.length}</span>
            <button onClick={() => setIdx(Math.min(visible.length - 1, idx + 1))} disabled={idx >= visible.length - 1} className="p-0.5 rounded hover:bg-white/20 disabled:opacity-40"><ChevronRight size={14} /></button>
          </>
        )}
        {current.dismissible !== false && (
          <button onClick={() => dismiss(current.id)} className="ml-1 p-1 rounded hover:bg-white/20"><X size={14} /></button>
        )}
      </div>
    </div>
  );
}

function TickerAnnouncement({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || announcements.length === 0) return null;

  const tickerText = announcements.map(a => `${a.title}: ${richTextToPlain(a.content)}`).join("   •   ");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9997] bg-muted border-t border-border px-4 py-1.5 flex items-center gap-3">
      <span className="text-xs font-semibold text-primary shrink-0 uppercase tracking-wide flex items-center gap-1">
        <Megaphone size={10} /> News
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="ticker-scroll text-xs text-muted-foreground whitespace-nowrap" style={{ animation: "ticker 30s linear infinite" }}>
          {tickerText} &nbsp;&nbsp;&nbsp; {tickerText}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 p-1 hover:bg-muted-foreground/10 rounded"><X size={12} /></button>
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

function ExamAlertAnnouncement({ a, onClose }: { a: Announcement; onClose: () => void }) {
  return <ModalAnnouncement a={a} onClose={onClose} />;
}

function PromotionAnnouncement({ a, onClose }: { a: Announcement; onClose: () => void }) {
  return <ToastAnnouncement a={a} onClose={onClose} />;
}

export function AnnouncementDisplay() {
  const { token } = useAuth();
  const [location] = useLocation();
  const [sessionDismissed, setSessionDismissed] = useState<Set<number>>(new Set());
  const [currentModalIdx, setCurrentModalIdx] = useState(0);

  const { data } = useGetActiveAnnouncements({
    query: { queryKey: ["active-announcements"], enabled: !!token },
  });
  const announcements = data?.announcements ?? [];

  // Route targeting: only announcements for this route (or untargeted ones).
  const routeMatch = (a: Announcement) => {
    if (!a.targetRoute) return true;
    return location.startsWith(a.targetRoute);
  };

  const inSession = (a: Announcement) => {
    if (sessionDismissed.has(a.id)) return false;
    if (a.dismissible === false) return true;
    const key = dismissalKey(a);
    if (key) {
      try { if (localStorage.getItem(key) === "1") return false; } catch { /* ignore */ }
    }
    return true;
  };

  const visible = announcements.filter(a => routeMatch(a) && inSession(a));
  const banners = visible.filter(a => a.type === "banner");
  const tickers = visible.filter(a => a.type === "ticker");
  const modals = visible.filter(a => ["popup", "modal", "exam_alert"].includes(a.type));
  const toasts = visible.filter(a => ["toast", "promotion"].includes(a.type));

  const currentModal = modals[currentModalIdx] ?? null;

  const dismiss = (a: Announcement) => {
    const key = dismissalKey(a);
    if (key) { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } }
    setSessionDismissed(prev => new Set([...prev, a.id]));
    setCurrentModalIdx(0);
  };

  if (!token) return null;

  return (
    <>
      {currentModal && currentModal.type === "popup" && (
        <PopupAnnouncement a={currentModal} onClose={() => dismiss(currentModal)} />
      )}
      {currentModal && currentModal.type === "modal" && (
        <ModalAnnouncement a={currentModal} onClose={() => dismiss(currentModal)} />
      )}
      {currentModal && currentModal.type === "exam_alert" && (
        <ExamAlertAnnouncement a={currentModal} onClose={() => dismiss(currentModal)} />
      )}
      {toasts.map((a) => (a.type === "promotion"
        ? <PromotionAnnouncement key={a.id} a={a} onClose={() => dismiss(a)} />
        : <ToastAnnouncement key={a.id} a={a} onClose={() => dismiss(a)} />))}
      {banners.length > 0 && <BannerAnnouncement announcements={banners} />}
      {tickers.length > 0 && <TickerAnnouncement announcements={tickers} />}
    </>
  );
}
