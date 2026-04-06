import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen, Search, X, Bookmark, BookmarkCheck, ArrowLeft, Play,
  Tag, Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

const SUBJECTS = [
  'Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology',
  'Microbiology', 'Forensic Medicine', 'Community Medicine', 'Medicine',
  'Surgery', 'Gynecology & Obstetrics', 'Pediatrics', 'ENT',
  'Ophthalmology', 'Dermatology', 'Psychiatry', 'Radiology',
];

const SUBJECT_COLORS: Record<string, string> = {
  'Anatomy':                'bg-red-500/10 text-red-600',
  'Physiology':             'bg-yellow-500/10 text-yellow-700',
  'Biochemistry':           'bg-purple-500/10 text-purple-600',
  'Pathology':              'bg-orange-500/10 text-orange-600',
  'Pharmacology':           'bg-blue-500/10 text-blue-600',
  'Microbiology':           'bg-green-500/10 text-green-700',
  'Forensic Medicine':      'bg-slate-500/10 text-slate-600',
  'Community Medicine':     'bg-teal-500/10 text-teal-600',
  'Medicine':               'bg-cyan-500/10 text-cyan-700',
  'Surgery':                'bg-rose-500/10 text-rose-600',
  'Gynecology & Obstetrics':'bg-pink-500/10 text-pink-600',
  'Pediatrics':             'bg-amber-500/10 text-amber-700',
  'ENT':                    'bg-indigo-500/10 text-indigo-600',
  'Ophthalmology':          'bg-violet-500/10 text-violet-600',
  'Dermatology':            'bg-lime-500/10 text-lime-700',
  'Psychiatry':             'bg-fuchsia-500/10 text-fuchsia-600',
  'Radiology':              'bg-sky-500/10 text-sky-600',
};

interface Note {
  id: number;
  title: string;
  subject: string;
  content: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
}

function useBookmarks() {
  const [bookmarked, setBookmarked] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('medicology_note_bookmarks') || '[]'); } catch { return []; }
  });
  const save = (ids: number[]) => {
    setBookmarked(ids);
    localStorage.setItem('medicology_note_bookmarks', JSON.stringify(ids));
  };
  const toggle = async (id: number) => {
    const next = bookmarked.includes(id) ? bookmarked.filter(x => x !== id) : [...bookmarked, id];
    save(next);
    if (!bookmarked.includes(id)) {
      try {
        const token = localStorage.getItem('medicology_token');
        // TODO: implement on backend
        await fetch(`/api/notes/bookmark/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
  };
  return { bookmarked, toggle };
}

/* ─── Note Card ─────────────────────────────────────────────────────────────── */
function NoteCard({ note, isBookmarked, onBookmark, onClick }: {
  note: Note;
  isBookmarked: boolean;
  onBookmark: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const preview = note.content.replace(/[#*`>\-]/g, '').trim().slice(0, 100);
  const subjectColor = SUBJECT_COLORS[note.subject] || 'bg-muted text-muted-foreground';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', subjectColor)}>
          {note.subject}
        </span>
        <button
          onClick={onBookmark}
          className={clsx(
            'p-1.5 rounded-lg transition-all shrink-0',
            isBookmarked
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100'
          )}
        >
          {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </div>

      <h3 className="font-bold text-sm leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {note.title}
      </h3>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">
        {preview}{note.content.length > 100 ? '…' : ''}
      </p>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.slice(0, 4).map(tag => (
            <span key={tag} className="flex items-center gap-0.5 text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              <Tag size={9} /> {tag}
            </span>
          ))}
          {note.tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground px-1">+{note.tags.length - 4}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Reading View ───────────────────────────────────────────────────────────── */
function NoteReadingView({ note, isBookmarked, onBookmark, onClose }: {
  note: Note;
  isBookmarked: boolean;
  onBookmark: () => void;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const subjectColor = SUBJECT_COLORS[note.subject] || 'bg-muted text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto"
    >
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft size={16} /> Back to Notes
          </button>
          <div className="flex-1" />
          <button
            onClick={onBookmark}
            className={clsx(
              'flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-all',
              isBookmarked
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
            )}
          >
            {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button
            onClick={() => setLocation(`/create-test?subject=${encodeURIComponent(note.subject)}`)}
            className="flex items-center gap-1.5 text-sm font-bold bg-primary text-primary-foreground px-4 py-1.5 rounded-xl hover:bg-primary/90 transition-all"
          >
            <Play size={14} /> Practice MCQs
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="mb-6">
          <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full inline-block mb-4', subjectColor)}>
            {note.subject}
          </span>
          <h1 className="text-3xl font-display font-extrabold leading-tight mb-4">
            {note.title}
          </h1>
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {note.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium">
                  <Tag size={11} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Note content rendered as preformatted text */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <pre className="text-sm leading-relaxed text-foreground font-sans whitespace-pre-wrap break-words">
            {note.content}
          </pre>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 p-5 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4">
          <BookOpen size={24} className="text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Ready to test yourself on {note.subject}?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Practice MCQs related to this topic</p>
          </div>
          <button
            onClick={() => setLocation(`/create-test?subject=${encodeURIComponent(note.subject)}`)}
            className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all"
          >
            <Play size={14} /> Practice Related MCQs
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────────────── */
function NoteSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-pulse space-y-3">
      <div className="h-5 w-24 bg-muted rounded-full" />
      <div className="h-4 w-3/4 bg-muted rounded" />
      <div className="space-y-1.5">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-5/6" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
      <div className="flex gap-1">
        <div className="h-4 w-12 bg-muted rounded-full" />
        <div className="h-4 w-16 bg-muted rounded-full" />
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function NotesPage() {
  const { toast } = useToast();
  const { bookmarked, toggle: toggleBookmark } = useBookmarks();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const [subjectFilter, setSubjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('medicology_token');
      const params = new URLSearchParams();
      if (subjectFilter) params.set('subject', subjectFilter);
      if (search) params.set('search', search);
      // TODO: implement on backend
      const res = await fetch(`/api/notes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchNotes, 300);
    return () => clearTimeout(t);
  }, [subjectFilter, search]);

  const displayedNotes = showBookmarkedOnly
    ? notes.filter(n => bookmarked.includes(n.id))
    : notes;

  return (
    <>
      <PageTransition className="max-w-5xl mx-auto pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-3">
              <BookOpen size={28} className="text-primary" />
              Notes Library
            </h1>
            <p className="text-muted-foreground mt-1">High-yield study notes curated by faculty</p>
          </div>
          {bookmarked.length > 0 && (
            <button
              onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all',
                showBookmarkedOnly
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50 text-muted-foreground'
              )}
            >
              <BookmarkCheck size={15} />
              {showBookmarkedOnly ? 'All Notes' : `Bookmarked (${bookmarked.length})`}
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, content, or tag…"
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
            >
              <option value="">All Subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {(subjectFilter || search || showBookmarkedOnly) && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {subjectFilter && (
              <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                {subjectFilter}
                <button onClick={() => setSubjectFilter('')}><X size={11} /></button>
              </span>
            )}
            {search && (
              <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                "{search}"
                <button onClick={() => setSearch('')}><X size={11} /></button>
              </span>
            )}
            {showBookmarkedOnly && (
              <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                Bookmarked only
                <button onClick={() => setShowBookmarkedOnly(false)}><X size={11} /></button>
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <NoteSkeleton key={i} />)}
          </div>
        ) : displayedNotes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-bold mb-2">
              {showBookmarkedOnly ? 'No bookmarked notes' : 'No notes found'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {showBookmarkedOnly
                ? 'Bookmark notes while reading to find them here'
                : search || subjectFilter
                  ? 'Try adjusting your filters'
                  : 'Notes will appear here once published by admin'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                isBookmarked={bookmarked.includes(note.id)}
                onBookmark={e => { e.stopPropagation(); toggleBookmark(note.id); }}
                onClick={() => setSelectedNote(note)}
              />
            ))}
          </div>
        )}

        {!isLoading && displayedNotes.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {displayedNotes.length} note{displayedNotes.length !== 1 ? 's' : ''} found
          </p>
        )}
      </PageTransition>

      {/* Full-screen Reading View */}
      <AnimatePresence>
        {selectedNote && (
          <NoteReadingView
            note={selectedNote}
            isBookmarked={bookmarked.includes(selectedNote.id)}
            onBookmark={() => toggleBookmark(selectedNote.id)}
            onClose={() => setSelectedNote(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
