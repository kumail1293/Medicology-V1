import { Router } from 'express';
import { db } from '../db.js';
import { userProgressTable, questionsTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const practiceRouter = Router();

practiceRouter.post('/submit', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { questionId, selectedAnswer, timeTaken, mode } = req.body;
    if (!questionId || !selectedAnswer) {
      return res.status(400).json({ error: 'questionId and selectedAnswer required' });
    }
    const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, Number(questionId)));
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const isCorrect = question.correctAnswer === selectedAnswer;
    await db.insert(userProgressTable).values({
      userId: req.user!.id,
      questionId: Number(questionId),
      selectedAnswer,
      isCorrect,
      timeTaken: Number(timeTaken) || 0,
      mode: mode || 'practice',
    });
    return res.json({ isCorrect, correctAnswer: question.correctAnswer, explanation: question.explanation });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
