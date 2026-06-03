import React, { useState } from 'react';
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
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();
  const { theme } = useSettings();

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
    },
    {
      label: 'Questions',
      icon: <BookOpen size={18} />,
      path: '/admin/questions',
    },
    {
      label: 'Announcements',
      icon: <Megaphone size={18} />,
      path: '/admin/announcements',
    },
    {
      label: 'Flags & Reports',
      icon: <AlertCircle size={18} />,
      path: '/admin/flags',
    },
    {
      label: 'Settings',
      icon: <Settings size={18} />,
      path: '/admin/settings',
    },
  ];

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
          {navItems.map((item) => (
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
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
    </div>
  );
}
