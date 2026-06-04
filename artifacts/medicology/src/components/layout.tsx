import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Stethoscope,
  ClipboardCheck,
  CalendarHeart,
  BarChart3,
  BookMarked,
  Layers,
  Settings,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  Users,
  Trophy,
  Sun,
  Moon,
  Eye,
  BookOpen,
  Calendar,
  ExternalLink,
  CreditCard,
  Command,
} from 'lucide-react';
import { clsx } from 'clsx';

export const PageTransition = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

interface Announcement {
  id: number;
  type: 'popup' | 'banner' | 'ticker';
  title: string;
  content: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
}

function useAnnouncements() {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  React.useEffect(() => {
    const token = localStorage.getItem('medicology_token');
    if (!token) return;
    fetch('/api/announcements/active', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.announcements) setAnnouncements(d.announcements); })
      .catch(() => {});
  }, []);
  return announcements;
}

function PopupAnnouncement({ ann, onClose }: { ann: Announcement; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-card border border-border/50 rounded-3xl shadow-lg max-w-md w-full p-8"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground pr-4 leading-tight">{ann.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg p-1.5 shrink-0 transition-all duration-200">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{ann.content}</p>
        <div className="flex gap-3">
          {ann.buttonText && ann.buttonUrl && (
            <a
              href={ann.buttonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200 btn-press"
            >
              {ann.buttonText} <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-muted/80 text-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors duration-200 btn-press"
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function BannerAnnouncement({ ann, onClose }: { ann: Announcement; onClose: () => void }) {
  return (
    <div className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-4 py-3 flex items-center justify-between gap-4 text-sm shadow-md border-b border-primary/30">
      <div className="flex-1 min-w-0">
        <span className="font-bold mr-2">{ann.title}</span>
        <span className="opacity-95 text-xs">{ann.content}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {ann.buttonText && ann.buttonUrl && (
          <a
            href={ann.buttonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 btn-press whitespace-nowrap"
          >
            {ann.buttonText}
          </a>
        )}
        <button onClick={onClose} className="opacity-80 hover:opacity-100 transition-opacity rounded-lg p-1 hover:bg-primary-foreground/10 duration-200">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function TickerBar({ tickers }: { tickers: Announcement[] }) {
  if (tickers.length === 0) return null;
  const text = tickers.map(t => `\u2022 ${t.title}: ${t.content}`).join('   ');
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-muted border-t border-border overflow-hidden h-8 flex items-center">
      <motion.div
        className="whitespace-nowrap text-xs text-muted-foreground font-medium"
        animate={{ x: ['100vw', '-100%'] }}
        transition={{ duration: Math.max(20, text.length * 0.12), repeat: Infinity, ease: 'linear' }}
      >
        {text}
      </motion.div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { settings, update } = useSettings();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const announcements = useAnnouncements();
  const [dismissedIds, setDismissedIds] = React.useState<Set<number>>(() => {
    try {
      const stored = sessionStorage.getItem('medicology_dismissed_announcements');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  const dismiss = (id: number) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem('medicology_dismissed_announcements', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const active = announcements.filter(a => !dismissedIds.has(a.id));
  const popupAnn = active.find(a => a.type === 'popup');
  const banners = active.filter(a => a.type === 'banner');
  const tickers = active.filter(a => a.type === 'ticker');

  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const quickActions = [
    { label: "Dashboard", href: "/" },
    { label: "Daily Challenge", href: "/daily" },
    { label: "Study Planner", href: "/planner" },
    { label: "Review Hub", href: "/review" },
    { label: "Bookmarks", href: "/review" },
    { label: "Analytics", href: "/analytics" },
  ];

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Create Test", href: "/create-test", icon: Stethoscope },
    { name: "My Tests", href: "/tests", icon: ClipboardCheck },
    { name: "Daily Challenge", href: "/daily", icon: CalendarHeart },
    { name: "Study Planner", href: "/planner", icon: Calendar },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Review Hub", href: "/review", icon: BookMarked },
    { name: "Clinical Cases", href: "/cases", icon: Stethoscope },
    { name: "Flashcards", href: "/flashcards", icon: Layers },
    { name: "Notes Library", href: "/notes", icon: BookOpen },
    { name: "QBank Store", href: "/qbanks", icon: ShoppingBag },
    { name: "My Subscription", href: "/subscription", icon: CreditCard },
    { name: "Study Buddies", href: "/buddies", icon: Users },
    { name: "Achievements", href: "/achievements", icon: Trophy },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  if (user?.isAdmin) {
    navItems.push({ name: "Admin Panel", href: "/admin", icon: ShieldAlert });
  }

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(open => !open);
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
      }
      if (event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setLocation('/daily');
      }
      if (event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setLocation('/planner');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setLocation]);

  return (
    <div className={clsx("min-h-screen bg-background flex flex-col md:flex-row", tickers.length > 0 && "pb-8")}>
      {/* Popup Announcement */}
      <AnimatePresence>
        {popupAnn && (
          <PopupAnnouncement key={popupAnn.id} ann={popupAnn} onClose={() => dismiss(popupAnn.id)} />
        )}
      </AnimatePresence>

      {/* Ticker */}
      <TickerBar tickers={tickers} />

      {/* Quick action palette */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-3xl border border-border bg-card shadow-2xl p-6"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Quick Actions</p>
                  <h2 className="text-xl font-bold">Jump anywhere</h2>
                </div>
                <button onClick={() => setPaletteOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.href}
                    onClick={() => {
                      setPaletteOpen(false);
                      setLocation(action.href);
                    }}
                    className="w-full text-left rounded-2xl border border-border px-4 py-4 bg-background hover:border-primary/50 hover:shadow-lg transition-all"
                  >
                    <p className="font-semibold">{action.label}</p>
                    <p className="text-xs text-muted-foreground">Go to {action.label}</p>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Try Ctrl+K or ⌘+K to open this palette anytime.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <div className="md:hidden glass-panel flex items-center justify-between p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={`/images/logo-colored.png`} alt="Medicology" className="h-10 w-auto object-contain" />
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            <Command size={14} /> Quick Actions
          </button>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-foreground">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <motion.aside
          initial={false}
          animate={mobileMenuOpen ? { x: 0 } : undefined}
          className={clsx(
            "fixed md:sticky top-0 left-0 z-40 h-screen w-72 bg-card border-r border-border flex flex-col shadow-2xl md:shadow-none",
            mobileMenuOpen ? "flex" : "hidden md:flex"
          )}
        >
            <div className="p-6 hidden md:flex items-center justify-start">
              <img src={`/images/logo-colored.png`} alt="Medicology" className="h-16 w-auto object-contain" />
            </div>

            <div className="px-4 pb-2">
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-4 rounded-2xl border border-primary/20 mb-2 transition-all duration-300 hover:border-primary/40 hover:shadow-md">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.college}</p>
                <div className="mt-2 inline-block bg-gradient-to-r from-primary/20 to-accent/20 text-primary font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-primary/20">
                  Year {user?.year}
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto custom-scrollbar">
              {navItems.map((item, i) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));

                const showDivider = i > 0 && (
                  (navItems[i - 1].href === "/analytics" && item.href === "/review") ||
                  (navItems[i - 1].href === "/review" && item.href === "/flashcards") ||
                  (navItems[i - 1].href === "/settings" && item.href === "/admin")
                );

                return (
                  <React.Fragment key={item.name}>
                    {showDivider && <div className="h-px bg-border/40 mx-2 my-2" />}
                    <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <div className={clsx(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ease-out cursor-pointer group",
                        isActive
                          ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 font-semibold scale-105"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-95"
                      )}>
                        <item.icon size={18} className={clsx(isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary transition-colors duration-200")} />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                    </Link>
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Theme Toggle */}
            <div className="px-4 py-3 border-t border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Display Mode</p>
              <div className="flex gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/30">
                <button
                  onClick={() => update({ theme: "light" })}
                  title="Light Mode"
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 btn-press",
                    settings.theme === "light" ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  <Sun size={13} />
                </button>
                <button
                  onClick={() => update({ theme: "dark" })}
                  title="Dark Mode"
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 btn-press",
                    settings.theme === "dark" ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  <Moon size={13} />
                </button>
                <button
                  onClick={() => update({ theme: "easy" })}
                  title="Easy Eye Mode"
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 btn-press",
                    settings.theme === "easy" ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  <Eye size={13} />
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-border/50">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 active:bg-destructive/15 transition-all duration-200 font-medium text-sm btn-press border border-destructive/20 hover:border-destructive/40"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
        </motion.aside>
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden min-w-0 flex flex-col">
        {/* Banner Announcements */}
        <AnimatePresence>
          {banners.map(ann => (
            <motion.div
              key={ann.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <BannerAnnouncement ann={ann} onClose={() => dismiss(ann.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
