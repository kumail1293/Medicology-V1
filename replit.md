# Medicology QBank - Workspace

## Overview

Full-featured medical question bank (QBank) application for MBBS students in Pakistan. Built as a pnpm workspace monorepo with a React frontend, Express API server, and PostgreSQL database.

## Application Features

- **Authentication**: JWT-based auth (register/login), token expiry auto-logout (60s interval), stored in localStorage as `medicology_token`
- **Forgot/Reset Password**: Token-based reset flow (`/forgot-password`, `/reset-password`), 15-min token TTL, strong password enforcement
- **Practice Mode**: Filter questions by subject, topic, system; timed sessions
- **Exam Mode**: Full test sessions with analytics
- **Daily Challenge**: A new question set every day
- **Analytics**: Progress tracking, accuracy charts, weak topic identification
- **Review Hub**: Bookmarks, wrong questions, notes
- **Flashcards (Anki-style)**: SM-2+ spaced repetition, cloze deletion, HTML card rendering, IndexedDB storage
- **Test Sessions**: Create and manage custom test sessions
- **QBanks**: Premium question bank purchases with JazzCash/Easypaisa/Stripe payment modal
- **Payment System**: `POST /api/payments/initiate` + `POST /api/payments/verify`; HMAC-SHA256 signing for JazzCash & Easypaisa; Stripe Checkout; callback page at `/payment/callback`
- **Security**: Bot detection (mountTime < 1500ms), client-side rate limiting, 3-strike login lockout, content protection (print block, user-select none), watermark, DevTools detection, session integrity checksums
- **Study Buddies**: Study partner matching
- **AI Explanations**: GPT-powered question explanations via Replit AI Integrations
- **Admin Panel**: Bulk upload questions (Excel), manage question flags and errata, role/permission management
- **Announcements**: Popup / banner / ticker system
- **User Profile**: Edit name, email, college, year, password

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + wouter + React Query + Zustand
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API), Vite (frontend)
- **AI**: OpenAI gpt-4o-mini via Replit AI Integrations (env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`)

## Structure

```text
medicology-workspace/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080, path: /api)
│   └── medicology/         # React frontend (port 18521, path: /)
├── lib/
│   ├── api-spec/           # OpenAPI spec (openapi.yaml) + Orval codegen
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod request/response schemas
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema (11 tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts, auth, profile (college, university, year) |
| `questions` | MCQ questions with options, explanations, tags |
| `progress` | Per-user answer history and performance |
| `bookmarks` | Saved questions per user |
| `notes` | User notes per question |
| `daily_challenge` | Daily challenge sets |
| `test_sessions` | Custom test session definitions |
| `question_flags` | User-reported question issues |
| `qbank_purchases` | Premium QBank access records |
| `study_buddies` | Study partner connections |
| `errata` | Approved corrections for questions |

## API Routes (all under `/api`)

| Path | Purpose |
|------|---------|
| `/auth` | register, login, me |
| `/questions` | list (filters: subject/topic/system/unused/incorrect/marked), get single |
| `/practice` | submit answer |
| `/progress` | analytics, history, wrong questions |
| `/bookmarks` | add, remove, list |
| `/notes` | upsert, get per question |
| `/ai` | get AI explanation for a question |
| `/daily` | get daily challenge |
| `/flags` | submit question flag |
| `/buddies` | study buddy management |
| `/errata` | submit errata |
| `/admin` | bulk upload questions, get all questions |
| `/sessions` | create, list, get test sessions |
| `/qbanks` | list, purchase QBanks |

## Key Files

- `artifacts/api-server/src/app.ts` — Express app, mounts all routes at `/api`
- `artifacts/api-server/src/routes/index.ts` — Route registry
- `artifacts/api-server/src/middleware/auth.ts` — JWT auth middleware (generateToken, authenticate, requireAdmin)
- `artifacts/medicology/src/lib/auth.tsx` — Auth context + JWT fetch monkey-patch
- `artifacts/medicology/src/lib/settings.tsx` — Theme settings (light/dark/easy/usmle)
- `artifacts/medicology/src/App.tsx` — Full wouter routing, all pages
- `lib/api-spec/openapi.yaml` — Source of truth for API contract
- `lib/db/src/schema/index.ts` — All 11 Drizzle table exports

## Development Workflow

```bash
# Install packages
pnpm install

# Push DB schema
pnpm --filter @workspace/db run push

# Regenerate API client hooks after openapi.yaml changes
pnpm --filter @workspace/api-spec run codegen

# Run API server
pnpm --filter @workspace/api-server run dev

# Run frontend
pnpm --filter @workspace/medicology run dev
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` (composite: true). Always typecheck from root:
```bash
pnpm run typecheck  # tsc --build --emitDeclarationOnly
```

## Admin Access

To create an admin user, register normally then run:
```sql
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

## Themes

Four CSS themes controlled by class on `<html>`:
- `light` (default) — clean white
- `dark` — dark mode
- `easy` — sepia/warm tones for reduced eye strain
- `usmle` — clinical blue, optimized for USMLE-style study
