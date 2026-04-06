import { create } from 'zustand';
import { Question } from '@workspace/api-client-react';

export type SessionMode = 'practice' | 'tutor' | 'test' | 'exam';

interface SessionState {
  mode: SessionMode;
  isDaily: boolean;
  questions: Question[];
  currentIndex: number;
  answers: Record<number, string>;
  timeSpent: Record<number, number>; // seconds per question
  isFinished: boolean;
  
  startSession: (mode: SessionMode, questions: Question[], isDaily?: boolean) => void;
  setAnswer: (questionId: number, answer: string, timeTaken: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  endSession: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  mode: 'practice',
  isDaily: false,
  questions: [],
  currentIndex: 0,
  answers: {},
  timeSpent: {},
  isFinished: false,

  startSession: (mode, questions, isDaily = false) => set({
    mode,
    questions,
    isDaily,
    currentIndex: 0,
    answers: {},
    timeSpent: {},
    isFinished: false,
  }),

  setAnswer: (questionId, answer, timeTaken) => set((state) => ({
    answers: { ...state.answers, [questionId]: answer },
    timeSpent: { ...state.timeSpent, [questionId]: (state.timeSpent[questionId] || 0) + timeTaken }
  })),

  nextQuestion: () => set((state) => ({
    currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1)
  })),

  prevQuestion: () => set((state) => ({
    currentIndex: Math.max(state.currentIndex - 1, 0)
  })),

  endSession: () => set({ isFinished: true }),

  reset: () => set({
    mode: 'practice',
    isDaily: false,
    questions: [],
    currentIndex: 0,
    answers: {},
    timeSpent: {},
    isFinished: false,
  })
}));
