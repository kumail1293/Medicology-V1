import { useEffect, useState } from "react";
import { X, Search, Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MEDIA_CATEGORIES, MEDIA_CATEGORY_LABELS, MediaItem, listMedia, uploadMedia } from "@/lib/media";

export default function MediaPicker({
  open,
  onClose,
  onSelect,
  category,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  category?: string;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(category ?? "all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
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
    if (open) {
      setFilter(category ?? "all");
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const media = await uploadMedia(file, { category: filter === "all" ? "rich_content" : (filter as any) });
      toast({ title: "Uploaded", description: media.originalName });
      void load();
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 font-bold">
            <ImageIcon size={16} className="text-primary" /> Media Library
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
              placeholder="Search by name or alt text…"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">All categories</option>
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>{MEDIA_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
            {uploading ? <span className="animate-pulse">Uploading…</span> : (<><Upload size={14} /> Upload</>)}
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ""; }} />
          </label>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No media yet — upload an image to get started.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((m) => (
                <button key={m.id} onClick={() => onSelect(m)}
                  className="group overflow-hidden rounded-xl border border-border bg-background text-left transition-all hover:border-primary/50 hover:shadow-md">
                  <div className="aspect-square w-full overflow-hidden bg-muted/40">
                    {m.mimeType === "image/svg+xml" ? (
                      <img src={m.url} alt={m.altText ?? m.originalName} className="h-full w-full object-contain p-2" />
                    ) : (
                      <img src={m.url} alt={m.altText ?? m.originalName} loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    )}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-xs font-medium">{m.originalName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.width && m.height ? `${m.width}×${m.height} · ` : ""}{(m.sizeBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
