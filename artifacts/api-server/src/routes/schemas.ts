import { z } from 'zod';

const optionMapSchema = z
  .object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
    E: z.string().optional(),
  })
  .refine((options) => Object.values(options).filter(Boolean).length >= 4, {
    message: 'At least 4 options required',
  });

export const createQuestionSchema = z
  .object({
    questionText: z.string().min(1, 'Question text is required'),
    options: optionMapSchema,
    correctAnswer: z.string().min(1, 'Correct answer is required'),
    explanation: z.string().optional(),
    imageUrl: z.string().optional(),
    explanationImageUrl: z.string().optional(),
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
  .transform((data) => {
    const result: Record<string, any> = {
      questionText: data.questionText,
      options: data.options,
      correctAnswer: data.correctAnswer,
      difficulty: data.difficulty,
    };

    const passthrough: Array<keyof typeof data> = [
      'explanation',
      'imageUrl',
      'explanationImageUrl',
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
    options: optionMapSchema.optional(),
    correctAnswer: z.string().min(1, 'Correct answer is required').optional(),
    explanation: z.string().optional(),
    imageUrl: z.string().optional(),
    explanationImageUrl: z.string().optional(),
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
  .transform((data) => {
    const result: Record<string, any> = {};

    const passthrough: Array<keyof typeof data> = [
      'questionText',
      'options',
      'correctAnswer',
      'explanation',
      'imageUrl',
      'explanationImageUrl',
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

export type CreateQuestion = z.infer<typeof createQuestionSchema>;
export type UpdateQuestion = z.infer<typeof updateQuestionSchema>;
export type GetQuestionsQuery = z.infer<typeof getQuestionsQuerySchema>;
