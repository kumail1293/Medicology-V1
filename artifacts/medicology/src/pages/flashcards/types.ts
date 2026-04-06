export type CardState = "new" | "learning" | "review" | "relearning";
export type CardType = "basic" | "cloze";
export type CardFlag = 0 | 1 | 2 | 3 | 4;
export type Rating = "again" | "hard" | "good" | "easy";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject: string;
  deckId: string;
  image?: string;
  createdAt: string;
  type: CardType;
  tags: string[];
  flag: CardFlag;
  suspended: boolean;
  note?: string;
  state: CardState;
  learningStep: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
  lapses: number;
  nextReviewDate: string;
  nextReviewTime?: number;
}

export interface Deck {
  id: string;
  name: string;
  subject: string;
  description?: string;
  createdAt: string;
}

export interface DeckOptions {
  newPerDay: number;
  maxReviews: number;
  learningSteps: number[];
  graduatingInterval: number;
  easyInterval: number;
  lapseSteps: number[];
  minimumInterval: number;
  leechThreshold: number;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  date: string;
  time: number;
  rating: Rating;
  interval: number;
  ease: number;
  timeTaken: number;
}

export interface StudyStats {
  new: number;
  learning: number;
  review: number;
}

export const SUBJECTS = [
  "Anatomy","Physiology","Biochemistry","Pharmacology","Pathology",
  "Microbiology","Medicine","Surgery","ENT","Ophthalmology",
  "Dermatology","Psychiatry","Radiology","Gynecology & Obstetrics",
  "Pediatrics","Forensic Medicine","Community Medicine","Other",
];

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  newPerDay: 20,
  maxReviews: 200,
  learningSteps: [1, 10],
  graduatingInterval: 1,
  easyInterval: 4,
  lapseSteps: [10],
  minimumInterval: 1,
  leechThreshold: 8,
};

export const FLAG_COLORS: Record<CardFlag, string> = {
  0: "text-muted-foreground",
  1: "text-red-500",
  2: "text-orange-400",
  3: "text-green-500",
  4: "text-blue-500",
};

export const FLAG_LABELS: Record<CardFlag, string> = {
  0: "No flag",
  1: "Red",
  2: "Orange",
  3: "Green",
  4: "Blue",
};
