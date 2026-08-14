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

------------------------------------------------------------------------

# Phase P1 --- Examination Engine

After P0:

-   formal question types: SBA, MCQ, EMQ, True/False, Assertion/Reason,
    Image-based, Clinical Vignette, Case-based, Best-of-five
-   image questions: ECG, X-ray, CT, MRI, histopathology, anatomy,
    ophthalmology, dentistry
-   structured explanations: correct answer, why, why-not, exam pearl,
    common trap, references
-   full exam simulator with timer, palette, autosave, flags, sections,
    marking scheme
-   database-driven Custom Test Builder
-   confidence tracking: Guess / Unsure / Fairly Confident / Very
    Confident
-   mastery engine by question/subtopic/topic/system/subject/QBank/exam
-   spaced repetition

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
