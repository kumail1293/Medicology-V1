import { useMemo, useState } from "react";
import { useGetBookmarks, useGetWrongQuestions, useGetNotes, useUpsertNote } from "@workspace/api-client-react";
import { QuestionView } from "@/components/QuestionView";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BookMarked, XOctagon, FileText, Play, Save, Trash2, Pencil, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { richTextToPlain } from "@/lib/richText";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Tab = "bookmarks" | "wrong" | "notes";

export default function ReviewHub() {
  const [tab, setTab] = useState<Tab>("bookmarks");
  const bookmarks = useGetBookmarks();
  const wrong = useGetWrongQuestions({});
  const notes = useGetNotes();

  const counts = {
    bookmarks: bookmarks.data?.questions?.length ?? 0,
    wrong: wrong.data?.questions?.length ?? 0,
    notes: notes.data?.length ?? 0,
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Review Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Revisit bookmarks, wrong answers, and personal notes</p>
      </div>

      <div className="inline-flex bg-muted p-1 rounded-xl">
        {([
          { key: "bookmarks", label: "Bookmarks", icon: BookMarked },
          { key: "wrong", label: "Wrong Qs", icon: XOctagon },
          { key: "notes", label: "Notes", icon: FileText },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              tab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <div>
        {tab === "bookmarks" && <BookmarksTab />}
        {tab === "wrong" && <WrongTab />}
        {tab === "notes" && <NotesTab />}
      </div>
    </div>
  );
}

// Shared list shell — search box + empty/list renderer.
function ListShell({ title, count, search, onSearch, children }: {
  title: string;
  count: number;
  search: string;
  onSearch: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{count} {title}</p>
        <div className="relative w-64 max-w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search this list…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function NoSearchResults() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <SearchX className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">No questions match your search.</p>
      </CardContent>
    </Card>
  );
}

function BookmarksTab() {
  const { data, isLoading } = useGetBookmarks();
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const questions = data?.questions ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item: any) =>
      richTextToPlain(item.questionText).toLowerCase().includes(q) ||
      String(item.subject ?? "").toLowerCase().includes(q)
    );
  }, [questions, search]);

  if (isLoading) return <LoadingState />;
  if (!questions.length) return (
    <EmptyState icon={BookMarked} message="No bookmarks yet. Bookmark questions while practicing!" />
  );

  if (viewIdx !== null && filtered[viewIdx]) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{viewIdx + 1} / {filtered.length}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setViewIdx(null)}>Back to List</Button>
        </div>
        <QuestionView
          question={filtered[viewIdx]}
          mode="practice"
          onNext={() => setViewIdx((i) => Math.min((i ?? 0) + 1, filtered.length - 1))}
          onPrev={() => setViewIdx((i) => Math.max((i ?? 0) - 1, 0))}
          hasNext={viewIdx < filtered.length - 1}
          hasPrev={viewIdx > 0}
        />
      </div>
    );
  }

  return (
    <ListShell title="bookmarked questions" count={filtered.length} search={search} onSearch={setSearch}>
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setViewIdx(0)}>
          <Play className="h-4 w-4 mr-1" /> Practice All
        </Button>
      </div>
      {filtered.length === 0 ? <NoSearchResults /> : (
        filtered.map((q: any, i: number) => (
          <Card key={q.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setViewIdx(i)}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">{q.subject}</Badge>
                <p className="text-sm line-clamp-2">{richTextToPlain(q.questionText)}</p>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </ListShell>
  );
}

function WrongTab() {
  const { data, isLoading } = useGetWrongQuestions({});
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const questions = data?.questions ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item: any) =>
      richTextToPlain(item.questionText).toLowerCase().includes(q) ||
      String(item.subject ?? "").toLowerCase().includes(q)
    );
  }, [questions, search]);

  if (isLoading) return <LoadingState />;
  if (!questions.length) return (
    <EmptyState icon={XOctagon} message="No wrong questions yet. Keep practicing!" />
  );

  if (viewIdx !== null && filtered[viewIdx]) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{viewIdx + 1} / {filtered.length}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setViewIdx(null)}>Back to List</Button>
        </div>
        <QuestionView
          question={filtered[viewIdx]}
          mode="practice"
          onNext={() => setViewIdx((i) => Math.min((i ?? 0) + 1, filtered.length - 1))}
          onPrev={() => setViewIdx((i) => Math.max((i ?? 0) - 1, 0))}
          hasNext={viewIdx < filtered.length - 1}
          hasPrev={viewIdx > 0}
        />
      </div>
    );
  }

  return (
    <ListShell title="questions to review" count={filtered.length} search={search} onSearch={setSearch}>
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setViewIdx(0)}>
          <Play className="h-4 w-4 mr-1" /> Retry All
        </Button>
      </div>
      {filtered.length === 0 ? <NoSearchResults /> : (
        filtered.map((q: any, i: number) => (
          <Card key={q.id} className="cursor-pointer hover:border-destructive/50 transition-colors border-l-4 border-l-red-400" onClick={() => setViewIdx(i)}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">{q.subject}</Badge>
                <p className="text-sm line-clamp-2">{richTextToPlain(q.questionText)}</p>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </ListShell>
  );
}

function NotesTab() {
  const { data: notes, isLoading } = useGetNotes();
  const upsertMutation = useUpsertNote();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes ?? [];
    return (notes ?? []).filter((n: any) =>
      (n.noteText ?? "").toLowerCase().includes(q) ||
      String(n.questionId ?? "").includes(q)
    );
  }, [notes, search]);

  if (isLoading) return <LoadingState />;
  if (!notes?.length) return (
    <EmptyState icon={FileText} message="No notes yet. Add notes to questions while practicing!" />
  );

  const handleSave = async (questionId: number) => {
    await upsertMutation.mutateAsync({ questionId, data: { noteText: editContent } });
    queryClient.invalidateQueries({ queryKey: ["getNotes"] });
    setEditingId(null);
    toast({ title: "Note saved" });
  };

  const handleDelete = async (questionId: number) => {
    if (!window.confirm("Delete this note?")) return;
    setDeletingId(questionId);
    try {
      const token = localStorage.getItem("medicology_token");
      const res = await fetch(`/api/notes/${questionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["getNotes"] });
      toast({ title: "Note deleted" });
    } catch {
      toast({ title: "Delete failed", description: "Could not delete the note.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ListShell title="notes" count={filtered.length} search={search} onSearch={setSearch}>
      {filtered.length === 0 ? <NoSearchResults /> : (
        filtered.map((note: any) => (
          <Card key={note.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">QID #{note.questionId}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ""}
                  </span>
                </div>
                {editingId !== note.questionId && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { setEditingId(note.questionId); setEditContent(note.noteText ?? ""); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(note.questionId)} disabled={deletingId === note.questionId}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {editingId === note.questionId ? (
                <div className="space-y-2">
                  <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(note.questionId)} disabled={upsertMutation.isPending}>
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap text-foreground">{note.noteText}</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </ListShell>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
      Loading...
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
