import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Megaphone, CheckCircle2 } from 'lucide-react';

interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  type: string;
  isActive?: boolean;
  createdAt?: string;
}

const emptyForm = () => ({
  title: '',
  content: '',
  type: 'banner',
  isActive: true,
});

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const { toast } = useToast();

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/announcements/admin');
      if (!response.ok) throw new Error('Failed to load announcements');
      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load announcements', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnnouncements();
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
      isActive: Boolean(announcement.isActive),
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
          isActive: form.isActive,
        }),
      });

      if (!response.ok) throw new Error('Failed to save announcement');
      toast({ title: 'Success', description: editing ? 'Announcement updated' : 'Announcement created' });
      setIsModalOpen(false);
      await fetchAnnouncements();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save announcement', variant: 'destructive' });
    }
  };

  const handleDelete = async (announcementId: number) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const response = await fetch(`/api/announcements/${announcementId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete announcement');
      toast({ title: 'Success', description: 'Announcement deleted' });
      await fetchAnnouncements();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete announcement', variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Announcements</h2>
          <p className="text-sm text-muted-foreground">Manage in-app announcements and system notices.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> New Announcement
        </button>
      </div>

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
                  <p className="text-sm text-muted-foreground">{announcement.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">{announcement.type}</span>
                    {announcement.isActive ? <span className="rounded-full bg-green-500/10 px-2 py-1 text-green-600">Active</span> : <span className="rounded-full bg-muted px-2 py-1">Inactive</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(announcement)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"><Pencil size={16} /></button>
                  <button onClick={() => void handleDelete(announcement.id)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
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
                <textarea required rows={4} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Type</label>
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                    <option value="banner">Banner (top bar)</option>
                    <option value="ticker">Ticker (bottom news strip)</option>
                    <option value="popup">Popup (modal)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 pt-7 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                  Active
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
    </div>
  );
}
