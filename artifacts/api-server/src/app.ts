import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { maintenanceMode } from './middleware/maintenance.js';
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
import { announcementsRouter } from './routes/announcements.js';
import { storageRouter } from './routes/storage.js';
import { flashcardsRouter } from './routes/flashcards.js';
import { settingsRouter } from './routes/settings.js';
import { rbacRouter } from './routes/rbac.js';
import { taxonomyRouter } from './routes/taxonomy.js';
import { importRouter } from './routes/import.js';
import { paymentsRouter } from './routes/payments.js';
import { comingSoonRouter, comingSoonAdminRouter } from './routes/coming-soon.js';
import { emailRouter } from './routes/email.js';
import { seedEmailTemplates } from './utils/seed-email-templates.js';
import { seedRbac } from './utils/seed-rbac.js';
import { startEntitlementSweeper } from './utils/entitlement-sweeper.js';
import { testConnection } from './db.js';
import { seedAnnouncements } from './utils/seed-announcements.js';
import { errorHandler } from './utils/errors.js';
import { rateLimit } from './middleware/rateLimit.js';

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

    // Dotenv convention: an explicitly-set environment variable wins over the
    // local env file, so callers can override (e.g. DATABASE_URL=sqlite:mock
    // for the mock DB, PORT for a custom port).
    if (process.env[key] !== undefined) {
      continue;
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

// Rate limiting — 100 requests per 15 minutes per path. The public settings
// endpoint is whitelisted data fetched on every page mount (cached server-side),
// so it gets a much higher allowance.
const strictLimiter = rateLimit(100, 15 * 60 * 1000);
const publicSettingsLimiter = rateLimit(1000, 15 * 60 * 1000);
app.use((req: any, res: any, next: any) => {
  if (req.path === '/api/settings/public') return publicSettingsLimiter(req, res, next);
  return strictLimiter(req, res, next);
});

// Health check
app.get('/api/healthz', (req: any, res: any) => {
res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Server-side maintenance mode — 503 for non-exempt routes when enabled.
// Exempt: health, auth (login must work), settings (frontend needs branding +
// maintenance status) and admin (admin bypass). Fail-closed on read errors.
app.use('/api', maintenanceMode());

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
app.use('/api/announcements', announcementsRouter);
app.use('/api/taxonomy', taxonomyRouter);
app.use('/api/admin/import', importRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/flashcards', flashcardsRouter);
app.use('/api/coming-soon', comingSoonRouter);
app.use('/api/admin/coming-soon', comingSoonAdminRouter);
app.use('/api/admin/email', emailRouter);
app.use('/api/admin/rbac', rbacRouter);
app.use('/api', settingsRouter);

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

// Seed the default email template library on first boot (idempotent) and
// start the entitlement-expiry notification sweeper.
if (!process.env.VERCEL) {
  testConnection().then(async () => {
    try {
      const seeded = await seedEmailTemplates();
      if (seeded > 0) console.log(`📧 Seeded ${seeded} default email templates`);
    } catch (err: any) {
      console.warn('Email template seeding skipped:', err.message);
    }
    try {
      const rbacSeeded = await seedRbac();
      if (rbacSeeded > 0) console.log('🔐 Seeded RBAC (permissions, account types, roles)');
    } catch (err: any) {
      console.warn('RBAC seeding skipped:', err.message);
    }
    try {
      const annSeeded = await seedAnnouncements();
      const total = annSeeded.templates + annSeeded.general + annSeeded.personalized;
      if (total > 0) console.log(`📢 Seeded ${annSeeded.templates} templates, ${annSeeded.general} general + ${annSeeded.personalized} personalized announcements`);
    } catch (err: any) {
      console.warn('Announcement seeding skipped:', err.message);
    }
    startEntitlementSweeper();
    server = app.listen(PORT, () => {
      console.log(`✅ Medicology API running at http://localhost:${PORT}/api`);
    });
  });
} else {
  testConnection();
  try {
    await seedEmailTemplates();
  } catch { /* seeding is best-effort */ }
}

export default app;

export let server: import('node:http').Server | undefined;