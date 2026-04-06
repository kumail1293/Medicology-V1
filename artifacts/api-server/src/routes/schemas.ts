import { z } from 'zod';

export const createQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  subject: z.string().min(1, 'Subject is required'),
  topic: z.string().min(1, 'Topic is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  options: z.array(z.string()).min(4, 'At least 4 options required'),
  correctOption: z.number().min(0).max(3),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).transform(data => {
  const result: any = {
    questionText: data.questionText,
    subject: data.subject,
    topic: data.topic,
    difficulty: data.difficulty,
    options: data.options,
    correctAnswer: data.options[data.correctOption],
  };
  if (data.explanation) result.explanation = data.explanation;
  if (data.tags) result.tags = data.tags;
  return result;
});

export const updateQuestionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required').optional(),
  subject: z.string().min(1, 'Subject is required').optional(),
  topic: z.string().min(1, 'Topic is required').optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  options: z.array(z.string()).min(4, 'At least 4 options required').optional(),
  correctOption: z.number().min(0).max(3).optional(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).transform(data => {
  const result: any = {};
  if (data.questionText) result.questionText = data.questionText;
  if (data.subject) result.subject = data.subject;
  if (data.topic) result.topic = data.topic;
  if (data.difficulty) result.difficulty = data.difficulty;
  if (data.options) result.options = data.options;
  if (data.correctOption !== undefined && data.options) result.correctAnswer = data.options[data.correctOption];
  if (data.explanation) result.explanation = data.explanation;
  if (data.tags) result.tags = data.tags;
  return result;
});

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
