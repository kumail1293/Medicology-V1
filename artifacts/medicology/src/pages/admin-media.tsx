import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Link2, Search, ImageIcon, Loader2, X, Maximize2 } from "lucide-react";
import {
  MEDIA_CATEGORIES, MEDIA_CATEGORY_LABELS, MediaItem,
  listMedia, uploadMedia, updateMedia, deleteMedia, formatBytes,
} from "@/lib/media";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function AdminMediaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [editingAlt, setEditingAlt] = useState<number | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setItems(await listMedia({ category: filter, search }));
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load media", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadTotal(files.length);
    let done = 0;
    let failed = 0;
    try {
      for (const file of files) {
        try {
          await uploadMedia(file, { category: filter === "all" ? "rich_content" : (filter as any) });
        } catch {
          failed++;
          toast({ title: "Upload failed", description: `${file.name}: ${errMessage()}`, variant: "destructive" });
        }
        done++;
        setUploadProgress(done);
      }
      if (done - failed > 0) toast({ title: "Uploaded", description: `${done - failed} file(s) added to the library.` });
      void fetchItems();
    } finally {
      setUploading(false);
    }
  };

  function errMessage() {
    return "Please check the file type/size and try again";
  }

  const saveAlt = async (m: MediaItem) => {
    try {
      await updateMedia(m.id, { altText: altDraft });
      toast({ title: "Saved", description: "Alt text updated." });
      setEditingAlt(null);
      void fetchItems();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update", variant: "destructive" });
    }
  };

  const saveCategory = async (m: MediaItem, category: string) => {
    try {
      await updateMedia(m.id, { category: category as any });
      setCategoryDraft((d) => ({ ...d, [m.id]: category }));
      toast({ title: "Saved", description: "Category updated." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update", variant: "destructive" });
    }
  };

  const handleDelete = async (m: MediaItem) => {
    if (!window.confirm(`Delete "${m.originalName}"? The file will be removed permanently.`)) return;
    try {
      await deleteMedia(m.id);
      toast({ title: "Deleted", description: m.originalName });
      void fetchItems();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete", variant: "destructive" });
    }
  };

  const copyUrl = async (m: MediaItem) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + m.url);
      toast({ title: "Copied", description: "Image URL copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select and copy the URL manually.", variant: "destructive" });
    }
  };

  const isAdmin = user?.isAdmin || user?.role === "admin" || user?.role === "superadmin";

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Media Library</h2>
          <p className="text-sm text-muted-foreground">Logos, covers and rich-content images — validated uploads with metadata.</p>
        </div>
        <label className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90",
          uploading && "opacity-60"
        )}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? `Uploading ${uploadProgress}/${uploadTotal}…` : "Upload images"}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) void handleUpload(files); e.target.value = ""; }} />
        </label>
      </div>

      {/* Drag & drop zone (visible when not uploading) */}
      {!uploading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (files.length) void handleUpload(files);
          }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition-colors cursor-pointer",
            dragOver ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          Drag & drop images here, or click to browse (multiple allowed)
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void fetchItems(); }}
            placeholder="Search by name or alt text…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter("all")}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", filter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>
            All
          </button>
          {MEDIA_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", filter === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>
              {MEDIA_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">Loading media…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No media yet — upload an image to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
              <button onClick={() => setLightbox(m)} className="relative block aspect-square w-full overflow-hidden bg-muted/40 cursor-zoom-in">
                {m.mimeType === "image/svg+xml" ? (
                  <img src={m.url} alt={m.altText ?? m.originalName} className="h-full w-full object-contain p-3" />
                ) : (
                  <img src={m.url} alt={m.altText ?? m.originalName} loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                )}
                <span className="absolute right-2 top-2 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 size={12} />
                </span>
              </button>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium" title={m.originalName}>{m.originalName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.width && m.height ? `${m.width}×${m.height} · ` : ""}{formatBytes(m.sizeBytes)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => void copyUrl(m)} title="Copy URL" className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"><Link2 size={13} /></button>
                    {isAdmin && (
                      <button onClick={() => void handleDelete(m)} title="Delete" className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon size={12} className="shrink-0 text-muted-foreground" />
                  <select
                    value={categoryDraft[m.id] ?? m.category}
                    onChange={(e) => void saveCategory(m, e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                  >
                    {MEDIA_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{MEDIA_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                {editingAlt === m.id ? (
                  <div className="flex gap-1.5">
                    <input
                      value={altDraft}
                      onChange={(e) => setAltDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveAlt(m); }}
                      autoFocus
                      placeholder="Alt text…"
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                    />
                    <button onClick={() => void saveAlt(m)} className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-white">Save</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingAlt(m.id); setAltDraft(m.altText ?? ""); }}
                    className="w-full truncate rounded-md border border-dashed border-border px-2 py-1 text-left text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {m.altText || "Add alt text…"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox preview */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.altText ?? lightbox.originalName}
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 rounded-full bg-card p-2 shadow-lg border border-border hover:bg-muted"
            >
              <X size={16} />
            </button>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/90">
              <div className="min-w-0">
                <p className="font-medium truncate">{lightbox.originalName}</p>
                <p className="text-xs text-white/60">
                  {lightbox.width && lightbox.height ? `${lightbox.width}×${lightbox.height} · ` : ""}
                  {formatBytes(lightbox.sizeBytes)} · {MEDIA_CATEGORY_LABELS[lightbox.category]}
                </p>
                {lightbox.altText && <p className="mt-1 text-xs text-white/70">Alt: {lightbox.altText}</p>}
              </div>
              <button
                onClick={() => void copyUrl(lightbox)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
              >
                <Link2 size={13} /> Copy URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
