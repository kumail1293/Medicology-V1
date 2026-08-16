import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  BarChart3,
  Users,
  BookOpen,
  AlertCircle,
  Activity,
  Zap,
  Clock,
  Database,
  Mail,
  HardDrive,
  Server,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';

interface AdminStats {
  totalQuestions: number;
  totalUsers: number;
  answersToday: number;
  pendingFlags: number;
  pendingErrata: number;
  activeUsers?: number;
}

interface AuditEntry {
  id: number;
  action: string;
  summary: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
    indigo: 'bg-indigo-500/10 text-indigo-500',
    primary: 'bg-primary/10 text-primary',
  };
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-lg', colorMap[color] || colorMap.primary)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function RecentActivityCard() {
  const [activities, setActivities] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/audit-logs?limit=8');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setActivities(Array.isArray(data.logs) ? data.logs : []);
        }
      } catch {
        // Non-fatal — card shows an empty state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const timeAgo = (iso: string) => {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={20} className="text-primary" />
        <h3 className="font-semibold text-lg">Recent Activity</h3>
      </div>
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No administrative activity recorded yet.
        </p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-1">
                  <span className="text-muted-foreground">{activity.actorName || activity.actorEmail || 'System'}</span>
                  {' '}{activity.summary || activity.action}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{timeAgo(activity.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickActionsCard() {
  const [, setLocation] = useLocation();
  const actions = [
    { label: 'Manage Users', icon: <Users size={15} />, path: '/admin/users' },
    { label: 'Bulk Import Questions', icon: <BookOpen size={15} />, path: '/admin/import' },
    { label: 'Review Queue', icon: <AlertCircle size={15} />, path: '/admin/review' },
    { label: 'Platform Settings', icon: <Zap size={15} />, path: '/admin/settings' },
    { label: 'Email Templates', icon: <Mail size={15} />, path: '/admin/email' },
  ];
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap size={20} className="text-primary" />
        <h3 className="font-semibold text-lg">Quick Actions</h3>
      </div>
      <div className="grid gap-3">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => setLocation(a.path)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors"
          >
            {a.icon} <span className="flex-1 text-left">{a.label}</span>
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SystemHealthCard() {
  const [health, setHealth] = useState<{
    api: 'checking' | 'up' | 'down';
    apiLatency: number | null;
    email: 'checking' | 'up' | 'down' | 'unknown';
    storage: 'checking' | 'up' | 'down' | 'unknown';
  }>({ api: 'checking', apiLatency: null, email: 'checking', storage: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // API + latency
      const started = performance.now();
      try {
        const res = await fetch('/api/healthz');
        const latency = Math.round(performance.now() - started);
        if (!cancelled) setHealth((h) => ({ ...h, api: res.ok ? 'up' : 'down', apiLatency: res.ok ? latency : null }));
      } catch {
        if (!cancelled) setHealth((h) => ({ ...h, api: 'down', apiLatency: null }));
      }
      // Storage: probe the uploads dir listing (cheap; 404 body means route alive)
      try {
        const res = await fetch('/api/storage/media?limit=1');
        if (!cancelled) setHealth((h) => ({ ...h, storage: res.ok ? 'up' : 'unknown' }));
      } catch {
        if (!cancelled) setHealth((h) => ({ ...h, storage: 'down' }));
      }
      // Email: check delivery configuration via settings (no secret exposure)
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          const emailCfg = data?.settings?.email;
          const configured = emailCfg && (emailCfg.provider === 'smtp' ? !!emailCfg.smtpHost : emailCfg.provider === 'log');
          if (!cancelled) setHealth((h) => ({ ...h, email: configured ? 'up' : 'unknown' }));
        }
      } catch {
        if (!cancelled) setHealth((h) => ({ ...h, email: 'unknown' }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const services = [
    { name: 'API Server', icon: <Server size={14} />, status: health.api, detail: health.apiLatency != null ? `${health.apiLatency}ms` : '' },
    { name: 'Database', icon: <Database size={14} />, status: health.api === 'up' ? 'up' : 'down', detail: 'connected via API' },
    { name: 'Email Service', icon: <Mail size={14} />, status: health.email, detail: health.email === 'up' ? 'configured' : health.email === 'unknown' ? 'not configured' : '' },
    { name: 'Media Storage', icon: <HardDrive size={14} />, status: health.storage, detail: '' },
    { name: 'Auth & RBAC', icon: <ShieldCheck size={14} />, status: health.api === 'up' ? 'up' : 'down', detail: 'protected routes' },
  ];

  const dot = (s: string) => {
    if (s === 'up') return <span className="w-2 h-2 bg-green-500 rounded-full" />;
    if (s === 'down') return <span className="w-2 h-2 bg-red-500 rounded-full" />;
    if (s === 'checking') return <span className="w-2 h-2 bg-amber-400 animate-pulse rounded-full" />;
    return <span className="w-2 h-2 bg-muted-foreground/40 rounded-full" />;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-primary" />
        <h3 className="font-semibold text-lg">System Health</h3>
      </div>
      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {dot(service.status)}
              <span className="text-sm text-foreground flex items-center gap-1.5">
                {service.icon} {service.name}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{service.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalQuestions: 0,
    totalUsers: 0,
    answersToday: 0,
    pendingFlags: 0,
    pendingErrata: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [waitlist, setWaitlist] = useState<Array<{ qbankId: number; slug: string; name: string; count: number }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats', {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
        toast({ title: 'Error', description: 'Failed to load dashboard statistics', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();

    const fetchWaitlist = async () => {
      try {
        const response = await fetch('/api/admin/waitlist');
        if (response.ok) {
          const data = await response.json();
          setWaitlist(data.demand || []);
        }
      } catch {
        // Non-fatal — the demand list is supplementary.
      }
    };
    fetchWaitlist();
  }, [toast]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
        <p className="text-muted-foreground">Welcome to Medicology Admin Panel. Here's your system overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard
          title="Total Questions"
          value={loading ? '...' : stats.totalQuestions}
          icon={<BookOpen size={24} />}
          subtitle="In Question Bank"
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={loading ? '...' : stats.totalUsers}
          icon={<Users size={24} />}
          subtitle="Registered"
          color="green"
        />
        <StatCard
          title="Answers Today"
          value={loading ? '...' : stats.answersToday}
          icon={<Activity size={24} />}
          subtitle="Submitted"
          color="purple"
        />
        <StatCard
          title="Pending Flags"
          value={loading ? '...' : stats.pendingFlags}
          icon={<AlertCircle size={24} />}
          subtitle="Need Review"
          color="orange"
        />
        <StatCard
          title="Active Users"
          value={loading ? '...' : stats.activeUsers || 0}
          icon={<BarChart3 size={24} />}
          subtitle="Right Now"
          color="indigo"
        />
      </div>

      {/* Coming Soon demand (Notify Me waitlist) */}
      {waitlist.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap size={16} className="text-primary" /> Coming Soon Demand
            </h3>
            <span className="text-xs text-muted-foreground">Notify Me registrations</span>
          </div>
          <div className="divide-y divide-border">
            {waitlist.map((item) => (
              <div key={item.qbankId} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.slug}</p>
                </div>
                <span className="text-sm font-bold text-primary">{item.count.toLocaleString()} interested</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivityCard />
        </div>
        <div className="space-y-6">
          <QuickActionsCard />
          <SystemHealthCard />
        </div>
      </div>
    </div>
  );
}
