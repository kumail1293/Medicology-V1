import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Megaphone, LayoutTemplate, Copy, CalendarClock, Send } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  type: string;
  theme?: string;
  priority?: string;
  isActive?: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  dismissible?: boolean;
  frequency?: string;
  targetRoles?: string;
  targetRoute?: string;
  buttonText?: string;
  buttonUrl?: string;
  createdAt?: string;
}

interface TemplateItem {
  id: number;
  name: string;
  category: string;
  type: string;
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  theme: string;
  priority: string;
  targetRoles?: string;
  updatedAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  banner: 'Banner (top bar)',
  ticker: 'Ticker (bottom strip)',
  popup: 'Popup (center modal)',
  modal: 'Modal (themed dialog)',
  toast: 'Toast (corner notification)',
  exam_alert: 'Exam Alert',
  promotion: 'Promotion (with CTA)',
};

const THEME_LABELS: Record<string, string> = {
  info: 'Info (blue)',
  success: 'Success (green)',
  warning: 'Warning (amber)',
  error: 'Error (red)',
  primary: 'Brand',
};

const CATEGORY_LABELS: Record<string, string> = {
  exam_alert: 'Exam Alert',
  qbank_launch: 'QBank Launch',
  promotion: 'Promotion',
  system_notice: 'System Notice',
  maintenance: 'Maintenance',
  feature: 'New Feature',
  custom: 'Custom',
};

const FREQUENCY_LABELS: Record<string, string> = {
  once: 'Once (per user)',
  daily: 'Daily',
  every_visit: 'Every visit',
};

const emptyForm = () => ({
  title: '',
  content: '',
  type: 'banner',
  theme: 'info',
  priority: 'normal',
  isActive: true,
  dismissible: true,
  frequency: 'every_visit',
  startsAt: '',
  expiresAt: '',
  targetRoles: 'all',
  targetRoute: '',
  buttonText: '',
  buttonUrl: '',
});

const emptyTemplate = () => ({
  name: '',
  category: 'custom',
  type: 'banner',
  title: '',
  content: '',
  theme: 'info',
  priority: 'normal',
  buttonText: '',
  buttonUrl: '',
  targetRoles: 'all',
});

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [tForm, setTForm] = useState(emptyTemplate());
  const { toast } = useToast();

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [annRes, tplRes] = await Promise.all([
        fetch('/api/announcements/admin'),
        fetch('/api/announcements/templates'),
      ]);
      if (!annRes.ok || !tplRes.ok) throw new Error('Failed to load');
      const annData = await annRes.json();
      const tplData = await tplRes.json();
      setAnnouncements(annData.announcements || []);
      setTemplates(tplData.templates || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load announcements', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (announcement: AnnouncementItem) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      theme: announcement.theme || 'info',
      priority: announcement.priority || 'normal',
      isActive: Boolean(announcement.isActive),
      dismissible: announcement.dismissible !== false,
      frequency: announcement.frequency || 'every_visit',
      startsAt: announcement.startsAt ? announcement.startsAt.slice(0, 16) : '',
      expiresAt: announcement.expiresAt ? announcement.expiresAt.slice(0, 16) : '',
      targetRoles: announcement.targetRoles || 'all',
      targetRoute: announcement.targetRoute || '',
      buttonText: announcement.buttonText || '',
      buttonUrl: announcement.buttonUrl || '',
    });
    setIsModalOpen(true);
  };

  // "Use template" — prefill the announcement form from a saved template.
  const useTemplate = (t: TemplateItem) => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      title: t.title,
      content: t.content,
      type: t.type,
      theme: t.theme || 'info',
      priority: t.priority || 'normal',
      targetRoles: t.targetRoles || 'all',
      buttonText: t.buttonText || '',
      buttonUrl: t.buttonUrl || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/announcements/${editing.id}` : '/api/announcements';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          type: form.type,
          theme: form.theme,
          priority: form.priority,
          isActive: form.isActive,
          dismissible: form.dismissible,
          frequency: form.frequency,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          targetRoles: form.targetRoles,
          targetRoute: form.targetRoute || null,
          buttonText: form.buttonText || null,
          buttonUrl: form.buttonUrl || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save announcement');
      }
      toast({ title: 'Success', description: editing ? 'Announcement updated' : 'Announcement created' });
      setIsModalOpen(false);
      await fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save announcement', variant: 'destructive' });
    }
  };

  const handleEmail = async (announcement: AnnouncementItem) => {
    if (!window.confirm(`Email \"${announcement.title}\" to its audience? Sends use the announcement email template.`)) return;
    try {
      const response = await fetch(`/api/announcements/${announcement.id}/email`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to email announcement');
      toast({ title: 'Email sent', description: `Queued for ${data.recipients} recipient(s). Check Send Logs under Email Templates.` });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to email announcement', variant: 'destructive' });
    }
  };

  const handleDelete = async (announcementId: number) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const response = await fetch(`/api/announcements/${announcementId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete announcement');
      toast({ title: 'Success', description: 'Announcement deleted' });
      await fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete announcement', variant: 'destructive' });
    }
  };

  const openTemplateCreate = () => {
    setEditingTemplate(null);
    setTForm(emptyTemplate());
    setTemplateModal(true);
  };

  const openTemplateEdit = (t: TemplateItem) => {
    setEditingTemplate(t);
    setTForm({
      name: t.name,
      category: t.category || 'custom',
      type: t.type,
      title: t.title,
      content: t.content,
      theme: t.theme || 'info',
      priority: t.priority || 'normal',
      buttonText: t.buttonText || '',
      buttonUrl: t.buttonUrl || '',
      targetRoles: t.targetRoles || 'all',
    });
    setTemplateModal(true);
  };

  const handleTemplateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate ? `/api/announcements/templates/${editingTemplate.id}` : '/api/announcements/templates';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tForm),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save template');
      }
      toast({ title: 'Success', description: editingTemplate ? 'Template updated' : 'Template created' });
      setTemplateModal(false);
      await fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save template', variant: 'destructive' });
    }
  };

  const handleTemplateDelete = async (id: number) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      const response = await fetch(`/api/announcements/templates/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete template');
      toast({ title: 'Success', description: 'Template deleted' });
      await fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Announcements</h2>
          <p className="text-sm text-muted-foreground">Scheduled, themed in-app announcements with reusable templates.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {/* Templates */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <LayoutTemplate size={16} className="text-primary" /> Reusable Templates
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{templates.length}</span>
          </div>
          <button onClick={openTemplateCreate} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary">
            <Plus size={13} /> New Template
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No templates yet — create skeletons for exam alerts, QBank launches, promotions…</p>
        ) : (
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[t.category] || t.category} · {TYPE_LABELS[t.type] || t.type}</div>
                  </div>
                  <button onClick={() => void useTemplate(t)} title="Use template"
                    className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-1.5 text-primary hover:bg-primary/10">
                    <Copy size={13} />
                  </button>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.content.replace(/<[^>]+>/g, '')}</p>
                <div className="mt-auto flex gap-1.5">
                  <button onClick={() => openTemplateEdit(t)} className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                  <button onClick={() => void handleTemplateDelete(t.id)} className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Announcements list */}
      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading announcements…</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No announcements yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="flex items-start justify-between gap-4 p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Megaphone size={16} className="text-primary" />
                    <span className="font-semibold">{announcement.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{announcement.content.replace(/<[^>]+>/g, '')}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">{TYPE_LABELS[announcement.type] || announcement.type}</span>
                    <span className="rounded-full bg-muted px-2 py-1">{(announcement.theme || 'info').toUpperCase()}</span>
                    <span className="rounded-full bg-muted px-2 py-1">{announcement.priority}</span>
                    {announcement.startsAt && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                        <CalendarClock size={11} /> {new Date(announcement.startsAt).toLocaleString()}
                      </span>
                    )}
                    {announcement.isActive ? <span className="rounded-full bg-green-500/10 px-2 py-1 text-green-600">Active</span> : <span className="rounded-full bg-muted px-2 py-1">Inactive</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(announcement)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground" title="Edit"><Pencil size={16} /></button>
                  <button onClick={() => void handleEmail(announcement)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-primary" title="Email to audience"><Send size={16} /></button>
                  <button onClick={() => void handleDelete(announcement.id)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Announcement modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editing ? 'Edit Announcement' : 'New Announcement'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Message</label>
                <RichTextEditor value={form.content} onChange={(html) => setForm({ ...form, content: html })} placeholder="Announcement — supports formatting, images, tables…" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Type</label>
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Theme</label>
                  <select value={form.theme} onChange={(event) => setForm({ ...form, theme: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    {Object.entries(THEME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Priority</label>
                  <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Frequency</label>
                  <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Starts at (schedule)</label>
                  <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Expires at</label>
                  <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Audience (roles, comma-separated, "all")</label>
                  <input value={form.targetRoles} onChange={(event) => setForm({ ...form, targetRoles: event.target.value })} placeholder="all" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Target route (optional, e.g. /exam)</label>
                  <input value={form.targetRoute} onChange={(event) => setForm({ ...form, targetRoute: event.target.value })} placeholder="/practice" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Button text</label>
                  <input value={form.buttonText} onChange={(event) => setForm({ ...form, buttonText: event.target.value })} placeholder="Learn more" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Button URL</label>
                  <input value={form.buttonUrl} onChange={(event) => setForm({ ...form, buttonUrl: event.target.value })} placeholder="https://…" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.dismissible} onChange={(event) => setForm({ ...form, dismissible: event.target.checked })} /> Dismissible
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template modal */}
      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => setTemplateModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleTemplateSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Template name</label>
                  <input required value={tForm.name} onChange={(event) => setTForm({ ...tForm, name: event.target.value })} placeholder="Midterm Exam Alert" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Category</label>
                  <select value={tForm.category} onChange={(event) => setTForm({ ...tForm, category: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Type</label>
                  <select value={tForm.type} onChange={(event) => setTForm({ ...tForm, type: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Theme</label>
                  <select value={tForm.theme} onChange={(event) => setTForm({ ...tForm, theme: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    {Object.entries(THEME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Template title</label>
                <input required value={tForm.title} onChange={(event) => setTForm({ ...tForm, title: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Template message</label>
                <RichTextEditor value={tForm.content} onChange={(html) => setTForm({ ...tForm, content: html })} placeholder="Reusable rich body — tables, images…" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Button text</label>
                  <input value={tForm.buttonText} onChange={(event) => setTForm({ ...tForm, buttonText: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Button URL</label>
                  <input value={tForm.buttonUrl} onChange={(event) => setTForm({ ...tForm, buttonUrl: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Audience</label>
                  <input value={tForm.targetRoles} onChange={(event) => setTForm({ ...tForm, targetRoles: event.target.value })} placeholder="all" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setTemplateModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
