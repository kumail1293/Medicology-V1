import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  UserCog,
  Users as UsersIcon,
  X,
  KeyRound,
  ShieldCheck,
  Mail,
  Link2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface UserType {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: string;
  registrationAllowed: boolean;
  requiresApproval: boolean;
  invitationOnly: boolean;
  defaultRole: string | null;
  canAccessAdmin: boolean;
  sortOrder: number;
  userCount: number;
}

interface RoleOption {
  id: number;
  name: string;
  slug: string;
  status: string;
}

function UserTypeManagerPage() {
  const { toast } = useToast();
  const [types, setTypes] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UserType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    color: '#3b82f6',
    status: 'active',
    registrationAllowed: false,
    requiresApproval: false,
    invitationOnly: false,
    defaultRole: '',
    canAccessAdmin: false,
    sortOrder: 0,
  });

  const token = localStorage.getItem('medicology_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [t, r] = await Promise.all([
        fetch('/api/admin/rbac/user-types', { headers }),
        fetch('/api/admin/rbac/roles', { headers }),
      ]);
      const td = await t.json();
      const rd = await r.json();
      setTypes(td.userTypes || []);
      setRoles((rd.roles || []).filter((x: RoleOption) => x.status !== 'archived'));
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load account types', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', slug: '', description: '', icon: '', color: '#3b82f6', status: 'active',
      registrationAllowed: false, requiresApproval: false, invitationOnly: false,
      defaultRole: '', canAccessAdmin: false, sortOrder: 0,
    });
    setEditorOpen(true);
  };

  const openEdit = (t: UserType) => {
    setEditing(t);
    setForm({
      name: t.name, slug: t.slug, description: t.description ?? '', icon: t.icon ?? '',
      color: t.color ?? '#3b82f6', status: t.status, registrationAllowed: t.registrationAllowed,
      requiresApproval: t.requiresApproval, invitationOnly: t.invitationOnly,
      defaultRole: t.defaultRole ?? '', canAccessAdmin: t.canAccessAdmin, sortOrder: t.sortOrder,
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ title: 'Validation', description: 'Name and slug are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        ...form,
        description: form.description || null,
        icon: form.icon || null,
        defaultRole: form.defaultRole || null,
      });
      const res = await fetch(
        editing ? `/api/admin/rbac/user-types/${editing.id}` : '/api/admin/rbac/user-types',
        { method: editing ? 'PUT' : 'POST', headers, body },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save account type');
      toast({ title: 'Success', description: editing ? 'Account type updated' : 'Account type created' });
      setEditorOpen(false);
      void fetchAll();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) => (
    <label className="flex items-center justify-between gap-3 px-4 py-3 border border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={clsx(
          'relative w-10 h-5.5 rounded-full transition-colors shrink-0',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
        style={{ height: 22 }}
      >
        <span
          className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 20 : 2 }}
        />
      </button>
    </label>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <UserCog size={26} className="text-primary" />
            Account Types
          </h2>
          <p className="text-muted-foreground">
            Account types define what kind of account a user has. Each type can allow registration, require approval,
            or be invitation-only, and carries a default role.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          New Account Type
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading account types...</div>
      ) : types.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-lg">
          No account types yet. Create one to start.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {types.map((t) => (
            <div key={t.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-semibold"
                    style={{ backgroundColor: t.color || '#3b82f6' }}
                  >
                    {(t.icon || t.name[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                    (t.status ?? 'active') === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground',
                  )}>
                    {(t.status ?? 'active').toUpperCase()}
                  </span>
                  <button onClick={() => openEdit(t)} title="Edit" className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              {t.description && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{t.description}</p>}

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UsersIcon size={12} /> {t.userCount} users
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <KeyRound size={12} /> {t.defaultRole ? t.defaultRole.replace(/_/g, ' ') : 'none'}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail size={12} /> {t.registrationAllowed ? 'Open registration' : 'No registration'}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Link2 size={12} /> {t.invitationOnly ? 'Invite only' : 'Open'}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.requiresApproval && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500">Requires approval</span>
                )}
                {t.canAccessAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">Admin access</span>
                )}
                {!t.requiresApproval && !t.canAccessAdmin && (
                  <span className="text-[10px] text-muted-foreground">Standard student-type access</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? `Edit — ${editing.name}` : 'Create Account Type'}</h3>
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
                    placeholder="e.g. Institutional Admin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Slug</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono"
                    placeholder="institutional_admin"
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
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Icon (letter/emoji)</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Display color</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full h-10 border border-border rounded-lg bg-background cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Default role</label>
                  <select
                    value={form.defaultRole}
                    onChange={(e) => setForm({ ...form, defaultRole: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    <option value="">— None —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Toggle
                  label="Registration allowed"
                  hint="Users can sign up with this account type"
                  checked={form.registrationAllowed}
                  onChange={(v) => setForm({ ...form, registrationAllowed: v })}
                />
                <Toggle
                  label="Requires approval"
                  hint="New accounts wait for an admin to approve"
                  checked={form.requiresApproval}
                  onChange={(v) => setForm({ ...form, requiresApproval: v })}
                />
                <Toggle
                  label="Invitation only"
                  hint="Only admins can create accounts of this type"
                  checked={form.invitationOnly}
                  onChange={(v) => setForm({ ...form, invitationOnly: v })}
                />
                <Toggle
                  label="Can access admin panel"
                  hint="Members see and can use the /admin area (permissions still apply)"
                  checked={form.canAccessAdmin}
                  onChange={(v) => setForm({ ...form, canAccessAdmin: v })}
                />
              </div>

              <div className="flex items-center justify-between px-4 py-3 border border-border rounded-lg">
                <label className="text-sm">Sort order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-24 px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-right"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setEditorOpen(false)} className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Create type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info strip */}
      <div className="mt-8 flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
        <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-foreground">How access works:</span> account-type default role →
          assigned roles → direct grants → explicit denials. Denials always win. Effective permissions are
          calculated and enforced on the server for every request.
        </p>
      </div>
    </div>
  );
}

export default UserTypeManagerPage;
