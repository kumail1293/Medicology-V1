import { QueryClient, DefaultOptions } from "@tanstack/react-query";

/**
 * React Query cache and fetch strategies
 * 
 * Caching Strategy:
 * - Fresh: 30s - Data is considered "fresh" for 30 seconds
 * - Stale: Data is still usable but considered "stale" after 30s
 * - GC: Unused data is garbage collected after 10 minutes
 * 
 * Refetch Triggers:
 * - On mount (if stale)
 * - On window focus (disabled for better UX)
 * - On reconnect (when network returns)
 */

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 1,
    staleTime: 30_000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
    refetchOnMount: true,
    refetchOnWindowFocus: false, // Smooth UX by not refetching on focus
    refetchOnReconnect: true,
  },
  mutations: {
    retry: 1,
  },
};

export const createQueryClient = (): QueryClient => {
  return new QueryClient({ defaultOptions });
};

/**
 * Query Key Factory Pattern
 * Helps maintain consistent and typesafe query keys
 * 
 * Usage:
 * const { questions: questionsKeys } = queryKeys;
 * useQuery({ queryKey: questionsKeys.list(), ... })
 */
export const queryKeys = {
  all: ["queries"] as const,
  
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
    sessions: () => [...queryKeys.auth.all, "sessions"] as const,
  },
  
  questions: {
    all: ["questions"] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.questions.all, "list", filters] as const,
    detail: (id: number) => [...queryKeys.questions.all, "detail", id] as const,
    search: (query: string) => [...queryKeys.questions.all, "search", query] as const,
  },
  
  progress: {
    all: ["progress"] as const,
    list: () => [...queryKeys.progress.all, "list"] as const,
    stats: () => [...queryKeys.progress.all, "stats"] as const,
    analytics: () => [...queryKeys.progress.all, "analytics"] as const,
    wrongQuestions: () => [...queryKeys.progress.all, "wrong"] as const,
  },
  
  bookmarks: {
    all: ["bookmarks"] as const,
    list: () => [...queryKeys.bookmarks.all, "list"] as const,
  },
  
  notes: {
    all: ["notes"] as const,
    list: () => [...queryKeys.notes.all, "list"] as const,
    detail: (id: number) => [...queryKeys.notes.all, "detail", id] as const,
  },
  
  sessions: {
    all: ["sessions"] as const,
    list: () => [...queryKeys.sessions.all, "list"] as const,
    detail: (id: number) => [...queryKeys.sessions.all, "detail", id] as const,
  },
  
  qbanks: {
    all: ["qbanks"] as const,
    list: () => [...queryKeys.qbanks.all, "list"] as const,
    detail: (id: number) => [...queryKeys.qbanks.all, "detail", id] as const,
  },
} as const;
