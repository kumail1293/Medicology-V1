import { z } from 'zod';

/**
 * Validation schemas for admin routes
 * Prevents invalid data from reaching database
 */

// Question schema
export const QuestionSchema = z.object({
  questionText: z.string().min(10).max(10000),
  subject: z.string().min(2).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  options: z.record(z.string().min(1).max(1000)),
  correctOption: z.string(),
  explanation: z.string().min(10).max(5000).optional(),
  source: z.string().max(200).optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  category: z.string().max(100).optional(),
});

export const QuestionCreateSchema = QuestionSchema.strict();

export const QuestionUpdateSchema = QuestionSchema.partial().strict();

// Bulk operations schemas
export const BulkQuestionsSchema = z.object({
  questions: z.array(QuestionCreateSchema).min(1).max(1000),
});

export const BulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000),
});

export const BulkEditSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000),
  field: z.enum(['difficulty', 'category', 'subject']), // Whitelist allowed fields
  value: z.string().max(200),
});

// Query params schemas
export const QuestionsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

// Middleware to validate request body
export function validateSchema<T>(schema: z.ZodSchema<T>) {
  return async (req: any, res: any, next: any) => {
    try {
      req.validatedBody = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

// Middleware to validate query params
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (req: any, res: any, next: any) => {
    try {
      req.validatedQuery = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
