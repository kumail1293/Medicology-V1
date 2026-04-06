import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useSearch } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, Flag, Timer, Grid3X3, X, CheckCircle, XCircle,
  Pause, PauseCircle, Eye, BookmarkPlus, Bookmark, Brain, RotateCcw, Trophy,
  Calculator, Layers, BookOpen, Plus, ChevronDown, ChevronUp,
  Save, FolderPlus, Copy, Trash2, PenLine, AlertCircle, Send
} from 'lucide-react';
import { clsx } from 'clsx';
import { useSettings } from '@/lib/settings';
import { Toolbar } from '@/components/Toolbar';

/* ─── localStorage helpers ──────────────────────────────────────────────────── */
function getDeckList(): { id: string; name: string }[] {
  try { return JSON.parse(localStorage.getItem("medicology_flashcard_decks") || "[]"); } catch { return []; }
}

function saveDeckList(decks: { id: string; name: string }[]) {
  try { localStorage.setItem("medicology_flashcard_decks", JSON.stringify(decks)); } catch {}
}

function addFlashcard(front: string, back: string, subject: string, deckId: string) {
  try {
    const cards = JSON.parse(localStorage.getItem("medicology_flashcards") || "[]");
    cards.unshift({ id: Date.now().toString(), front, back, subject, deckId, createdAt: new Date().toISOString() });
    localStorage.setItem("medicology_flashcards", JSON.stringify(cards));
  } catch {}
}

function getNoteKey(sessionId: number | string, questionId: number | string) {
  return `note_session_${sessionId}_q_${questionId}`;
}

function loadNote(sessionId: number | string, questionId: number | string): string {
  try { return localStorage.getItem(getNoteKey(sessionId, questionId)) || ""; } catch { return ""; }
}

function saveNote(sessionId: number | string, questionId: number | string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(getNoteKey(sessionId, questionId), text);
    else localStorage.removeItem(getNoteKey(sessionId, questionId));
  } catch {}
}

/* ─── Mini Calculator ──────────────────────────────────────────────────────── */
function MiniCalculator() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  const press = (val: string) => {
    if (val === "C") { setDisplay("0"); setPrev(null); setOp(null); setFresh(false); return; }
    if (val === "⌫") { setDisplay(d => d.length > 1 ? d.slice(0, -1) : "0"); return; }
    if (["+", "-", "×", "÷"].includes(val)) { setPrev(display); setOp(val); setFresh(true); return; }
    if (val === "=") {
      if (!prev || !op) return;
      const a = parseFloat(prev), b = parseFloat(display);
      const res = op === "+" ? a + b : op === "-" ? a - b : op === "×" ? a * b : a / b;
      setDisplay(isFinite(res) ? String(parseFloat(res.toFixed(8))) : "Error");
      setPrev(null); setOp(null); setFresh(false); return;
    }
    if (val === "." && display.includes(".")) return;
    setDisplay(d => (fresh || d === "0") && val !== "." ? val : d + val);
    setFresh(false);
  };

  const buttons = ["C", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "."];

  return (
    <div className="space-y-2">
      <div className="bg-muted rounded-xl px-4 py-3 text-right font-mono text-2xl font-bold overflow-hidden text-ellipsis tracking-wider">{display}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {buttons.map((b, i) => (
          <button
            key={i}
            onClick={() => press(b)}
            className={clsx(
              "py-3 rounded-xl text-sm font-bold transition-all active:scale-95 select-none",
              ["C", "⌫"].includes(b) ? "bg-red-500/15 text-red-500 hover:bg-red-500/25" :
              ["÷", "×", "+", "-"].includes(b) ? "bg-primary/15 text-primary hover:bg-primary/25" :
              b === "=" ? "bg-primary text-primary-foreground hover:bg-primary/90" :
              b === "0" ? "col-span-2 bg-muted hover:bg-muted/70 border border-border" :
              "bg-muted hover:bg-muted/70 border border-border"
            )}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Question {
  id: number;
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  wrongAnswerExplanations?: string;
  subject: string;
  topic: string;
  difficulty: string;
}

interface SessionData {
  id: number;
  title: string;
  mode: string;
  status: string;
  questionIds: number[];
  answers: Record<string, { selected: string; timeSpent: number; isCorrect?: boolean }>;
  flaggedQuestions: number[];
  currentIndex: number;
  totalCorrect: number | null;
  totalTime: number | null;
  examType?: string | null;
  universityTag?: string | null;
  mbbsYear?: number | null;
  blockSize?: number | null;
}

const ERRATA_ERROR_TYPES = [
  "Wrong Answer",
  "Incorrect Explanation",
  "Typo/Grammar",
  "Outdated Information",
  "Missing Information",
  "Other",
];

function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function SessionV2() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const isReviewMode = new URLSearchParams(search).get('review') === '1';
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { settings, update: updateSettings } = useSettings();

  const [session, setSession] = useState<SessionData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selected: string; timeSpent: number; isCorrect?: boolean }>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [bookmarked, setBookmarked] = useState<number[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Study tools (integrated into test interface) ──────────────────────────
  const [toolOpen, setToolOpen] = useState(false);
  const [toolTab, setToolTab] = useState<"note" | "flash" | "calc">("note");

  // Per-question notes (keyed by session+question)
  const [noteText, setNoteText] = useState("");
  const noteAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flashcard state
  const [fcFront, setFcFront] = useState("");
  const [fcBack, setFcBack] = useState("");
  const [decks, setDecks] = useState<{ id: string; name: string }[]>([]);
  const [fcDeck, setFcDeck] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [fcSaved, setFcSaved] = useState(false);

  // Block Exam state
  const [sessionBlockSize, setSessionBlockSize] = useState(40);
  const [showBlockBreak, setShowBlockBreak] = useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(600);
  const [nextBlockIdx, setNextBlockIdx] = useState(0);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Erratum report state
  const [showErratum, setShowErratum] = useState(false);
  const [errType, setErrType] = useState(ERRATA_ERROR_TYPES[0]);
  const [errDescription, setErrDescription] = useState("");
  const [errCorrection, setErrCorrection] = useState("");
  const [errRef, setErrRef] = useState("");
  const [errSubmitting, setErrSubmitting] = useState(false);

  // Pending answer (selected but not yet submitted)
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);

  // Load decks on mount
  useEffect(() => {
    const d = getDeckList();
    setDecks(d);
    if (d.length > 0) setFcDeck(d[0].id);
  }, []);

  // Load note when question changes
  useEffect(() => {
    if (!session || !questions[currentIndex]) return;
    const note = loadNote(session.id, questions[currentIndex].id);
    setNoteText(note);
  }, [currentIndex, session?.id, questions]);

  // Auto-save note with debounce
  useEffect(() => {
    if (!session || !questions[currentIndex]) return;
    if (noteAutoSaveRef.current) clearTimeout(noteAutoSaveRef.current);
    noteAutoSaveRef.current = setTimeout(() => {
      saveNote(session.id, questions[currentIndex].id, noteText);
    }, 600);
    return () => { if (noteAutoSaveRef.current) clearTimeout(noteAutoSaveRef.current); };
  }, [noteText]);

  const hasNoteForCurrent = noteText.trim().length > 0;

  // Open flashcard tool pre-filled from current question
  const openFlashcardTool = (q: Question) => {
    const correctOption = (q.options as Record<string, string>)[q.correctAnswer] || q.correctAnswer;
    setFcFront(q.questionText);
    setFcBack(`${q.correctAnswer.toUpperCase()}. ${correctOption}\n\n${q.explanation}`);
    setFcSaved(false);
    setToolTab("flash");
    setToolOpen(true);
  };

  const handleCreateDeck = () => {
    const name = newDeckName.trim();
    if (!name) return;
    const id = `deck_${Date.now()}`;
    const updated = [...decks, { id, name }];
    setDecks(updated);
    saveDeckList(updated);
    setFcDeck(id);
    setNewDeckName("");
    setShowNewDeck(false);
    toast({ title: `Deck "${name}" created!` });
  };

  const handleSaveFlashcard = () => {
    if (!fcFront.trim() || !fcBack.trim()) {
      toast({ title: "Front and back are required", variant: "destructive" }); return;
    }
    const deckId = fcDeck || "general";
    addFlashcard(fcFront, fcBack, questions[currentIndex]?.subject || "Other", deckId);
    setFcSaved(true);
    toast({ title: "Flashcard saved!", description: `Added to ${decks.find(d => d.id === deckId)?.name || "General"} deck.` });
  };

  // Timer
  const [questionSeconds, setQuestionSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);

  const token = localStorage.getItem('medicology_token');

  const apiCall = useCallback(async (url: string, opts?: RequestInit) => {
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) } });
  }, [token]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiCall(`/api/sessions/${id}`);
        if (!res.ok) { setLocation('/tests'); return; }
        const data = await res.json();
        setSession(data.session);
        setQuestions(data.questions);
        setAnswers(data.session.answers || {});
        setFlagged(data.session.flaggedQuestions || []);
        setCurrentIndex(isReviewMode ? 0 : (data.session.currentIndex || 0));
        setSessionBlockSize(data.session.blockSize || 40);
        if (data.session.status === 'completed') setShowResults(true);
      } catch {
        toast({ title: "Error", description: "Failed to load session", variant: "destructive" });
        setLocation('/tests');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  // Per-question timer
  useEffect(() => {
    if (!session || showResults || isReviewMode) return;
    setQuestionSeconds(0);
    timerRef.current = setInterval(() => {
      if (!toolOpen) setQuestionSeconds(s => s + 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, session?.id, showResults, isReviewMode, toolOpen]);

  // Clear pending selection when moving to a new question
  useEffect(() => {
    setPendingAnswer(null);
  }, [currentIndex]);

  // Total timer
  useEffect(() => {
    if (!session || showResults || isReviewMode) return;
    totalTimerRef.current = setInterval(() => setTotalSeconds(s => s + 1), 1000);
    return () => { if (totalTimerRef.current) clearInterval(totalTimerRef.current); };
  }, [session?.id, showResults, isReviewMode]);

  // Block break countdown
  useEffect(() => {
    if (!showBlockBreak) {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
      return;
    }
    breakTimerRef.current = setInterval(() => {
      setBreakSecondsLeft(s => {
        if (s <= 1) {
          if (breakTimerRef.current) clearInterval(breakTimerRef.current);
          setShowBlockBreak(false);
          setCurrentIndex(nextBlockIdx);
          return 600;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [showBlockBreak, nextBlockIdx]);

  const saveToServer = useCallback(async (updatedAnswers: typeof answers, updatedIndex: number, updatedFlagged: number[], status?: string, totalCorrectCount?: number) => {
    if (!session) return;
    setIsSaving(true);
    try {
      await apiCall(`/api/sessions/${session.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          answers: updatedAnswers,
          currentIndex: updatedIndex,
          flaggedQuestions: updatedFlagged,
          status: status || session.status,
          totalCorrect: totalCorrectCount,
          totalTime: totalSeconds,
        }),
      });
    } finally {
      setIsSaving(false);
    }
  }, [session, apiCall, totalSeconds]);

  const handleAnswer = async (optionKey: string) => {
    if (!session || !questions[currentIndex]) return;
    const q = questions[currentIndex];
    const qIdStr = String(q.id);
    if (answers[qIdStr]) return;

    const isCorrect = optionKey === q.correctAnswer;
    const newAnswers = {
      ...answers,
      [qIdStr]: { selected: optionKey, timeSpent: questionSeconds, isCorrect }
    };
    setAnswers(newAnswers);

    // Submit to practice endpoint for progress tracking
    try {
      await apiCall('/api/practice/submit', {
        method: 'POST',
        body: JSON.stringify({ questionId: q.id, selectedAnswer: optionKey, timeTaken: questionSeconds, mode: session.mode }),
      });
    } catch {}

    // Auto-advance in tutor mode after 1.5s
    if (session.mode === 'tutor') {
      await saveToServer(newAnswers, currentIndex, flagged);
    } else {
      await saveToServer(newAnswers, currentIndex, flagged);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      await saveToServer(answers, next, flagged);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0 && session?.mode !== 'block') setCurrentIndex(currentIndex - 1);
  };

  const handleEndBlock = async () => {
    if (!session) return;
    const sz = session.blockSize || sessionBlockSize;
    const blkNum = Math.floor(currentIndex / sz) + 1;
    const nextIdx = blkNum * sz;
    await saveToServer(answers, currentIndex, flagged);
    setNextBlockIdx(nextIdx);
    setBreakSecondsLeft(600);
    setShowBlockBreak(true);
  };

  const handleFlag = async () => {
    if (!session || !questions[currentIndex]) return;
    const qId = questions[currentIndex].id;
    const newFlagged = flagged.includes(qId) ? flagged.filter(id => id !== qId) : [...flagged, qId];
    setFlagged(newFlagged);
    await saveToServer(answers, currentIndex, newFlagged);

    // Also update global flags
    try {
      await apiCall(`/api/flags/${qId}`, { method: 'POST' });
    } catch {}
  };

  const handleBookmark = async () => {
    if (!questions[currentIndex]) return;
    const questionId = questions[currentIndex].id;
    if (bookmarked.includes(questionId)) {
      setBookmarked(prev => prev.filter(id => id !== questionId));
      try {
        // TODO: implement on backend
        await apiCall(`/api/bookmarks/${questionId}`, { method: 'DELETE' });
      } catch {}
    } else {
      setBookmarked(prev => [...prev, questionId]);
      try {
        // TODO: implement on backend
        await apiCall('/api/bookmarks', { method: 'POST', body: JSON.stringify({ questionId }) });
      } catch {}
    }
  };

  const handleSuspend = async () => {
    await saveToServer(answers, currentIndex, flagged, 'suspended');
    toast({ title: "Test suspended", description: "Your progress has been saved." });
    setLocation('/tests');
  };

  const handleFinish = async () => {
    const totalCorrect = Object.values(answers).filter(a => a.isCorrect).length;
    await saveToServer(answers, currentIndex, flagged, 'completed', totalCorrect);
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    setShowResults(true);
  };

  const handleErrataSubmit = async () => {
    if (!questions[currentIndex]) return;
    if (!errDescription.trim()) {
      toast({ title: "Description required", description: "Please describe the error.", variant: "destructive" });
      return;
    }
    setErrSubmitting(true);
    try {
      const token = localStorage.getItem('medicology_token');
      const res = await fetch('/api/errata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionId: questions[currentIndex].id,
          errorType: errType,
          description: errDescription.trim(),
          correction: errCorrection.trim() || undefined,
          referenceUrl: errRef.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast({ title: "Report submitted", description: "Thank you! Our team will review it shortly." });
        setShowErratum(false);
        setErrType(ERRATA_ERROR_TYPES[0]);
        setErrDescription("");
        setErrCorrection("");
        setErrRef("");
      } else {
        const d = await res.json();
        toast({ title: "Submission failed", description: d.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
    } finally {
      setErrSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">🧠</div>
          <p className="text-muted-foreground">Loading your test...</p>
        </div>
      </div>
    );
  }

  if (!session || questions.length === 0) return null;

  // Block Exam computed helpers
  const isBlockMode = session.mode === 'block';
  const blkSz = session.blockSize || sessionBlockSize;
  const currentBlockNum = Math.floor(currentIndex / blkSz) + 1;
  const totalBlocksCount = Math.ceil(questions.length / blkSz);
  const posInBlock = (currentIndex % blkSz) + 1;
  const isEndOfNonFinalBlock = isBlockMode && posInBlock === blkSz && currentBlockNum < totalBlocksCount;

  const currentQ = questions[currentIndex];
  const currentQIdStr = currentQ ? String(currentQ.id) : '';
  const hasAnswered = !!answers[currentQIdStr];
  const isFlagged = flagged.includes(currentQ?.id);
  const isBookmarked = bookmarked.includes(currentQ?.id);
  const showExplanation = hasAnswered && (session.mode === 'tutor' || isReviewMode || showResults);

  if (showResults) {
    const totalAnswered = Object.keys(answers).length;
    const totalCorrect = Object.values(answers).filter(a => a.isCorrect).length;
    const pct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const omitted = questions.length - totalAnswered;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border shadow-2xl p-8 max-w-lg w-full text-center"
        >
          <div className={clsx(
            "w-24 h-24 rounded-full flex items-center justify-center text-4xl mx-auto mb-6",
            pct >= 70 ? "bg-green-500/15" : pct >= 50 ? "bg-yellow-500/15" : "bg-red-500/15"
          )}>
            {pct >= 70 ? "🏆" : pct >= 50 ? "📖" : "💪"}
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-2">{pct}%</h2>
          <p className="text-muted-foreground mb-8">{session.title}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-green-500/10 rounded-2xl p-4">
              <div className="text-2xl font-bold text-green-600">{totalCorrect}</div>
              <div className="text-xs text-muted-foreground mt-1">Correct</div>
            </div>
            <div className="bg-red-500/10 rounded-2xl p-4">
              <div className="text-2xl font-bold text-red-600">{totalAnswered - totalCorrect}</div>
              <div className="text-xs text-muted-foreground mt-1">Incorrect</div>
            </div>
            <div className="bg-muted rounded-2xl p-4">
              <div className="text-2xl font-bold text-muted-foreground">{omitted}</div>
              <div className="text-xs text-muted-foreground mt-1">Omitted</div>
            </div>
          </div>

          {totalSeconds > 0 && (
            <p className="text-sm text-muted-foreground mb-8">
              Completed in {formatSeconds(totalSeconds)} · {totalAnswered > 0 ? Math.round(totalSeconds / totalAnswered) : 0}s avg/question
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowResults(false); setCurrentIndex(0); }}
              className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground py-3 rounded-xl font-bold hover:bg-muted/80 transition-all"
            >
              <Eye size={16} /> Review
            </button>
            <button
              onClick={() => setLocation('/create-test')}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all"
            >
              <RotateCcw size={16} /> New Test
            </button>
          </div>
          <button
            onClick={() => setLocation('/')}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter(a => a.isCorrect).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Left: Nav */}
          <button
            onClick={() => !isBlockMode && setShowGrid(!showGrid)}
            title={isBlockMode ? "Question navigation disabled in Block Exam mode" : undefined}
            className={clsx(
              "flex items-center gap-1.5 text-sm font-semibold transition-colors",
              isBlockMode ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Grid3X3 size={16} />
            <span className="hidden sm:inline">{answeredCount}/{questions.length}</span>
          </button>

          {/* Center: Progress + title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground truncate">{session.title}</span>
              {session.examType && (
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                  {session.examType}
                </span>
              )}
              {session.universityTag && (
                <span className="hidden sm:inline text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                  {session.universityTag}
                </span>
              )}
              {session.mbbsYear && (
                <span className="hidden sm:inline text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                  Year {session.mbbsYear}
                </span>
              )}
              {isBlockMode && (
                <span className="text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0">
                  Block {currentBlockNum}/{totalBlocksCount} — Q{posInBlock}/{blkSz}
                </span>
              )}
              {isSaving && <span className="text-xs text-muted-foreground animate-pulse">saving...</span>}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Right: Timer + actions */}
          <div className="flex items-center gap-2">
            {!isReviewMode && (
              <div className={clsx("text-sm font-mono font-bold flex items-center gap-1", session.mode === 'timed' && questionSeconds > 70 ? "text-red-500" : "text-muted-foreground")}>
                <Timer size={14} />
                {formatSeconds(questionSeconds)}
              </div>
            )}
            {!isReviewMode && (
              <>
                <button onClick={handleSuspend} title="Suspend test" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <PauseCircle size={18} />
                </button>
                {answeredCount > 0 && (
                  <button onClick={handleFinish} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-sm font-semibold transition-colors">
                    <CheckCircle size={14} /> End
                  </button>
                )}
              </>
            )}
            {isReviewMode && (
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-lg">Review Mode</span>
            )}
          </div>
        </div>
      </div>

      {/* Question Nav Grid Drawer */}
      <AnimatePresence>
        {showGrid && !isBlockMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card border-b border-border overflow-hidden z-20"
          >
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Correct</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Incorrect</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" /> Flagged</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted border border-border inline-block" /> Unseen</span>
                </div>
                <button onClick={() => setShowGrid(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {questions.map((q, i) => {
                  const ans = answers[String(q.id)];
                  const isFlg = flagged.includes(q.id);
                  const isCurrent = i === currentIndex;
                  return (
                    <button
                      key={q.id}
                      onClick={() => { setCurrentIndex(i); setShowGrid(false); }}
                      className={clsx(
                        "w-9 h-9 rounded-lg text-xs font-bold border transition-all",
                        isCurrent && "ring-2 ring-primary ring-offset-1",
                        ans ? (ans.isCorrect ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500") :
                          isFlg ? "bg-orange-400 text-white border-orange-400" : "bg-muted border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Question Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          {currentQ && (
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                      Q{currentIndex + 1} of {questions.length}
                    </span>
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                      {currentQ.subject}
                    </span>
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                      {currentQ.topic}
                    </span>
                    <span className={clsx(
                      "text-xs font-semibold px-2.5 py-1 rounded-full",
                      currentQ.difficulty === 'easy' ? "bg-green-500/10 text-green-600" :
                        currentQ.difficulty === 'hard' ? "bg-red-500/10 text-red-600" :
                          "bg-yellow-500/10 text-yellow-600"
                    )}>
                      {currentQ.difficulty}
                    </span>
                  </div>
                  <p className="text-base sm:text-lg font-medium leading-relaxed text-foreground">
                    {currentQ.questionText}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {!isReviewMode && (
                    <button
                      onClick={handleFlag}
                      title={isFlagged ? "Remove flag" : "Flag for review"}
                      className={clsx(
                        "p-2.5 rounded-xl transition-all",
                        isFlagged ? "bg-orange-500/15 text-orange-500" : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Flag size={18} fill={isFlagged ? "currentColor" : "none"} />
                    </button>
                  )}
                  <button
                    onClick={handleBookmark}
                    title={isBookmarked ? "Remove bookmark" : "Bookmark this question"}
                    className={clsx(
                      "p-2.5 rounded-xl transition-all",
                      isBookmarked ? "bg-blue-500/15 text-blue-500" : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isBookmarked ? <Bookmark size={18} fill="currentColor" /> : <BookmarkPlus size={18} />}
                  </button>
                  <button
                    onClick={() => setShowErratum(true)}
                    title="Report an error in this question"
                    className="p-2.5 rounded-xl bg-muted text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <AlertCircle size={18} />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {currentQ.options && Object.entries(currentQ.options as Record<string, string>).map(([key, value]) => {
                  const isSubmitted = answers[currentQIdStr]?.selected === key;
                  const isCorrect = key === currentQ.correctAnswer;
                  const showState = hasAnswered;
                  const isPending = !hasAnswered && pendingAnswer === key;

                  return (
                    <motion.button
                      key={key}
                      whileTap={!hasAnswered && !isReviewMode ? { scale: 0.99 } : undefined}
                      onClick={() => {
                        if (hasAnswered || isReviewMode) return;
                        setPendingAnswer(prev => (prev === key ? null : key));
                      }}
                      className={clsx(
                        "w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all",
                        !showState && !isPending && "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer",
                        !showState && isPending && "border-primary bg-primary/10 cursor-pointer",
                        showState && isCorrect && "border-green-500 bg-green-500/10",
                        showState && isSubmitted && !isCorrect && "border-red-500 bg-red-500/10",
                        showState && !isSubmitted && !isCorrect && "border-border opacity-60",
                        hasAnswered && "cursor-default"
                      )}
                    >
                      <span className={clsx(
                        "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                        showState && isCorrect && "bg-green-500 border-green-500 text-white",
                        showState && isSubmitted && !isCorrect && "bg-red-500 border-red-500 text-white",
                        !showState && isPending && "bg-primary border-primary text-primary-foreground",
                        !showState && !isPending && "border-muted-foreground/40 text-muted-foreground"
                      )}>
                        {showState && isCorrect ? <CheckCircle size={14} /> : showState && isSubmitted && !isCorrect ? <XCircle size={14} /> : key.toUpperCase()}
                      </span>
                      <span className="text-sm leading-relaxed">{value}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Submit Answer button — shown after selecting an option, before submitting */}
              <AnimatePresence>
                {!hasAnswered && !isReviewMode && pendingAnswer && (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    onClick={() => {
                      handleAnswer(pendingAnswer);
                      setPendingAnswer(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
                  >
                    <Send size={15} /> Submit Answer
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted/50 border border-border rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain size={16} className="text-primary" />
                        <span className="font-bold text-sm">Explanation</span>
                      </div>
                      <button
                        onClick={() => openFlashcardTool(currentQ)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-primary/30"
                      >
                        <Layers size={12} /> Save as Flashcard
                      </button>
                    </div>

                    {/* Why correct is correct */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                        <CheckCircle size={13} /> Why this is correct
                      </div>
                      <p className="text-sm leading-relaxed text-foreground pl-5">{currentQ.explanation || "No explanation provided."}</p>
                    </div>

                    {/* Why each incorrect option is wrong */}
                    {currentQ.wrongAnswerExplanations && (() => {
                      let parsed: Record<string,string> | null = null;
                      try { parsed = JSON.parse(currentQ.wrongAnswerExplanations); } catch {}
                      if (parsed && typeof parsed === "object") {
                        return (
                          <div className="space-y-2 border-t border-border pt-3">
                            <div className="text-xs font-semibold text-red-500 mb-1.5 flex items-center gap-1.5">
                              <XCircle size={13} /> Why the other options are wrong
                            </div>
                            {Object.entries(parsed).map(([key, val]) => (
                              <div key={key} className="flex gap-2 pl-2">
                                <span className="text-xs font-bold text-muted-foreground shrink-0 w-5">{key.toUpperCase()}.</span>
                                <p className="text-xs text-muted-foreground leading-relaxed">{val}</p>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3 pl-1">{currentQ.wrongAnswerExplanations}</p>
                      );
                    })()}

                    {/* Textbook references */}
                    {(currentQ as any).references && (
                      <div className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                        <BookOpen size={12} className="shrink-0 mt-0.5 text-primary" />
                        <span className="leading-relaxed"><span className="font-semibold text-foreground">Reference: </span>{(currentQ as any).references}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Block Break Screen ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBlockBreak && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-8"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center max-w-md w-full"
            >
              {/* Icon */}
              <div className="w-24 h-24 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-6 text-5xl">
                ☕
              </div>

              <h2 className="text-3xl font-display font-extrabold mb-2">Block {currentBlockNum} Complete</h2>
              <p className="text-muted-foreground mb-8">
                Take a short break. Block {currentBlockNum + 1} of {totalBlocksCount} begins automatically when the timer ends.
              </p>

              {/* Countdown ring */}
              <div className="relative w-40 h-40 mx-auto mb-8">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                  <circle
                    cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
                    className="text-rose-500 transition-all duration-1000"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - breakSecondsLeft / 600)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-mono font-black">{formatSeconds(breakSecondsLeft)}</span>
                  <span className="text-xs text-muted-foreground mt-1">remaining</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
                    setShowBlockBreak(false);
                    setCurrentIndex(nextBlockIdx);
                  }}
                  className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base hover:bg-rose-600 transition-all hover:-translate-y-0.5 shadow-lg shadow-rose-500/25"
                >
                  Skip Break — Start Block {currentBlockNum + 1} Now
                </button>
                <p className="text-xs text-muted-foreground">
                  You have completed {answeredCount} of {questions.length} questions so far.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Erratum Report Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showErratum && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-red-500" />
                  <h3 className="text-lg font-bold">Report an Error</h3>
                </div>
                <button onClick={() => setShowErratum(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                Found an issue with Q{currentIndex + 1}? Let us know and help improve the QBank.
                Verified reports earn reward points.
              </p>

              {/* Error type selector */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Error Type</label>
                <div className="flex flex-wrap gap-2">
                  {ERRATA_ERROR_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setErrType(t)}
                      className={clsx(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                        errType === t
                          ? "bg-red-500/10 border-red-500/40 text-red-600"
                          : "bg-muted border-border text-muted-foreground hover:border-border/80"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Describe the error <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={errDescription}
                  onChange={e => setErrDescription(e.target.value)}
                  placeholder="What's wrong with this question or answer?"
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Suggested correction */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Suggested Correction <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={errCorrection}
                  onChange={e => setErrCorrection(e.target.value)}
                  placeholder="What should the correct answer or explanation be?"
                  rows={2}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Reference URL */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Reference URL <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  value={errRef}
                  onChange={e => setErrRef(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowErratum(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleErrataSubmit}
                  disabled={errSubmitting || !errDescription.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {errSubmitting ? (
                    <span className="animate-pulse">Submitting...</span>
                  ) : (
                    <><Send size={14} /> Submit Report</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Integrated Study Tools Panel ─────────────────────────────────────── */}
      <div className="sticky bottom-0 z-30 bg-card border-t border-border shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.12)]">

        {/* Tool content area — slides up when a tool is open */}
        <AnimatePresence>
          {toolOpen && (
            <motion.div
              key={toolTab}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="overflow-hidden border-b border-border"
            >
              <div className="max-w-4xl mx-auto px-4 py-4">

                {/* ── NOTES TAB ─────────────────────────────────────────────── */}
                {toolTab === "note" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <PenLine size={14} className="text-primary" />
                        Note for Q{currentIndex + 1}
                        {hasNoteForCurrent && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Note saved" />}
                      </div>
                      <div className="flex items-center gap-2">
                        {noteText && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(noteText); toast({ title: "Note copied!" }); }}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                          >
                            <Copy size={12} /> Copy
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground">Auto-saved per question</span>
                      </div>
                    </div>
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      rows={5}
                      placeholder="Type your notes for this question here… they're automatically saved and linked to this question."
                      className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/50"
                    />
                    {noteText.trim() === "" && (
                      <p className="text-xs text-muted-foreground">
                        Notes are saved per question and persist across sessions.
                      </p>
                    )}
                  </div>
                )}

                {/* ── FLASHCARD TAB ─────────────────────────────────────────── */}
                {toolTab === "flash" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Left: front/back */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Layers size={14} className="text-primary" /> Create Flashcard
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Front</label>
                        <textarea
                          value={fcFront}
                          onChange={e => { setFcFront(e.target.value); setFcSaved(false); }}
                          rows={3}
                          placeholder="Question or concept…"
                          className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Back</label>
                        <textarea
                          value={fcBack}
                          onChange={e => { setFcBack(e.target.value); setFcSaved(false); }}
                          rows={3}
                          placeholder="Answer or explanation…"
                          className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    </div>

                    {/* Right: deck + save */}
                    <div className="space-y-3 flex flex-col">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <FolderPlus size={14} className="text-primary" /> Choose Deck
                      </div>

                      {/* Deck list */}
                      <div className="space-y-1.5">
                        {decks.length > 0 ? decks.map(d => (
                          <button
                            key={d.id}
                            onClick={() => setFcDeck(d.id)}
                            className={clsx(
                              "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all border",
                              fcDeck === d.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 border-border hover:bg-muted text-foreground"
                            )}
                          >
                            {d.name}
                          </button>
                        )) : (
                          <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3">
                            No decks yet. Create one below and your card will be saved to it.
                          </div>
                        )}

                        {/* Saved to General option */}
                        <button
                          onClick={() => setFcDeck("general")}
                          className={clsx(
                            "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all border",
                            fcDeck === "general"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 border-border hover:bg-muted text-muted-foreground"
                          )}
                        >
                          General (no deck)
                        </button>
                      </div>

                      {/* Create new deck */}
                      {!showNewDeck ? (
                        <button
                          onClick={() => setShowNewDeck(true)}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-semibold"
                        >
                          <Plus size={13} /> Create New Deck
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={newDeckName}
                            onChange={e => setNewDeckName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleCreateDeck(); if (e.key === "Escape") { setShowNewDeck(false); setNewDeckName(""); } }}
                            placeholder="Deck name…"
                            className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <button onClick={handleCreateDeck} className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold">
                            Create
                          </button>
                          <button onClick={() => { setShowNewDeck(false); setNewDeckName(""); }} className="px-2 py-2 rounded-xl border border-border hover:bg-muted">
                            <X size={13} />
                          </button>
                        </div>
                      )}

                      <div className="mt-auto pt-2 space-y-2">
                        <button
                          onClick={handleSaveFlashcard}
                          disabled={fcSaved}
                          className={clsx(
                            "w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                            fcSaved
                              ? "bg-green-500/15 text-green-600 border border-green-500/30"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          )}
                        >
                          {fcSaved ? <><CheckCircle size={15} /> Saved!</> : <><Save size={15} /> Save Flashcard</>}
                        </button>
                        {questions[currentIndex] && (
                          <button
                            onClick={() => openFlashcardTool(questions[currentIndex])}
                            className="w-full py-2 rounded-xl text-xs text-muted-foreground border border-border hover:bg-muted transition-colors"
                          >
                            Re-fill from current question
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CALCULATOR TAB ────────────────────────────────────────── */}
                {toolTab === "calc" && (
                  <div className="max-w-xs mx-auto">
                    <MiniCalculator />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tool toggle bar + nav ─────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">

          {/* Study tool buttons */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            {[
              { id: "note" as const, icon: <PenLine size={15} />, label: "Note", dot: hasNoteForCurrent },
              { id: "flash" as const, icon: <Layers size={15} />, label: "Card" },
              { id: "calc" as const, icon: <Calculator size={15} />, label: "Calc" },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => {
                  if (toolOpen && toolTab === tool.id) { setToolOpen(false); }
                  else { setToolTab(tool.id); setToolOpen(true); }
                }}
                className={clsx(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  toolOpen && toolTab === tool.id
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tool.icon}
                <span className="hidden sm:inline">{tool.label}</span>
                {tool.dot && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            ))}
          </div>

          {/* Expand/collapse chevron indicator */}
          {toolOpen && (
            <button
              onClick={() => setToolOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          )}

          {/* Score display */}
          {answeredCount > 0 && !isReviewMode && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-600 font-bold">{correctCount} ✓</span>
              <span className="text-red-500 font-bold">{answeredCount - correctCount} ✗</span>
            </div>
          )}
          {isReviewMode && (
            <button onClick={() => setLocation('/tests')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Prev / Next / End Block / Finish */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0 || isBlockMode}
            title={isBlockMode ? "Cannot go back in Block Exam mode" : undefined}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-all"
          >
            <ChevronLeft size={16} /> Prev
          </button>

          {isEndOfNonFinalBlock && !isReviewMode ? (
            <button
              onClick={handleEndBlock}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all text-sm shadow-lg shadow-rose-500/20"
            >
              End Block & Break ☕
            </button>
          ) : currentIndex === questions.length - 1 && !isReviewMode ? (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all text-sm"
            >
              <CheckCircle size={16} /> Finish
            </button>
          ) : (
            <button
              onClick={handleNext}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm transition-all",
                isReviewMode ? "border border-border hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
      <Toolbar />
    </div>
  );
}
