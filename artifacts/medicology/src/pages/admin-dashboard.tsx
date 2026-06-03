import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Users,
  BookOpen,
  AlertCircle,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  PieChart,
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

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-lg', `bg-${color}/10`)}>
          <div className={`text-${color}`}>{icon}</div>
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp size={14} className={trend > 0 ? 'text-green-500' : 'text-red-500'} />
          <span className={trend > 0 ? 'text-green-500' : 'text-red-500'}>
            {trend > 0 ? '+' : ''}{trend}% from last week
          </span>
        </div>
      )}
    </div>
  );
}

function RecentActivityCard() {
  const activities = [
    { id: 1, user: 'John Doe', action: 'completed 5 questions', time: '2 minutes ago' },
    { id: 2, user: 'Jane Smith', action: 'submitted a flag', time: '15 minutes ago' },
    { id: 3, user: 'Admin', action: 'created new question', time: '1 hour ago' },
    { id: 4, user: 'Mike Johnson', action: 'started practice', time: '3 hours ago' },
    { id: 5, user: 'Sarah Lee', action: 'viewed analytics', time: '5 hours ago' },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={20} className="text-primary" />
        <h3 className="font-semibold text-lg">Recent Activity</h3>
      </div>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{activity.user}</span>
                {' '}{activity.action}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActionsCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap size={20} className="text-primary" />
        <h3 className="font-semibold text-lg">Quick Actions</h3>
      </div>
      <div className="grid gap-3">
        <button className="w-full px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors">
          Create New User
        </button>
        <button className="w-full px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors">
          Upload Questions
        </button>
        <button className="w-full px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors">
          View Reports
        </button>
        <button className="w-full px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors">
          System Settings
        </button>
      </div>
    </div>
  );
}

function SystemHealthCard() {
  const services = [
    { name: 'Database', status: 'online', latency: '2ms' },
    { name: 'API Server', status: 'online', latency: '45ms' },
    { name: 'Email Service', status: 'online', latency: 'N/A' },
    { name: 'Storage', status: 'online', latency: '120ms' },
  ];

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
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-foreground">{service.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{service.latency}</span>
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('medicology_token');
        const response = await fetch('http://localhost:5000/api/admin/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
        toast({
          title: 'Error',
          description: 'Failed to load dashboard statistics',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [toast]);

  return (
    <AdminLayout>
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
            trend={12}
            color="blue"
          />
          <StatCard
            title="Total Users"
            value={loading ? '...' : stats.totalUsers}
            icon={<Users size={24} />}
            subtitle="Registered"
            trend={8}
            color="green"
          />
          <StatCard
            title="Answers Today"
            value={loading ? '...' : stats.answersToday}
            icon={<Activity size={24} />}
            subtitle="Submitted"
            trend={-2}
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
    </AdminLayout>
  );
}
