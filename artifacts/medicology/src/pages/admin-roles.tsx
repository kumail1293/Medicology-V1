import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  Copy,
  Archive,
  Shield,
  Search,
  Check,
  X,
  Users as UsersIcon,
  KeyRound,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

interface RoleRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  systemRole: boolean;
  permissions: string[];
  userCount: number;
}

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

function RoleBuilderPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [registry, setRegistry] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'active',
    permissions: [] as string[],
  });

  const token = localStorage.getItem('medicology_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [r, p] = await Promise.all([
        fetch('/api/admin/rbac/roles', { headers }),
        fetch('/api/admin/rbac/permissions', { headers }),
      ]);
      const rd = await r.json();
      const pd = await p.json();
      setRoles(rd.roles || []);
      setRegistry(pd.permissions || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load roles', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const grouped = GROUP_ORDER
    .map((g) => ({ group: g, perms: registry.filter((p) => p.group === g) }))
    .filter((g) => g.perms.length > 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', status: 'active', permissions: [] });
    setEditorOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setEditing(role);
    setForm({
      name: role.name,
      slug: role.slug,
      description: role.description ?? '',
      status: role.status,
      permissions: [...role.permissions],
    });
    setEditorOpen(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter((k) => k !== key) : [...f.permissions, key],
    }));
  };

  const setGroupPerms = (group: string, value: boolean) => {
    const keys = registry.filter((p) => p.group === group).map((p) => p.key);
    setForm((f) => {
      const without = f.permissions.filter((k) => !keys.includes(k));
      return { ...f, permissions: value ? [...without, ...keys] : without };
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ title: 'Validation', description: 'Name and slug are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ ...form, description: form.description || null });
      const res = await fetch(
        editing ? `/api/admin/rbac/roles/${editing.id}` : '/api/admin/rbac/roles',
        { method: editing ? 'PUT' : 'POST', headers, body },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save role');
      toast({ title: 'Success', description: editing ? 'Role updated' : 'Role created' });
      setEditorOpen(false);
      void fetchAll();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save role', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (role: RoleRow) => {
    try {
      const res = await fetch(`/api/admin/rbac/roles/${role.id}/duplicate`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to duplicate role');
      toast({ title: 'Success', description: `Duplicated ${role.name}` });
      void fetchAll();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to duplicate', variant: 'destructive' });
    }
  };

  const archive = async (role: RoleRow) => {
    if (!confirm(`Archive role "${role.name}"? Users keep existing access; the role stops granting new permissions.`)) return;
    try {
      const res = await fetch(`/api/admin/rbac/roles/${role.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'archived' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to archive role');
      toast({ title: 'Success', description: 'Role archived' });
      void fetchAll();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to archive', variant: 'destructive' });
    }
  };

  const filtered = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Shield size={26} className="text-primary" />
            Roles & Permissions
          </h2>
          <p className="text-muted-foreground">
            Database-driven roles with granular, namespaced permissions. Effective access is enforced server-side.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          New Role
        </button>
      </div>

      {/* Search */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Role cards */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading roles...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-lg">
          No roles found. Create your first role to start granting permissions.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((role) => {
            const isOpen = expanded[role.id];
            return (
              <div key={role.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        role.systemRole ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}>
                        <KeyRound size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{role.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{role.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {role.systemRole ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">SYSTEM</span>
                      ) : role.status === 'archived' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">ARCHIVED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-500">ACTIVE</span>
                      )}
                    </div>
                  </div>
                  {role.description && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{role.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <KeyRound size={12} /> {role.permissions.length} permissions
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersIcon size={12} /> {role.userCount} users
                    </span>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [role.id]: !isOpen }))}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Permission matrix
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(role)} title="Edit" className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => duplicate(role)} title="Duplicate" className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground">
                      <Copy size={14} />
                    </button>
                    {!role.systemRole && role.status !== 'archived' && (
                      <button onClick={() => archive(role)} title="Archive" className="p-1.5 hover:bg-destructive/10 rounded transition-colors text-muted-foreground hover:text-destructive">
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-5 py-4 border-t border-border bg-muted/30 max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {role.permissions.length} / {registry.length} permissions enabled
                      </span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button onClick={() => setGroupPerms('Questions', false)} className="px-2 py-0.5 rounded bg-card border border-border hover:bg-muted">None</button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {grouped.map((g) => {
                        const enabled = g.perms.filter((p) => role.permissions.includes(p.key)).length;
                        return (
                          <div key={g.group}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</span>
                              <span className="text-[11px] text-muted-foreground">{enabled}/{g.perms.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {g.perms.map((p) => {
                                const on = role.permissions.includes(p.key);
                                return (
                                  <span
                                    key={p.key}
                                    title={p.description ?? p.key}
                                    className={clsx(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border',
                                      on
                                        ? 'bg-primary/10 text-primary border-primary/20'
                                        : 'bg-card text-muted-foreground border-border',
                                    )}
                                  >
                                    {on ? <Check size={10} /> : <X size={10} />}
                                    {p.name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? `Edit Role — ${editing.name}` : 'Create Role'}</h3>
              <button onClick={() => setEditorOpen(false)} className="p-1.5 hover:bg-muted rounded transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="e.g. Pathology Reviewer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Slug</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono"
                    placeholder="pathology_reviewer"
                    disabled={!!editing}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground resize-none"
                  rows={2}
                  placeholder="What can someone with this role do?"
                />
              </div>
              {editing && (
                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Permissions — {form.permissions.length} / {registry.length} enabled</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setForm((f) => ({ ...f, permissions: registry.map((p) => p.key) }))}
                      className="px-2.5 py-1 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Enable all
                    </button>
                    <button
                      onClick={() => setForm((f) => ({ ...f, permissions: [] }))}
                      className="px-2.5 py-1 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Disable all
                    </button>
                  </div>
                </div>
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {grouped.map((g) => {
                    const enabled = g.perms.filter((p) => form.permissions.includes(p.key)).length;
                    return (
                      <div key={g.group} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{enabled}/{g.perms.length}</span>
                            <button onClick={() => setGroupPerms(g.group, enabled !== g.perms.length)} className="text-xs text-primary hover:underline">
                              {enabled === g.perms.length ? 'Clear' : 'Enable all'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {g.perms.map((p) => {
                            const on = form.permissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                className={clsx(
                                  'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                  on ? 'bg-primary/10 border-primary/30' : 'bg-background border-border hover:border-primary/30',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => togglePerm(p.key)}
                                  className="accent-primary"
                                />
                                <span className="text-sm">{p.name}</span>
                                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{p.key.split('.')[1]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Create role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleBuilderPage;
