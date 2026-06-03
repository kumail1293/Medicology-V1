import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { questionsRouter } from './routes/questions.js';
import { progressRouter } from './routes/progress.js';
import { adminRouter } from './routes/admin.js';
import { sessionsRouter } from './routes/sessions.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { notesRouter } from './routes/notes.js';
import { dailyRouter } from './routes/daily.js';
import { flagsRouter } from './routes/flags.js';
import { buddiesRouter } from './routes/buddies.js';
import { errataRouter } from './routes/errata.js';
import { practiceRouter } from './routes/practice.js';
import { qbanksRouter } from './routes/qbanks.js';
import { storageRouter } from './routes/storage.js';
import { testConnection } from './db.js';
import { errorHandler } from './utils/errors.js';
import { rateLimit, startRateLimitCleanup } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnvFile() {
  const localEnvPath = path.join(__dirname, '..', '.env.local');

  if (!fs.existsSync(localEnvPath)) {
    return;
  }

  const raw = fs.readFileSync(localEnvPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('export ')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnvFile();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:3000';
const ALLOWED_ORIGINS = allowedOriginsRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS configuration - restrict to specific domains
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'), false);
    }
  },
  credentials: true,
  maxAge: 3600
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
startRateLimitCleanup();

// Health check
app.get('/api/healthz', (req: any, res: any) => {
res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/admin', adminRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/flags', flagsRouter);
app.use('/api/buddies', buddiesRouter);
app.use('/api/errata', errataRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/qbanks', qbanksRouter);
app.use('/api/storage', storageRouter);

// 404 handler
app.use((req: any, res: any) => {
    res.status(404).json({ 
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Global error handling middleware (must be last)
app.use(errorHandler as any);

if (!process.env.VERCEL) {
  testConnection().then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Medicology API running at http://localhost:${PORT}/api`);
    });
  });
} else {
  testConnection();
}

export default app;