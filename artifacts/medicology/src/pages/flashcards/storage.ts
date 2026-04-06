import { Flashcard, Deck, DeckOptions, ReviewLog, Rating, DEFAULT_DECK_OPTIONS, StudyStats } from "./types";

export const CARDS_KEY = "medi_fc_cards_v2";
export const DECKS_KEY = "medi_fc_decks_v2";
export const OPTIONS_KEY = "medi_fc_options_v2";
export const LOGS_KEY = "medi_fc_logs_v2";
export const SEEN_TODAY_KEY = "medi_fc_seen_v2";

export const DEFAULT_DECK_ID = "default";

/* ─── Persistence ───────────────────────────────────────────────────── */

export function loadDecks(): Deck[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DECKS_KEY) || "[]");
    if (raw.length === 0) {
      const d: Deck[] = [{ id: DEFAULT_DECK_ID, name: "General", subject: "Other", description: "Default deck", createdAt: new Date().toISOString() }];
      localStorage.setItem(DECKS_KEY, JSON.stringify(d));
      return d;
    }
    return raw;
  } catch { return []; }
}

export function saveDecks(d: Deck[]) { localStorage.setItem(DECKS_KEY, JSON.stringify(d)); }

export function loadOptions(): Record<string, DeckOptions> {
  try { return JSON.parse(localStorage.getItem(OPTIONS_KEY) || "{}"); }
  catch { return {}; }
}

export function saveOptions(o: Record<string, DeckOptions>) {
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(o));
}

export function getDeckOptions(deckId: string, allOptions: Record<string, DeckOptions>): DeckOptions {
  return allOptions[deckId] ?? DEFAULT_DECK_OPTIONS;
}

export function loadCards(): Flashcard[] {
  try {
    const today = todayStr();
    const raw = JSON.parse(localStorage.getItem(CARDS_KEY) || "[]") as any[];
    return raw.map(c => ({
      easeFactor: 2.5, interval: 1, repetitions: 0,
      nextReviewDate: today, state: "new", learningStep: 0,
      lapses: 0, tags: [], flag: 0, suspended: false,
      type: "basic",
      ...c,
    }));
  } catch { return []; }
}

export function saveCards(c: Flashcard[]) { localStorage.setItem(CARDS_KEY, JSON.stringify(c)); }

export function loadLogs(): ReviewLog[] {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); }
  catch { return []; }
}

export function saveLogs(l: ReviewLog[]) {
  const trimmed = l.slice(-10000);
  localStorage.setItem(LOGS_KEY, JSON.stringify(trimmed));
}

/* ─── Date helpers ──────────────────────────────────────────────────── */

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function sm2Defaults(): Pick<Flashcard, "state" | "easeFactor" | "interval" | "repetitions" | "lapses" | "learningStep" | "nextReviewDate"> {
  return { state: "new", easeFactor: 2.5, interval: 1, repetitions: 0, lapses: 0, learningStep: 0, nextReviewDate: todayStr() };
}

/* ─── SM-2+ Algorithm ───────────────────────────────────────────────── */

export function processRating(card: Flashcard, rating: Rating, options: DeckOptions): Flashcard {
  const nowMs = Date.now();
  const today = todayStr();
  let { state, learningStep, easeFactor, interval, repetitions, lapses } = card;
  let nextReviewDate = today;
  let nextReviewTime: number | undefined;

  const msMin = (m: number) => nowMs + m * 60_000;

  switch (card.state) {
    case "new":
    case "learning": {
      const steps = options.learningSteps;
      if (rating === "again") {
        state = "learning"; learningStep = 0;
        nextReviewTime = msMin(steps[0] ?? 1);
      } else if (rating === "easy") {
        state = "review"; interval = options.easyInterval;
        easeFactor = Math.min(3.0, easeFactor + 0.15);
        nextReviewDate = addDays(today, interval); learningStep = 0;
      } else if (rating === "hard") {
        state = "learning"; learningStep = 0;
        nextReviewTime = msMin(steps[0] ?? 1);
      } else {
        const next = learningStep + 1;
        if (next >= steps.length) {
          state = "review"; interval = options.graduatingInterval;
          nextReviewDate = addDays(today, interval); learningStep = 0;
        } else {
          state = "learning"; learningStep = next;
          nextReviewTime = msMin(steps[next]);
        }
      }
      break;
    }

    case "relearning": {
      const lapseSteps = options.lapseSteps;
      if (rating === "again") {
        learningStep = 0;
        nextReviewTime = msMin(lapseSteps[0] ?? 10);
      } else {
        const next = learningStep + 1;
        if (next >= lapseSteps.length) {
          state = "review";
          interval = Math.max(options.minimumInterval, Math.ceil(interval * 0.7));
          nextReviewDate = addDays(today, interval); learningStep = 0;
        } else {
          learningStep = next;
          nextReviewTime = msMin(lapseSteps[next]);
        }
      }
      break;
    }

    case "review": {
      if (rating === "again") {
        lapses += 1; state = "relearning"; learningStep = 0;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
        interval = Math.max(options.minimumInterval, Math.ceil(interval * 0.5));
        nextReviewTime = msMin(options.lapseSteps[0] ?? 10);
      } else if (rating === "hard") {
        interval = Math.max(options.minimumInterval, Math.ceil(interval * 1.2));
        easeFactor = Math.max(1.3, easeFactor - 0.15);
        nextReviewDate = addDays(today, interval);
      } else if (rating === "good") {
        interval = Math.max(options.minimumInterval, Math.ceil(interval * easeFactor));
        nextReviewDate = addDays(today, interval); repetitions += 1;
      } else {
        interval = Math.max(options.minimumInterval, Math.ceil(interval * easeFactor * 1.3));
        easeFactor = Math.min(3.0, easeFactor + 0.15);
        nextReviewDate = addDays(today, interval); repetitions += 1;
      }
      break;
    }
  }

  return { ...card, state, learningStep, easeFactor, interval, repetitions, lapses, nextReviewDate, nextReviewTime };
}

/* ─── Interval previews ─────────────────────────────────────────────── */

export function previewIntervals(card: Flashcard, options: DeckOptions): Record<Rating, string> {
  const fmt = (days: number, mins?: number) => {
    if (mins !== undefined) {
      if (mins < 60) return `${mins}m`;
      return `${Math.round(mins / 60)}h`;
    }
    if (days < 1) return "<1d";
    if (days === 1) return "1d";
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  };

  const steps = options.learningSteps;
  const lapseSteps = options.lapseSteps;
  const { state, interval, easeFactor, learningStep } = card;

  if (state === "new" || state === "learning") {
    return {
      again: fmt(0, steps[0] ?? 1),
      hard: fmt(0, steps[0] ?? 1),
      good: learningStep + 1 >= steps.length ? fmt(options.graduatingInterval) : fmt(0, steps[learningStep + 1]),
      easy: fmt(options.easyInterval),
    };
  }

  if (state === "relearning") {
    const next = learningStep + 1;
    return {
      again: fmt(0, lapseSteps[0] ?? 10),
      hard: fmt(0, lapseSteps[0] ?? 10),
      good: next >= lapseSteps.length ? fmt(Math.max(options.minimumInterval, Math.ceil(interval * 0.7))) : fmt(0, lapseSteps[next]),
      easy: fmt(Math.max(options.minimumInterval, Math.ceil(interval * 0.7))),
    };
  }

  return {
    again: fmt(0, lapseSteps[0] ?? 10),
    hard: fmt(Math.max(1, Math.ceil(interval * 1.2))),
    good: fmt(Math.max(1, Math.ceil(interval * easeFactor))),
    easy: fmt(Math.max(1, Math.ceil(interval * easeFactor * 1.3))),
  };
}

/* ─── Study queue ───────────────────────────────────────────────────── */

export function buildStudyQueue(cards: Flashcard[], deckId: string, options: DeckOptions, seenNewToday: string[]): Flashcard[] {
  const now = Date.now();
  const today = todayStr();
  const deck = cards.filter(c => c.deckId === deckId && !c.suspended);

  const learning = deck.filter(c => (c.state === "learning" || c.state === "relearning") && (c.nextReviewTime ?? 0) <= now);
  const due = deck.filter(c => c.state === "review" && c.nextReviewDate <= today).slice(0, options.maxReviews);

  const seenSet = new Set(seenNewToday);
  const newToday = deck.filter(c => c.state === "new" && !seenSet.has(c.id));
  const newLimit = Math.max(0, options.newPerDay - seenNewToday.length);
  const newCards = newToday.slice(0, newLimit);

  const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
  return [...learning, ...shuffle(due), ...newCards];
}

export function getDeckStudyStats(cards: Flashcard[], deckId: string, options: DeckOptions, seenNewToday: string[]): StudyStats {
  const now = Date.now();
  const today = todayStr();
  const deck = cards.filter(c => c.deckId === deckId && !c.suspended);

  const seenSet = new Set(seenNewToday);
  const newCount = Math.min(
    deck.filter(c => c.state === "new" && !seenSet.has(c.id)).length,
    Math.max(0, options.newPerDay - seenNewToday.length),
  );
  const learning = deck.filter(c => (c.state === "learning" || c.state === "relearning") && (c.nextReviewTime ?? 0) <= now).length;
  const review = Math.min(deck.filter(c => c.state === "review" && c.nextReviewDate <= today).length, options.maxReviews);

  return { new: newCount, learning, review };
}

/* ─── Anki HTML sanitization ────────────────────────────────────────── */

export function sanitizeAnkiContent(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[sound:[^\]]+\]/g, "")
    .replace(
      /<img([^>]*?)src="(?!https?:\/\/)([^"]+?)"([^>]*?)>/gi,
      (_, pre, src, post) => {
        const name = (src.split(/[\\/]/).pop() ?? src).slice(0, 40);
        return `<img${pre}src="${src}"${post} onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span class=\\'anki-img-missing\\'>📷 ${name}</span>');" style="max-width:100%;border-radius:8px;">`;
      },
    )
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .trim();
}

export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function stripHtml(text: string): string {
  return text
    .replace(/\[sound:[^\]]+\]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ─── Cloze helpers ─────────────────────────────────────────────────── */

export function renderClozeQuestion(front: string): string {
  return front.replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/g, "[...]");
}

export function renderClozeAnswer(front: string): string {
  return front.replace(/\{\{c\d+::([^}:]+)(?:::[^}]*)?\}\}/g, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
}

export function hasCloze(text: string): boolean {
  return /\{\{c\d+::/.test(text);
}
