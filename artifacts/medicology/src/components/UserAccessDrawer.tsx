import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  X,
  KeyRound,
  Shield,
  Globe,
  Check,
  Minus,
  UserCog,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
} from 'lucide-react';
import { clsx } from 'clsx';

interface DrawerProps {
  user: { id: number; name: string; email: string };
  onClose: () => void;
}

interface EffectivePermission {
  key: string;
  allowed: boolean;
  source: 'direct' | 'role' | 'account_type' | 'legacy' | 'denied';
  viaRole?: string;
}

interface AccessPayload {
  effective: {
    userId: number;
    permissions: EffectivePermission[];
    grantedPermissions: string[];
    deniedPermissions: string[];
    roles: string[];
    accountType?: string;
    scopes: { type: string; id: number | null; label?: string }[];
    isSuperadmin: boolean;
  };
  roles: { id: number; name: string; slug: string; status: string; systemRole: boolean; permissions: string[]; assigned: boolean }[];
  directPermissions: { id: number; permissionKey: string; allowed: boolean }[];
  scopes: { id: number; scopeType: string; scopeId: number | null; label: string | null }[];
}

interface UserTypeOption {
  slug: string;
  name: string;
  status: string;
}

interface ScopeOption {
  id: number;
  label: string;
}

const SCOPE_TYPES = ['global', 'country', 'exam', 'program', 'year', 'subject', 'system', 'topic', 'qbank'];

function UserAccessDrawer({ user, onClose }: DrawerProps) {
  const { toast } = useToast();
  const [data, setData] = useState<AccessPayload | null>(null);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);
  const [scopeOptions, setScopeOptions] = useState<Record<string, ScopeOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newScopeType, setNewScopeType] = useState('country');
  const [newScopeId, setNewScopeId] = useState('');

  const token = localStorage.getItem('medicology_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      setLoading(true);
      const [a, t, s] = await Promise.all([
        fetch(`/api/admin/rbac/users/${user.id}/access`, { headers }),
        fetch('/api/admin/rbac/user-types', { headers }),
        fetch('/api/admin/rbac/scopes/options', { headers }),
      ]);
      setData(await a.json());
      const td = await t.json();
      setUserTypes((td.userTypes || []).filter((x: UserTypeOption) => x.status !== 'inactive'));
      setScopeOptions(await s.json());
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load access', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user.id]);

  const put = async (path: string, body: unknown): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rbac${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Request failed');
      toast({ title: 'Success', description: 'Access updated' });
      await load();
      return true;
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: number, assigned: boolean) => {
    if (!data) return;
    const roleIds = assigned
      ? data.roles.filter((r) => r.assigned && r.id !== roleId).map((r) => r.id)
      : [...data.roles.filter((r) => r.assigned).map((r) => r.id), roleId];
    void put(`/users/${user.id}/roles`, { roleIds });
  };

  const setAccountType = (userType: string) => {
    void put(`/users/${user.id}/account-type`, { userType });
  };

  const toggleDirect = (key: string, allowed: boolean) => {
    if (!data) return;
    const existing = data.directPermissions.filter((p) => p.permissionKey !== key);
    const permissions = [...existing, { permissionKey: key, allowed }];
    void put(`/users/${user.id}/permissions`, { permissions });
  };

  const addScope = () => {
    if (!data || !newScopeId) return;
    const opt = (scopeOptions[newScopeType] || []).find((o) => o.id === Number(newScopeId));
    const scopes = [
      ...data.scopes.map((s) => ({ scopeType: s.scopeType, scopeId: s.scopeId, label: s.label ?? undefined })),
      { scopeType: newScopeType, scopeId: Number(newScopeId), label: opt?.label },
    ];
    void put(`/users/${user.id}/scopes`, { scopes });
    setNewScopeId('');
  };

  const removeScope = (scopeType: string, scopeId: number | null) => {
    if (!data) return;
    const scopes = data.scopes
      .filter((s) => !(s.scopeType === scopeType && s.scopeId === scopeId))
      .map((s) => ({ scopeType: s.scopeType, scopeId: s.scopeId, label: s.label ?? undefined }));
    void put(`/users/${user.id}/scopes`, { scopes });
  };

  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-card h-full shadow-xl border-l border-border p-8">
          <div className="text-center text-muted-foreground py-16">Loading effective access...</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { effective } = data;
  const granted = effective.permissions.filter((p) => p.allowed);
  const denied = effective.permissions.filter((p) => !p.allowed);
  const scopeLabel = (type: string, id: number | null) => {
    if (type === 'global') return 'Global (everything)';
    const opt = (scopeOptions[type] || []).find((o) => o.id === id);
    return opt?.label ?? `${type} #${id ?? '—'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card h-full shadow-xl border-l border-border flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="font-semibold">Effective Access</h3>
              <p className="text-sm text-muted-foreground">{user.name} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Account type */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCog size={13} /> Account type
            </h4>
            <select
              value={effective.accountType ?? ''}
              onChange={(e) => setAccountType(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
            >
              <option value="">— Student (default) —</option>
              {userTypes.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </select>
            {effective.isSuperadmin && (
              <p className="mt-1.5 text-xs text-amber-500 font-medium">Superadmin — all permissions granted</p>
            )}
          </section>

          {/* Roles */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Shield size={13} /> Roles
              </h4>
              <span className="text-xs text-muted-foreground">{data.roles.filter((r) => r.assigned).length} assigned</span>
            </div>
            <div className="space-y-1.5">
              {data.roles.map((role) => (
                <label
                  key={role.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                    role.assigned ? 'bg-primary/10 border-primary/30' : 'bg-background border-border hover:border-primary/30',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={role.assigned}
                    onChange={() => toggleRole(role.id, role.assigned)}
                    disabled={saving || effective.isSuperadmin}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{role.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">{role.slug}</span>
                  <span className="text-[10px] text-muted-foreground">{role.permissions.length} perms</span>
                </label>
              ))}
            </div>
          </section>

          {/* Direct permissions */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Check size={13} /> Direct permissions (overrides)
            </h4>
            {data.directPermissions.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">No direct grants or denials — access comes from roles and account type.</p>
            ) : (
              <div className="space-y-1.5">
                {data.directPermissions.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border">
                    <code className="text-xs font-mono">{p.permissionKey}</code>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      p.allowed ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500',
                    )}>
                      {p.allowed ? 'GRANT' : 'DENY'}
                    </span>
                    <button
                      onClick={() => toggleDirect(p.permissionKey, !p.allowed)}
                      disabled={saving}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Flip
                    </button>
                    <button
                      onClick={() => {
                        const permissions = data.directPermissions.filter((x) => x.permissionKey !== p.permissionKey)
                          .map((x) => ({ permissionKey: x.permissionKey, allowed: x.allowed }));
                        void put(`/users/${user.id}/permissions`, { permissions });
                      }}
                      disabled={saving}
                      className="text-xs text-destructive hover:opacity-70 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Scopes */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Globe size={13} /> Access scopes
            </h4>
            {effective.scopes.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 mb-3">No scopes — access is limited to nothing scoped. Add a scope below.</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {effective.scopes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary uppercase">{s.type}</span>
                    <span className="text-sm">{scopeLabel(s.type, s.id)}</span>
                    <button
                      onClick={() => removeScope(s.type, s.id)}
                      disabled={saving}
                      className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] text-muted-foreground mb-1">Scope type</label>
                <select
                  value={newScopeType}
                  onChange={(e) => { setNewScopeType(e.target.value); setNewScopeId(''); }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  {SCOPE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] text-muted-foreground mb-1">Item</label>
                <select
                  value={newScopeId}
                  onChange={(e) => setNewScopeId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="">— Select —</option>
                  {(scopeOptions[newScopeType] || []).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={addScope}
                disabled={saving || !newScopeId}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm font-medium"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </section>

          {/* Effective permissions */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Layers size={13} /> Effective permissions
              </h4>
              <button
                onClick={() => void load()}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border">
              {granted.length === 0 && denied.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No permissions — assign a role or account type.</div>
              )}
              {granted.map((p) => (
                <div key={p.key} className="px-3 py-2 flex items-center gap-2">
                  <Check size={13} className="text-green-500 shrink-0" />
                  <code className="text-xs font-mono">{p.key}</code>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    via {p.source === 'role' ? `role · ${p.viaRole}` : p.source === 'account_type' ? 'account type' : p.source === 'direct' ? 'direct grant' : p.source}
                  </span>
                </div>
              ))}
              {denied.map((p) => (
                <div key={p.key} className="px-3 py-2 flex items-center gap-2">
                  <Minus size={13} className="text-red-500 shrink-0" />
                  <code className="text-xs font-mono line-through text-muted-foreground">{p.key}</code>
                  <span className="ml-auto text-[10px] text-red-500 font-medium">explicitly denied</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Changes are audited and take effect immediately.</p>
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserAccessDrawer;
