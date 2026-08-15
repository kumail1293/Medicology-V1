import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Search, KeyRound, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface PermissionDef {
  key: string;
  name: string;
  group: string;
  description?: string;
  sortOrder: number;
}

const GROUP_ORDER = [
  'Questions', 'QBanks', 'Exams', 'Users', 'Payments', 'Settings',
  'Media', 'Announcements', 'Flashcards', 'Audit', 'System',
];

function PermissionMatrixPage() {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | 'all'>('all');

  const token = localStorage.getItem('medicology_token');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/rbac/permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setPermissions(data.permissions || []);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load permission registry', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = permissions.filter((p) => {
    const matchesGroup = activeGroup === 'all' || p.group === activeGroup;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.key.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q);
    return matchesGroup && matchesSearch;
  });

  const grouped = GROUP_ORDER
    .map((g) => ({ group: g, perms: filtered.filter((p) => p.group === g) }))
    .filter((g) => g.perms.length > 0);

  const total = permissions.length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <KeyRound size={26} className="text-primary" />
          Permission Registry
        </h2>
        <p className="text-muted-foreground">
          The complete catalog of {total} namespaced permissions the platform understands. Roles grant these;
          effective access is enforced server-side on every request.
        </p>
      </div>

      {/* Search + group filter */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-3 flex-1">
          <Search size={18} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search permissions (e.g. publish, users, media)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveGroup('all')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              activeGroup === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted',
            )}
          >
            All
          </button>
          {GROUP_ORDER.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                activeGroup === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted',
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading permissions...</div>
      ) : grouped.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-lg">
          No permissions match your search.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.group} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">{g.group}</h3>
                <span className="text-xs text-muted-foreground">{g.perms.length} permission{g.perms.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
                {g.perms.map((p) => (
                  <div key={p.key} className="bg-card p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <code className="mt-1.5 block text-[11px] font-mono text-muted-foreground">{p.key}</code>
                    {p.description && <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
            <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
            <p>
              Permission keys use <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">resource.action</code> naming.
              To compose a custom role, go to <span className="font-medium text-foreground">Roles & Permissions</span> and pick the
              granular keys — or duplicate an existing role as a starting point.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PermissionMatrixPage;
