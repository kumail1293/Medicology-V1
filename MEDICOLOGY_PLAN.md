# Medicology V1 --- DeepSeek Implementation Plan

## Objective

Turn the existing Medicology-V1 repository into a production-grade,
database-driven medical examination platform without rewriting the
existing stack.

The platform roadmap is:

-   Pakistan: UHS, KMU, KEMU, SZABMU, NUMS, DUHS and other
    universities/boards
-   Programs: MBBS, BDS
-   Professional exams: FCPS, JCAT, PGET, NLE
-   Later: USMLE, PLAB, AMC and other international examinations

Core hierarchy:

`Country → Exam System → Exam/University/Board → Program → Academic Year/Part → Subject → System → Topic → Subtopic → Question`

Every question has an immutable public QID and may belong to multiple
QBanks.

------------------------------------------------------------------------

# Phase P0 --- Do This First

Do not start P1/P2/P3 until P0 is stable and tested.

## P0.1 Database-driven QBank catalogue

Replace hard-coded QBank/product arrays with database entities.

A QBank/product should support:

-   name, slug, description
-   country
-   exam system
-   exam/university
-   program
-   academic year/part
-   status
-   price/currency
-   access duration
-   question count
-   metadata
-   timestamps

Statuses:

`PLANNED`, `COMING_SOON`, `BETA`, `AVAILABLE`, `PAUSED`, `ARCHIVED`

No university/exam/product catalogue should be hard-coded in API routes.

## P0.2 Question ↔ QBank many-to-many

Use:

`questions ↔ qbank_questions ↔ qbanks`

A single QID must be reusable in UHS, KMU, FCPS, NLE, etc. without
duplicating the question.

## P0.3 Taxonomy integration

Use the existing relational taxonomy as the source of truth.

New questions must resolve relational IDs for:

-   Country
-   Exam System
-   Exam
-   Program
-   Academic Year
-   Subject
-   System
-   Topic
-   Subtopic

Keep legacy text fields temporarily for backward compatibility; do not
create a second taxonomy system.

## P0.4 QID integrity

Preserve the existing immutable QID architecture.

Rules:

-   unique
-   immutable
-   preserve a valid QID supplied in Excel
-   generate one when blank
-   show conflicts before updates
-   never silently overwrite

## P0.5 Versioning and audit

Preserve existing question versioning/audit infrastructure.

Lifecycle:

`DRAFT → PENDING_REVIEW → MEDICAL_REVIEW → APPROVED → PUBLISHED`

Additional states:

`FLAGGED`, `ERRATA`, `ARCHIVED`

Important changes must record editor, timestamp, old/new values and
change type.

------------------------------------------------------------------------

# P0.6 Excel/CSV import pipeline

Build:

`UPLOAD → COLUMN MAPPING → VALIDATION → PREVIEW → DUPLICATE DETECTION → TAXONOMY RESOLUTION → QID GENERATION → ERROR REPORT → IMPORT → REVIEW → PUBLISH`

Support XLSX and CSV.

Recommended columns:

-   QID
-   Question
-   Option A-E
-   Correct Answer
-   Explanation
-   References
-   Country
-   Exam System
-   Exam
-   Program
-   Academic Year
-   Subject
-   System
-   Topic
-   Subtopic
-   Difficulty
-   Question Type
-   Exam Year
-   Tags
-   Image
-   Image Caption
-   Status

Never auto-publish imported questions.

## Validation

Detect:

-   missing question
-   insufficient options
-   invalid answer
-   duplicate QID
-   duplicate normalized question
-   invalid taxonomy
-   unknown exam/university/program/year
-   invalid difficulty/question type
-   malformed image reference

Provide row-level errors and downloadable error reports.

## Duplicate detection

Implement:

1.  exact QID duplicate detection
2.  normalized-text duplicate detection
3.  similarity detection where practical

Admin choices:

-   Merge
-   Keep both
-   Reject
-   Review

Never silently delete or overwrite.

------------------------------------------------------------------------

# P0.7 Secure entitlement architecture

Do not use a purchase row as the access-control mechanism.

Use:

`User → Entitlement → QBank/Product`

Support:

`ACTIVE`, `EXPIRED`, `REVOKED`, `COMPLIMENTARY`, `SCHOLARSHIP`, `BETA`,
`INSTITUTIONAL`

Every protected QBank operation must verify entitlement server-side.

## Payment security

Never let a frontend request directly activate access.

Target:

`Order → Payment Provider → Verified Callback/Webhook → Server Verification → Entitlement`

If no payment provider is configured, create a provider-neutral
abstraction and secure development/mock provider.

Use idempotency.

Never trust frontend-supplied price, duration, ownership, payment
status, role or entitlement state.

------------------------------------------------------------------------

# P0.8 Coming Soon / Notify Me

Products must be database-driven.

For `PLANNED` or `COMING_SOON` products display:

-   Coming Soon
-   Notify Me

Store:

-   user
-   product
-   timestamp
-   status

Prevent duplicate registrations.

Provide admin demand counts.

------------------------------------------------------------------------

# P0.9 Testing and migrations

Every schema change requires a proper migration.

Never drop existing production data.

Add tests for:

-   QID uniqueness/immutability
-   taxonomy relationships
-   import validation
-   duplicate detection
-   version creation
-   review permissions
-   entitlement access/expiry/revocation
-   payment verification
-   webhook idempotency
-   QBank filtering

Run:

-   typecheck
-   tests
-   integration tests
-   frontend tests
-   production build

------------------------------------------------------------------------

# Phase P0.5 --- Rich Content Authoring & Flashcard Decks

Medical content is rich: tables, graphics, images and flowcharts are as
important as the text. This phase makes every content surface editable
with a WYSIWYG editor (Elementor-style experience) and moves flashcard
decks into the database.

## P0.5.1 Rich text everywhere content is written

Editors (role `editor`, `teacher` and above; admins included) can edit
with a rich-text toolbar instead of plain textareas:

-   MCQ stems and options
-   Explanations
-   Flashcards (front, back, note)
-   Announcements

Required editor capabilities:

-   bold / italic / underline / strike / highlight
-   headings, bullet & numbered lists, code blocks
-   text alignment
-   links
-   tables (insert, add/remove rows & columns, delete)
-   images (paste URL or upload via the storage API)
-   flowcharts / diagrams are supported as embedded images

Server-side: sanitize/validate rich HTML on write; render sanitized HTML
on read (never `dangerouslySetInnerHTML` unsanitized content).

## P0.5.2 Role-based content editing

Server middleware (`requireContentEditor`) gates content-authoring
routes to `editor`, `teacher`, and `admin` roles. Students keep
read-only access.

## P0.5.3 Database-driven flashcard decks

Admin (and content editors) can publish official decks that students
sync into their local spaced-repetition system:

-   `flashcard_decks`: slug, name, subject, description, status
    (`draft | published | archived`), card count, created by
-   `flashcards`: deck FK, rich-HTML front/back, note, tags (jsonb),
    image, sort order
-   Same rich-text editing capabilities as questions/announcements
-   Bulk-add a whole deck in one call (Q:/A: blocks or plain lines)
-   Publish/unpublish/archive with audit logging
-   Students see published decks only and sync cards locally (one-way
    copy; local progress stays with the student)

## P0.5.4 Flashcard rendering fixes

-   Markdown image links (`![alt](url)`) render as `<img>` in study
    sessions and the card browser
-   Broken images show a graceful text fallback, never a broken-image
    icon
-   External images are lazy-loaded with `referrerpolicy="no-referrer"`
-   Sanitized HTML rendering with left-aligned, readable typography
    (tables, images and flowcharts flow correctly inside cards)

## P0.5.5 Migration & tests

-   Migration `0002_flashcard_decks_and_cards.sql` (additive, no drops)
-   Typecheck, build, and the API test suite must stay green

## P0.5.6 ✅ Role management (shipped)

-   Admins assign `user` / `editor` / `teacher` roles directly from the
    Users admin page (inline per-row dropdown + edit modal)
-   Only `superadmin` can grant or revoke `admin` / `superadmin` roles
-   Guards: role whitelist validation, self-demotion blocked, last-admin
    cannot be demoted, and every role change is audit-logged
    (`user.role_change` with before/after)

------------------------------------------------------------------------

## P0.5.7 ✅ Admin settings deep-dive (shipped)

Applied `MEDICOLOGY_ADMIN_SETTINGS_PLAN`/`SKILL` (WordPress/Elementor-style
platform config). Reused the existing `app_settings` table + audit trail —
no duplicate systems.

-   **Feature flags** — `featureFlags` group (flashcards, rich content,
    past papers, AI tutor/review, spaced repetition, study buddies, daily
    challenge, payments, waitlist, exam engine) exposed via
    `/api/settings/public` and **enforced server-side** (`requireFeature`
    middleware → 503 on payments/flashcards/daily/buddies/waitlist when
    disabled). Frontend toggles in Admin → Settings → Feature Flags.
-   **Maintenance mode** — now **enforced server-side**: 503 for
    non-exempt routes when enabled, with `/api/health`, `/api/auth`,
    `/api/settings` and `/api/admin` exempt (admin bypass). Frontend shows
    a friendly maintenance screen for non-admins.
-   **History & restore** — settings PUT/PATCH/reset now snapshot
    `oldValues`; `GET /api/admin/settings/history` reads the audit trail and
    `POST /api/admin/settings/restore` re-applies a snapshot. Admin UI
    "Activity & History" tab with one-click Restore.
-   **Section-scoped API** — `GET`/`PATCH /api/admin/settings/:section`
    with per-section zod validation.
-   Cache invalidation for flags + maintenance after every settings write.

## P0.5.8 ✅ Announcement templates + scheduling (shipped)

-   Migration `0005` (additive): `announcements` gains `starts_at`
    (scheduling window with `expires_at`), `priority`, `theme`,
    `dismissible`, `frequency` (once/daily/every-visit), `target_route`;
    new `announcement_templates` table.
-   Reusable admin-authored templates (exam alert, QBank launch,
    promotion, system notice, maintenance, feature) with full CRUD +
    audit; "Use template" prefills the announcement builder.
-   Active feed enforces the schedule window, role targeting, and sorts
    by priority; display honours themes, modal/toast/exam-alert/promotion
    types, dismissibility frequency, and route targeting.
## P0.5.9 ✅ Animation controls (shipped)

-   New `animations` settings group (master switch, effect, duration,
    delay, repeat) exposed via `/api/settings/public` and applied by an
    `AnimationProvider` as CSS variables + an `.anim` utility class.
-   Effects: none, fade, slide, scale, zoom, bounce, shimmer, pulse,
    marquee, typewriter — all with keyframes in `index.css`.
-   **`prefers-reduced-motion` always wins** (CSS hard rule + runtime
    matchMedia listener); admin toggles only affect other users.
-   Admin → Settings → Animations includes a live preview.
## P0.5.10 ✅ Media library (shipped)

-   Migration `0006` (additive): new `media` table — filename, original
    name, MIME, size, parsed dimensions (PNG/JPEG/GIF/WebP header
    parsing, no native deps), URL, alt text, category, uploader.
-   Settings-driven upload validation: MIME whitelist + size cap from
    the `storage` settings group; non-image uploads get a clean 400
    (multer fileFilter error mapped, no more 500s).
-   Admin → Media Library page: grid with previews, category filter
    chips, search by name/alt text, inline alt-text edit, category
    change, copy URL, delete (removes file + row).
-   Shared `MediaPicker` dialog wired into the rich-text editor
    (“Browse media library” toolbar button) — pick a stored image and
    insert at the cursor; editor upload button routes through the
    media endpoints (audited, metadata recorded).
-   Owner-scoped edits: only the uploader (or admins) can edit/delete;
    unauthenticated uploads 401; files served publicly via
    `/api/storage/uploads/:filename`.
## P0.5.11 ✅ QBank/exam scoped overrides (shipped)

-   Migration `0007` (additive): `settings_overrides` table — one row per
    (scope, scopeId, group, key) with a JSONB value; unique per key.
-   Scopes follow the plan's precedence (deterministic, tested):
    system safety constraints → QBank → topic → system → subject →
    year → program → exam → country → platform default.
-   New `examSettings` group (platform-wide defaults): QBank defaults
    (trial questions, attempt limit, bookmarks/notes/reporting) + exam
    behavior (question count, duration, marking scheme, negative marking,
    pass %, navigation, question palette, review behavior, auto-submit,
    pause/resume, result visibility, explanations, answer reveal).
-   Admin → Settings → Scoped Overrides: pick a scope + entity (QBank or
    any taxonomy node), see every key's effective value with a provenance
    badge, set an override or clear it to inherit. Every write/delete is
    audit-logged; safety keys (maintenance mode, MFA, payment provider)
    can never be overridden.
-   Session creation resolves the context's rules (QBank + its taxonomy
    chain); explicit client values always win. Public
    `GET /api/settings/exam` serves the resolution + provenance to the
    exam engine.
-   Deferred next: coming-soon catalogue, granular admin roles.

------------------------------------------------------------------------

## P0.5.12 ✅ Bulk import upgrade: templates + per-row editing (shipped)

-   **Templates per type**: Admin → Bulk Import → Download template gives a
    downloadable `.xlsx` with every supported column as headers, one fully
    filled example row per question type (SBA, Best-of-five, True/False,
    Assertion/Reason, EMQ, Image-based, Clinical vignette, Case-based), and
    a Guide sheet explaining exactly where to put what. The type dropdown
    filters to a per-type template. (`GET /api/admin/import/template`)
-   **Type-aware validation**: `validateRow` now checks per-type layout —
    True/False needs exactly Option A (True) + Option B (False) with a
    True/False answer; Assertion/Reason needs both Assertion and Reason
    text with a classic A–E answer; standard MCQs need ≥4 options and a
    valid A–E answer. Structured explanations (Why Correct, Why Wrong,
    Exam Pearl, Common Trap) map from their columns.
-   **Per-row editing before import**: every preview row has an **Edit**
    button that opens the same rich question editor used for individual
    questions (question text via the rich-text editor with media picker,
    options, answer, structured explanations, taxonomy). Edits apply back
    to the preview in-memory; nothing is written until the admin imports.
-   **Review-gated import**: imports land in the Review Queue, never
    straight into the QBank — with a "Review imported questions" CTA after
    a successful import. Imported questions use the configured default
    status (pending_review by default) and can be edited again from the
    Review Queue.
-   **Bulk Import settings group** (Admin → Settings → Bulk Import):
    default import status, default difficulty, duplicate threshold,
    max upload size, allowed file types, review-before-publish gate,
    auto-create taxonomy, audit-logging of imports — all zod-validated,
    read live by the importer (file limits + allowed types + validation
    policy).
-   Fixed: the import page used raw `fetch()` and relied on the
    `window.fetch` auth patch; it now uses `apiFetch` like every other
    admin page. Also fixed a column misalignment in the template's example
    rows (6 of 8 rows had their Correct Answer one slot off, which broke
    validation for those question types).
-   Deferred next: coming-soon catalogue, granular admin roles.

------------------------------------------------------------------------

------------------------------------------------------------------------

# Phase P1 --- Examination Engine

## P1.1 ✅ Question types + structured explanations (shipped)

-   Migration `0004_p1_question_types_structured_explanations.sql`
    (additive): `questions.question_type` (default `sba`) +
    `why_correct`, `why_wrong`, `exam_pearl`, `common_trap` columns
-   Formal types supported: SBA, Best-of-five, True/False,
    Assertion/Reason, EMQ, Image-based, Clinical Vignette, Case-based
    (`QUESTION_TYPES` const in `lib/db/src/schema/questions.ts`)
-   Admin question editor: type picker + structured-explanation rich
    text sections (why-correct / why-wrong / exam pearl / common trap)
-   Session (`session-v2`) + `QuestionView` render True/False and
    Assertion/Reason with their standard option sets, and show the
    structured explanation sections in feedback
-   Imported questions default to `sba` (DB default)

## P1.2 ✅ Confidence tracking (shipped)

-   Guess / Unsure / Fairly Confident / Very Confident picker after
    each answered question; persisted per answer in
    `test_sessions.answers[].confidence` (JSONB, no migration needed)
-   Powers future mastery/analytics work

## P1.3 In progress / next

-   Image question specialty metadata (ECG, X-ray, CT, MRI, histopath,
    anatomy, ophthalmology, dentistry)
-   Exam simulator polish: marking scheme, section-level config
    (timer/palette/autosave/flags already exist in `session-v2`)
-   Database-driven Custom Test Builder (currently client-side in
    `create-test.tsx`)
-   Mastery engine (per question/subtopic/topic/system/subject/QBank/
    exam) and spaced repetition for questions
-   Confidence → analytics dashboards (P2)

------------------------------------------------------------------------

# Phase P2 --- Analytics

Add:

-   subject/topic/difficulty accuracy
-   time/question
-   retention
-   confidence
-   mastery
-   QBank completion
-   mistake patterns
-   exam readiness
-   study consistency
-   historically frequently tested/past-paper metadata

Do not make unsupported prediction claims.

------------------------------------------------------------------------

# Phase P3 --- Future Platform

Later:

-   AI taxonomy suggestions
-   duplicate detection
-   question quality checks
-   difficulty/Bloom classification
-   reviewer assistance
-   adaptive testing
-   institutional licensing
-   university dashboards
-   teacher/reviewer portals
-   PWA/offline/low-data mode
-   internationalization
-   international exams
-   subscriptions
-   scholarships

AI must never silently publish medical content; human medical review
remains authoritative.

------------------------------------------------------------------------

# UI/UX Direction

Medicology should feel like a professional medical examination platform,
not a generic SaaS dashboard.

Priorities:

-   mobile-first
-   clean typography
-   strong hierarchy
-   fast navigation
-   accessible contrast
-   subtle meaningful animations
-   excellent exam-taking experience
-   minimal clutter

Avoid excessive cards, gradients, modals and decorative animation.

------------------------------------------------------------------------

# Architecture Rules

The database is the source of truth.

Do not hard-code:

-   universities
-   exams
-   subjects
-   years
-   QBank products
-   prices
-   entitlements

A feature is not considered implemented merely because a table/component
exists.

Definition of done:

`DATABASE + API + BUSINESS LOGIC + UI where applicable + AUTHORIZATION + VALIDATION + TESTS`

Do not rewrite the application or create competing schemas. Reuse
existing functionality.

------------------------------------------------------------------------

# Recommended Execution Order

`P0.1 QBanks` → `P0.2 QBank mapping` → `P0.3 taxonomy` →
`P0.4 QID/version integrity` → `P0.5 import` → `P0.6 duplicates` →
`P0.7 review` → `P0.8 entitlements` → `P0.9 payment security` →
`P0.10 coming soon` → `tests/build/security audit` →
`P0.5 content authoring (rich text + flashcard decks)` → `P1` → `P2` → `P3`

------------------------------------------------------------------------

# DeepSeek Agent Prompt

You are the senior software architect and implementation engineer for
Medicology.

Repository: https://github.com/kumail1293/Medicology-V1

Read `PLAN.md` before changing code.

## Non-negotiable rules

1.  Audit before editing.
2.  Do not rewrite the application.
3.  Do not replace the current React/Vite/Express/Drizzle architecture.
4.  Do not create duplicate schemas or competing taxonomy systems.
5.  Do not remove working functionality.
6.  Do not claim a feature is complete merely because a
    schema/table/component exists.
7.  Preserve existing data.
8.  Create migrations for schema changes.
9.  Enforce security server-side.
10. Run tests, typecheck and build before completion.

## First task

Inspect:

-   database schemas and migrations
-   API routes
-   frontend pages/components
-   authentication/authorization
-   QBank logic
-   question import
-   taxonomy
-   question versioning
-   audit logs
-   Test Builder
-   exam/session functionality
-   tests

Create an internal matrix:

`Feature | Existing | Partial | Missing | Files | Required Change`

Then implement **P0 only**.

## P0 requirements

### 1. Database-driven QBanks

Replace hard-coded QBank catalogue entries with database-driven
products.

### 2. Many-to-many questions/QBanks

Implement:

`questions ↔ qbank_questions ↔ qbanks`

### 3. Taxonomy

Use existing relational taxonomy:

`Country → Exam System → Exam → Program → Academic Year → Subject → System → Topic → Subtopic`

### 4. QID

Keep immutable public QIDs. Preserve supplied QIDs, generate missing
ones and detect conflicts.

### 5. Versioning/audit

Preserve existing versioning and audit architecture. Enforce the
question review lifecycle.

### 6. Import

Implement:

`upload → map → validate → preview → duplicate check → taxonomy resolution → QID generation → error report → import → review → publish`

### 7. Duplicate detection

Detect QID, normalized text and likely semantic duplicates. Never
silently overwrite.

### 8. Entitlements

Create/use a proper server-side entitlement model.

### 9. Payment

Never trust `POST /purchase` or equivalent frontend assertions to grant
access. Use provider abstraction, verification, webhook validation and
idempotency.

### 10. Coming Soon

Database-driven status and Notify Me/waitlist.

## Coding discipline

After each major subsection:

1.  inspect diff
2.  run relevant tests
3.  typecheck
4.  validate migration
5.  continue

Do not make giant speculative changes.

If a safe implementation cannot be completed, stop and explain the
blocker rather than creating a fake implementation.

## Final report

Return:

1.  Implemented
2.  Partially implemented
3.  Not implemented
4.  Files changed
5.  Database migrations
6.  API changes
7.  UI changes
8.  Security fixes
9.  Tests executed
10. Build result
11. Remaining risks
12. Recommended next step

Start with the audit and then implement P0.
