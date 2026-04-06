import { z } from 'zod';

export const createQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  subject: z.string().min(1, 'Subject is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  options: z.array(z.string()).min(4, 'At least 4 options required'),
  correctOption: z.number().min(0).max(3),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const getQuestionsQuerySchema = z.object({
  search: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional().default('50'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional().default('0'),
});

export const questionIdParamSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().positive()),
});

export type CreateQuestion = z.infer<typeof createQuestionSchema>;
export type UpdateQuestion = z.infer<typeof updateQuestionSchema>;
export type GetQuestionsQuery = z.infer<typeof getQuestionsQuerySchema>;
