import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSettings } from '@/lib/settings';
import {
  BarChart3,
  Users,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Shield,
  FileText,
  AlertCircle,
  Megaphone,
  Network,
  UploadCloud,
  Images,
  ClipboardCheck,
  Database,
  Layers,
  Rocket,
  Mail,
  ScrollText,
  Command,
  ArrowRight,
  UserCog,
  KeyRound,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  permission?: string;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, user, can } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();
  const { theme } = useSettings();
  const [reviewBadge, setReviewBadge] = useState<number | undefined>(undefined);

  // Pending-review badge for the Review Queue nav item.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/admin/review/summary');
        if (!response.ok) return;
        const data = await response.json();
        const counts = data.counts || {};
        const pending =
          (counts.draft || 0) +
          (counts.pending_review || 0) +
          (counts.under_medical_review || 0) +
          (counts.flagged || 0) +
          (counts.errata || 0);
        if (!cancelled) setReviewBadge(pending > 0 ? pending : undefined);
      } catch {
        // Non-fatal — badge just stays hidden.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: <BarChart3 size={18} />,
      path: '/admin',
    },
    {
      label: 'Users',
      icon: <Users size={18} />,
      path: '/admin/users',
      permission: 'users.view',
    },
    {
      label: 'Roles & Permissions',
      icon: <KeyRound size={18} />,
      path: '/admin/roles',
      permission: 'users.manage_roles',
    },
    {
      label: 'Account Types',
      icon: <UserCog size={18} />,
      path: '/admin/user-types',
      permission: 'users.manage_types',
    },
    {
      label: 'Permission Matrix',
      icon: <Shield size={18} />,
      path: '/admin/permissions',
      permission: 'users.manage_roles',
    },
    {
      label: 'Questions',
      icon: <BookOpen size={18} />,
      path: '/admin/questions',
      permission: 'questions.manage',
    },
    {
      label: 'Taxonomy',
      icon: <Network size={18} />,
      path: '/admin/taxonomy',
      permission: 'taxonomy.manage',
    },
    {
      label: 'Bulk Import',
      icon: <UploadCloud size={18} />,
      path: '/admin/import',
      permission: 'import.run',
    },
    {
      label: 'Review Queue',
      icon: <ClipboardCheck size={18} />,
      path: '/admin/review',
      badge: reviewBadge,
      permission: 'review.manage',
    },
    {
      label: 'QBanks',
      icon: <Database size={18} />,
      path: '/admin/qbanks',
      permission: 'qbanks.manage',
    },
    {
      label: 'Flashcards',
      icon: <Layers size={18} />,
      path: '/admin/flashcards',
      permission: 'flashcards.manage',
    },
    {
      label: 'Announcements',
      icon: <Megaphone size={18} />,
      path: '/admin/announcements',
      permission: 'announcements.manage',
    },
    {
      label: 'Flags & Reports',
      icon: <AlertCircle size={18} />,
      path: '/admin/flags',
      permission: 'flags.manage',
    },
    {
      label: 'Media Library',
      icon: <Images size={18} />,
      path: '/admin/media',
      permission: 'media.manage',
    },
    {
      label: 'Coming Soon',
      icon: <Rocket size={18} />,
      path: '/admin/coming-soon',
      permission: 'coming_soon.manage',
    },
    {
      label: 'Email Templates',
      icon: <Mail size={18} />,
      path: '/admin/email',
      permission: 'email.manage',
    },
    {
      label: 'Audit Logs',
      icon: <ScrollText size={18} />,
      path: '/admin/audit',
      permission: 'audit.view',
    },
    {
      label: 'Settings',
      icon: <Settings size={18} />,
      path: '/admin/settings',
      permission: 'settings.manage',
    },
  ];

  // ── Command center (Ctrl+K) ────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const visibleNav = navItems.filter((item) => !item.permission || can(item.permission));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const paletteResults = visibleNav.filter(
    (item) => item.label.toLowerCase().includes(query.toLowerCase()) || item.path.toLowerCase().includes(query.toLowerCase())
  );

  const isActive = (path: string) => location === path;

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={clsx(
          'bg-card border-r border-border transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo/Brand */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield className="text-primary" size={24} />
              <span className="font-bold text-sm">Admin</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNav.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
                isActive(item.path)
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-border p-3 space-y-2">
          <div className={clsx('text-xs text-muted-foreground', !sidebarOpen && 'text-center')}>
            {sidebarOpen && (
              <>
                <div className="font-medium text-foreground truncate">{user?.name}</div>
                <div className="truncate">{user?.email}</div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              title={!sidebarOpen ? 'Logout' : undefined}
            >
              <LogOut size={16} />
              {sidebarOpen && 'Logout'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-bold">Medicology Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <Command size={14} /> Quick actions
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
            </button>
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-background">
          {children}
        </div>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24 p-4"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Command size={16} className="text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search admin sections…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setPaletteOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
              {paletteResults.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No sections match “{query}”.</p>
              )}
              {paletteResults.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { setLocation(item.path); setPaletteOpen(false); setQuery(''); }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-primary/10 transition-colors text-left"
                >
                  <span className="text-primary">{item.icon}</span>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ArrowRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
