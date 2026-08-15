import { z } from 'zod';

const optionMapSchema = z.object({
  A: z.string(),
  B: z.string(),
  C: z.string().optional(),
  D: z.string().optional(),
  E: z.string().optional(),
});

// Standard question types need at least 4 distinct options; True/False only
// needs its two, and Assertion/Reason options are auto-rendered by the client.
function requireOptionCountForType(questionType: string | undefined, options: any): boolean {
  if (questionType === 'true_false') return Object.values(options ?? {}).filter(Boolean).length >= 2;
  // Assertion/Reason options are auto-rendered by the client from the standard
  // five-choice layout, so no stored options are required.
  if (questionType === 'assertion_reason') return true;
  return Object.values(options ?? {}).filter(Boolean).length >= 4;
}

export const createQuestionSchema = z
  .object({
    questionText: z.string().min(1, 'Question text is required'),
    questionType: z.enum(['sba', 'best_of_five', 'true_false', 'assertion_reason', 'emq', 'image_based', 'clinical_vignette', 'case_based']).default('sba'),
    options: optionMapSchema,
    correctAnswer: z.string().min(1, 'Correct answer is required'),
    explanation: z.string().optional(),
    imageUrl: z.string().optional(),
    explanationImageUrl: z.string().optional(),
    whyCorrect: z.string().optional(),
    whyWrong: z.string().optional(),
    examPearl: z.string().optional(),
    commonTrap: z.string().optional(),
    wrongAnswerExplanations: z.string().optional(),
    references: z.string().optional(),
    subject: z.string().optional(),
    system: z.string().optional(),
    topic: z.string().optional(),
    subtopic: z.string().optional(),
    universityTag: z.string().optional(),
    examType: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    tags: z.array(z.string()).optional(),
    isFree: z.boolean().optional(),
    // Hybrid relational taxonomy IDs
    countryId: z.number().int().positive().optional(),
    examId: z.number().int().positive().optional(),
    programId: z.number().int().positive().optional(),
    yearId: z.number().int().positive().optional(),
    subjectId: z.number().int().positive().optional(),
    systemId: z.number().int().positive().optional(),
    topicId: z.number().int().positive().optional(),
    subtopicId: z.number().int().positive().optional(),
    // Content lifecycle
    status: z.enum(['draft', 'pending_review', 'under_medical_review', 'approved', 'published', 'flagged', 'errata', 'archived']).optional(),
  })
  .superRefine((data, ctx) => {
    if (!requireOptionCountForType(data.questionType, data.options)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: data.questionType === 'true_false'
          ? 'True/False questions need True and False options'
          : 'At least 4 options required for this question type',
      });
    }
  })
  .transform((data) => {
    const result: Record<string, any> = {
      questionText: data.questionText,
      questionType: data.questionType,
      options: data.options,
      correctAnswer: data.correctAnswer,
      difficulty: data.difficulty,
    };

    const passthrough: Array<keyof typeof data> = [
      'explanation',
      'imageUrl',
      'explanationImageUrl',
      'whyCorrect',
      'whyWrong',
      'examPearl',
      'commonTrap',
      'wrongAnswerExplanations',
      'references',
      'subject',
      'system',
      'topic',
      'subtopic',
      'universityTag',
      'examType',
      'tags',
      'isFree',
      'countryId',
      'examId',
      'programId',
      'yearId',
      'subjectId',
      'systemId',
      'topicId',
      'subtopicId',
      'status',
    ];
    for (const key of passthrough) {
      const value = (data as any)[key];
      if (value !== undefined) result[key] = value;
    }
    return result;
  });

export const updateQuestionSchema = z
  .object({
    questionText: z.string().min(1, 'Question text is required').optional(),
    questionType: z.enum(['sba', 'best_of_five', 'true_false', 'assertion_reason', 'emq', 'image_based', 'clinical_vignette', 'case_based']).optional(),
    options: optionMapSchema.optional(),
    correctAnswer: z.string().min(1, 'Correct answer is required').optional(),
    explanation: z.string().optional(),
    imageUrl: z.string().optional(),
    explanationImageUrl: z.string().optional(),
    whyCorrect: z.string().optional(),
    whyWrong: z.string().optional(),
    examPearl: z.string().optional(),
    commonTrap: z.string().optional(),
    wrongAnswerExplanations: z.string().optional(),
    references: z.string().optional(),
    subject: z.string().optional(),
    system: z.string().optional(),
    topic: z.string().optional(),
    subtopic: z.string().optional(),
    universityTag: z.string().optional(),
    examType: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    tags: z.array(z.string()).optional(),
    isFree: z.boolean().optional(),
    // Hybrid relational taxonomy IDs
    countryId: z.number().int().positive().optional().nullable(),
    examId: z.number().int().positive().optional().nullable(),
    programId: z.number().int().positive().optional().nullable(),
    yearId: z.number().int().positive().optional().nullable(),
    subjectId: z.number().int().positive().optional().nullable(),
    systemId: z.number().int().positive().optional().nullable(),
    topicId: z.number().int().positive().optional().nullable(),
    subtopicId: z.number().int().positive().optional().nullable(),
    // Content lifecycle
    status: z.enum(['draft', 'pending_review', 'under_medical_review', 'approved', 'published', 'flagged', 'errata', 'archived']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.options && !requireOptionCountForType(data.questionType, data.options)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: data.questionType === 'true_false'
          ? 'True/False questions need True and False options'
          : 'At least 4 options required for this question type',
      });
    }
  })
  .transform((data) => {
    const result: Record<string, any> = {};

    const passthrough: Array<keyof typeof data> = [
      'questionText',
      'questionType',
      'options',
      'correctAnswer',
      'explanation',
      'imageUrl',
      'explanationImageUrl',
      'whyCorrect',
      'whyWrong',
      'examPearl',
      'commonTrap',
      'wrongAnswerExplanations',
      'references',
      'subject',
      'system',
      'topic',
      'subtopic',
      'universityTag',
      'examType',
      'difficulty',
      'tags',
      'isFree',
      'countryId',
      'examId',
      'programId',
      'yearId',
      'subjectId',
      'systemId',
      'topicId',
      'subtopicId',
      'status',
    ];
    for (const key of passthrough) {
      const value = (data as any)[key];
      if (value !== undefined) result[key] = value;
    }
    return result;
  });

export const getQuestionsQuerySchema = z.object({
  search: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  status: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional().default('50'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional().default('0'),
});

export const questionIdParamSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().positive()),
});

export const reviewQuestionSchema = z.object({
  // Pipeline actions: submit (draft→pending_review), start_review
  // (pending_review→under_medical_review), approve (→approved), publish
  // (→published), reject (→draft, note required), archive, restore,
  // flag / unflag.
  action: z.enum([
    'submit',
    'start_review',
    'approve',
    'publish',
    'reject',
    'archive',
    'restore',
    'flag',
    'unflag',
  ]),
  note: z.string().max(2000).optional(),
});

const qbankStatusEnum = z.enum(['planned', 'coming_soon', 'beta', 'available', 'paused', 'archived']);
const qbankAccessTypeEnum = z.enum(['subscription', 'lifetime', 'institutional']);

// Empty-string taxonomy refs (from unset <select> values) become null.
const stripEmpty = (data: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    out[key] = value === '' ? null : value;
  }
  return out;
};

export const createQbankSchema = z
  .object({
    slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens'),
    name: z.string().min(2).max(200),
    // Taxonomy refs and price are nullable in the DB ("unset" selects send null),
    // so accept explicit null from clients.
    description: z.string().max(2000).nullable().optional(),
    countryId: z.number().int().positive().nullable().optional(),
    examSystemId: z.number().int().positive().nullable().optional(),
    examId: z.number().int().positive().nullable().optional(),
    programId: z.number().int().positive().nullable().optional(),
    academicYearId: z.number().int().positive().nullable().optional(),
    status: qbankStatusEnum.default('planned'),
    price: z.number().int().min(0).nullable().optional(),
    currency: z.string().max(8).default('PKR'),
    durationDays: z.number().int().min(1).max(36500).default(365),
    accessType: qbankAccessTypeEnum.default('subscription'),
    sortOrder: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
  })
  .transform((data) => stripEmpty(data as Record<string, any>));

export const updateQbankSchema = z
  .object({
    slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens').optional(),
    name: z.string().min(2).max(200).optional(),
    // Taxonomy refs and price are nullable in the DB, so accept explicit null.
    description: z.string().max(2000).nullable().optional(),
    countryId: z.number().int().positive().nullable().optional(),
    examSystemId: z.number().int().positive().nullable().optional(),
    examId: z.number().int().positive().nullable().optional(),
    programId: z.number().int().positive().nullable().optional(),
    academicYearId: z.number().int().positive().nullable().optional(),
    status: qbankStatusEnum.optional(),
    price: z.number().int().min(0).nullable().optional(),
    currency: z.string().max(8).optional(),
    durationDays: z.number().int().min(1).max(36500).optional(),
    accessType: qbankAccessTypeEnum.optional(),
    sortOrder: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .transform((data) => stripEmpty(data as Record<string, any>));

export const qbankMappingSchema = z.object({
  questionIds: z.array(z.number().int().positive()).max(10000),
});

export type CreateQuestion = z.infer<typeof createQuestionSchema>;
export type UpdateQuestion = z.infer<typeof updateQuestionSchema>;
export type GetQuestionsQuery = z.infer<typeof getQuestionsQuerySchema>;
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;
export type CreateQbank = z.infer<typeof createQbankSchema>;
export type UpdateQbank = z.infer<typeof updateQbankSchema>;
export type QbankMapping = z.infer<typeof qbankMappingSchema>;

// ---------------------------------------------------------------------------
// Flashcard decks & cards (admin-authored, rich HTML content).
// ---------------------------------------------------------------------------

const flashcardDeckStatusEnum = z.enum(['draft', 'published', 'archived']);

const stripEmptyTransform = <T extends Record<string, any>>(data: T): T => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    out[key] = value === '' ? null : value;
  }
  return out as T;
};

export const createFlashcardDeckSchema = z
  .object({
    slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens'),
    name: z.string().min(2).max(200),
    subject: z.string().max(100).default('Other'),
    description: z.string().max(2000).nullable().optional(),
    status: flashcardDeckStatusEnum.default('draft'),
  })
  .transform((data) => stripEmptyTransform(data as Record<string, any>));

export const updateFlashcardDeckSchema = z
  .object({
    slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens').optional(),
    name: z.string().min(2).max(200).optional(),
    subject: z.string().max(100).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: flashcardDeckStatusEnum.optional(),
  })
  .transform((data) => stripEmptyTransform(data as Record<string, any>));

export const createFlashcardSchema = z.object({
  front: z.string().min(1, 'Front (question/term) is required').max(20000),
  back: z.string().max(20000).optional(),
  note: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(30).optional(),
  image: z.string().max(5000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateFlashcardSchema = createFlashcardSchema.partial();

export const bulkFlashcardsSchema = z.object({
  cards: z.array(createFlashcardSchema).min(1).max(5000),
});

export type CreateFlashcardDeck = z.infer<typeof createFlashcardDeckSchema>;
export type UpdateFlashcardDeck = z.infer<typeof updateFlashcardDeckSchema>;
export type CreateFlashcard = z.infer<typeof createFlashcardSchema>;
export type UpdateFlashcard = z.infer<typeof updateFlashcardSchema>;
export type BulkFlashcards = z.infer<typeof bulkFlashcardsSchema>;

// ---------------------------------------------------------------------------
// Platform settings (WordPress-style grouped configuration).
// ---------------------------------------------------------------------------

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #0d9488');

export const generalSettingsSchema = z.object({
  siteName: z.string().min(1).max(100),
  tagline: z.string().max(500),
  supportEmail: z.string().email(),
  timezone: z.string().min(1).max(80),
  locale: z.string().min(2).max(10),
  dateFormat: z.string().min(1).max(40),
  homePage: z.enum(['dashboard', 'store', 'practice']),
});

export const brandingSettingsSchema = z.object({
  logoUrl: z.string().max(2000),
  faviconUrl: z.string().max(2000),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  fontFamily: z.enum(['sans', 'serif', 'mono']),
  fontSizeScale: z.enum(['sm', 'md', 'lg']),
  borderRadius: z.number().int().min(0).max(32),
  contentMaxWidth: z.number().int().min(640).max(1920),
});

export const contentSettingsSchema = z.object({
  defaultQuestionStatus: z.enum(['draft', 'pending_review', 'published']),
  defaultQbankStatus: z.enum(['draft', 'published', 'archived']),
  questionsPerPage: z.number().int().min(5).max(100),
  requireReviewBeforePublish: z.boolean(),
});

export const registrationSettingsSchema = z.object({
  openRegistration: z.boolean(),
  defaultRole: z.enum(['user', 'editor', 'teacher']),
  requireEmailVerification: z.boolean(),
  adminEmail: z.string().email(),
});

export const notificationSettingsSchema = z.object({
  emailNewUser: z.boolean(),
  emailNewQuestion: z.boolean(),
  emailNewReview: z.boolean(),
  emailNewPurchase: z.boolean(),
  emailAnnouncements: z.boolean(),
});

export const securitySettingsSchema = z.object({
  requireMFA: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(1).max(1440),
  passwordMinLength: z.number().int().min(4).max(64),
  passwordRequireComplexity: z.boolean(),
  maxLoginAttempts: z.number().int().min(1).max(50),
  maintenanceMode: z.boolean(),
});

export const paymentSettingsSchema = z.object({
  currency: z.string().min(3).max(3).toUpperCase(),
  provider: z.enum(['dev', 'stripe', 'jazzcash', 'easypaisa']),
  taxRatePercent: z.number().min(0).max(50),
  refundPolicyDays: z.number().int().min(0).max(365),
});

export const storageSettingsSchema = z.object({
  maxUploadSizeMB: z.number().int().min(1).max(500),
  allowedImageTypes: z.array(z.string().min(1).max(20)).max(20),
  storageBackend: z.enum(['local', 's3']),
});

export const integrationSettingsSchema = z.object({
  googleAnalyticsId: z.string().max(100),
  metaDescription: z.string().max(500),
  customHeadCode: z.string().max(10000),
});

export const animationsSettingsSchema = z.object({
  enabled: z.boolean(),
  defaultEffect: z.enum(['none', 'fade', 'slide', 'scale', 'zoom', 'bounce', 'shimmer', 'pulse', 'marquee', 'typewriter']),
  durationMs: z.number().int().min(0).max(3000),
  delayMs: z.number().int().min(0).max(2000),
  repeat: z.enum(['none', 'once', 'infinite']),
  trigger: z.enum(['on_load', 'on_view', 'always']),
});

export const featureFlagsSettingsSchema = z.object({
  flashcards: z.boolean(),
  richContent: z.boolean(),
  pastPapers: z.boolean(),
  aiTutor: z.boolean(),
  aiQuestionReview: z.boolean(),
  spacedRepetition: z.boolean(),
  studyBuddies: z.boolean(),
  dailyChallenge: z.boolean(),
  payments: z.boolean(),
  waitlist: z.boolean(),
  newExamEngine: z.boolean(),
});

export const updateSettingsSchema = z.object({
  general: generalSettingsSchema.partial().optional(),
  branding: brandingSettingsSchema.partial().optional(),
  content: contentSettingsSchema.partial().optional(),
  registration: registrationSettingsSchema.partial().optional(),
  notifications: notificationSettingsSchema.partial().optional(),
  security: securitySettingsSchema.partial().optional(),
  payments: paymentSettingsSchema.partial().optional(),
  storage: storageSettingsSchema.partial().optional(),
  integrations: integrationSettingsSchema.partial().optional(),
  animations: animationsSettingsSchema.partial().optional(),
  featureFlags: featureFlagsSettingsSchema.partial().optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// Per-section partial schemas for PATCH /api/admin/settings/:section.
export const UPDATE_SETTINGS_SHAPE = {
  general: generalSettingsSchema.partial(),
  branding: brandingSettingsSchema.partial(),
  content: contentSettingsSchema.partial(),
  registration: registrationSettingsSchema.partial(),
  notifications: notificationSettingsSchema.partial(),
  security: securitySettingsSchema.partial(),
  payments: paymentSettingsSchema.partial(),
  storage: storageSettingsSchema.partial(),
  integrations: integrationSettingsSchema.partial(),
  animations: animationsSettingsSchema.partial(),
  featureFlags: featureFlagsSettingsSchema.partial(),
} as const;
