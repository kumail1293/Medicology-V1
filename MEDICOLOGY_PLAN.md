# Medicology V1 — Production Roadmap

## Objective

Turn the existing Medicology-V1 repository into a production-grade,
database-driven medical examination platform without rewriting the
existing stack.

The platform roadmap is:

-   Pakistan: UHS, KMU, KEMU, SZABMU, NUMS, DUHS and other
    universities/boards
-   Programs: MBBS, BDS, DPT / Pharmacy / Allied Health where appropriate
-   Professional exams: FCPS, JCAT, PGET, NLE
-   Later (after the core architecture is stable): USMLE, PLAB, AMC,
    MRCP, MRCS, DHA, HAAD, Prometric and other licensing exams

Core hierarchy:

`Country → Exam System → Exam/University/Board → Program → Academic Year/Part → Subject → System → Topic → Subtopic → Question`

Every question has an immutable public QID and may belong to multiple
QBanks.

Architecture must be: DATABASE-DRIVEN · CONFIGURATION-DRIVEN ·
TAXONOMY-DRIVEN · EXAM-SCOPED · QBANK-SCOPED · AUDITABLE · SECURE ·
EXTENSIBLE · MOBILE-FIRST · PRODUCTION-READY.

Do NOT hard-code platform behavior into React components when the
behavior should be configurable.

## Status Legend

-   `[COMPLETED]` — implemented, tested and verified working.
-   `[PARTIAL]` — core exists; gaps remain (enumerated).
-   `[IN PROGRESS]` — actively being built.
-   `[PLANNED]` — specified, not started.
-   `[BLOCKED]` — waiting on a dependency.

## System Audit (latest pass)

Verified against the repository (schema, migrations, routes, middleware,
tests) — see commit history for the audit trail:

| Area | Status | Notes |
|---|---|---|
| Taxonomy | `[COMPLETED]` | Country → Exam → Program → Year → Subject → System → Topic → Subtopic; admin UI; no hard-coded universities |
| QID system | `[COMPLETED]` | Immutable, sequential, deterministic; collision + duplicate detection; version history; audit |
| Import engine | `[COMPLETED]` | XLSX/CSV/TSV, per-type templates, preview, type-aware validation, taxonomy mapping, duplicate + QID conflict detection, review-gated execution |
| Question review | `[COMPLETED]` | draft → pending_review → approved → published → archived; reviewer identity; versions; audit |
| QBank architecture | `[COMPLETED]` | DB-driven catalogue with price/currency/duration/status/access rules/question mapping/trial |
| Entitlements | `[COMPLETED]` | purchase → grant (idempotent) → expiry/revocation; server-side enforcement |
| Payments | `[COMPLETED]` | server-side pricing, orders, provider adapters, idempotency keys, webhooks |
| Waitlist / Coming Soon | `[COMPLETED]` | Notify Me with dedupe, demand counts, admin visibility |
| Flashcards | `[COMPLETED]` | DB-driven decks + cards, admin deck builder |
| Rich content | `[COMPLETED]` | TipTap editor (tables, images, links, formatting) + `sanitizeRichHtml` on save |
| Media library | `[COMPLETED]` | upload validation (MIME/size/dimensions), categories, search, MediaPicker, audit |
| Settings engine | `[COMPLETED]` (foundation) | `app_settings` table, zod validation, admin UI, public/private endpoints |
| Scoped overrides | `[COMPLETED]` | deterministic precedence (safety → qbank → … → country → default) + provenance |
| Feature flags | `[COMPLETED]` | DB-backed flags + server-side enforcement |
| Maintenance mode | `[COMPLETED]` | server-side 503 + admin bypass + premium page |
| Announcements + templates | `[COMPLETED]` | types, scheduling, targeting, templates, animations |
| Audit logging + viewer | `[COMPLETED]` | actor, action, entity, old/new diff, IP; secrets never logged; Admin → Audit Logs viewer with filters + diff |
| Granular RBAC | `[COMPLETED]` | role → permission matrix, `requirePermission` on sensitive routes, permission-aware nav |
| Configuration registry (per-key metadata) | `[COMPLETED]` | per-key metadata (group/type/default/validation/scopes/public/audit) + `/admin/settings/registry` |
| Email infrastructure + template builder | `[COMPLETED]` | SMTP/log mailer, secret-safe storage, DB templates with versions, visual block builder, device preview, test-send, send logs |
| Account configuration | `[COMPLETED]` | profile, password, sessions (track/revoke/revoke-all, middleware-enforced), login history, notification prefs, data export, deletion |
| Registration enforcement audit | `[COMPLETED]` | open/closed, allowed domains, invite-only, password policy — enforced server-side on register |
| SEO / footer-social groups | `[COMPLETED]` | dedicated groups, public exposure, applied via `usePlatformConfig` (SEO meta + footer/socials) |
| Audit viewer / settings import-export / command center | `[COMPLETED]` | Admin Audit Logs page; settings export (secrets stripped) + validated import with diff preview; admin Ctrl+K palette |

Database migrations (all additive, backward compatible):

`0000` QBank/entitlements/waitlist · `0001` performance indexes ·
`0002` flashcard decks+cards · `0003` app_settings · `0004` question
types + structured explanations · `0005` announcement templates ·
`0006` media library · `0007` settings overrides · `0008` coming soon ·
`0009` email templates + logs · `0010` user sessions + notification prefs.

Tests: 36 integration tests (settings precedence, overrides, imports,
media, coming soon, RBAC, email templates/renderer/secret handling,
sessions/revocation, export/import, audit gating), backend + frontend
typecheck, production build, 12-check browser QA — all green.

------------------------------------------------------------------------

# Phase P0 — Foundation & Production Hardening

## P0.1 Taxonomy `[COMPLETED]`

`Country → Exam System → Exam/University/Board → Program → Academic Year/Part → Subject → System → Topic → Subtopic`

-   All entities are DB tables with relational FKs and admin CRUD.
-   New universities/exams/boards require data, not schema rewrites.
-   Seed data covers UHS/KMU/KEMU/SZABMU/NUMS etc. for dev.

## P0.2 QID system `[COMPLETED]`

-   Immutable public QID (`QID-MED-###########`); never silently changes.
-   Deterministic sequential generation; collision detection against DB
    and within-file; duplicate detection on import.
-   `question_versions` + audit trail for every change.

## P0.3 QBank architecture `[COMPLETED]`

-   DB-driven catalogue (title, slug, description, exam/program/year/
    subject/topic/subtopic, price, currency, duration, status, access
    rules, question mapping, question count, free trial, coming-soon).
-   `questions ↔ qbank_questions ↔ qbanks` many-to-many.

## P0.4 Import engine `[COMPLETED]`

-   XLSX/CSV/TSV upload → parse → validate → preview → duplicate
    detection → taxonomy resolution → QID generation → error report →
    review-gated import.
-   Per-type templates (SBA, Best-of-five, True/False, Assertion/Reason,
    EMQ, Image-based, Vignette, Case) with a Guide sheet.
-   Per-row editing with the full question editor before import.
-   Never auto-publish; imports land in the Review Queue.

## P0.5 Review & versioning `[COMPLETED]`

-   Lifecycle: `draft → pending_review → medical_review → approved → published`, plus `flagged | errata | archived`.
-   Reviewer identity, version history, audit log, safe rollback,
    immutable QID.

## P0.6 Entitlements `[COMPLETED]`

-   `user → entitlement → QBank`; purchase → activation → expiry →
    revocation; idempotent grants.
-   Server-side access enforcement on practice/exam/session routes —
    frontend entitlement state is never trusted.

## P0.7 Payments `[COMPLETED]`

-   Server-side pricing → order → provider adapter → verification/
    webhook → entitlement.
-   Idempotency keys and replay protection; provider-agnostic adapters.

## P0.8 Waitlist / Coming Soon `[COMPLETED]`

-   `coming_soon` catalogue (exams/QBanks/features/programs/resources) +
    interest tracking; Notify Me deduplicated per account/email; admin
    demand counts; public dashboard section.

## P0.9 Rich content `[COMPLETED]`

-   TipTap everywhere content is written (questions, explanations,
    flashcards, announcements): tables, images, links, formatting.
-   `sanitizeRichHtml` on save; media picker for images.

## P0.10 Flashcards `[COMPLETED]`

-   DB-driven decks + cards, admin deck builder, spaced-repetition
    foundation.

## P0.11 Media library `[COMPLETED]`

-   Upload validation (MIME whitelist, size cap, dimension parsing),
    categories, search, alt text, copy URL, replace, delete with usage
    awareness, audit; shared `MediaPicker` in the rich editor.

## P0.12 Settings engine + configuration registry `[PARTIAL]`

Foundation `[COMPLETED]`:

-   `app_settings` (JSONB), zod-validated group schemas, admin UI with
    sections (general, branding, content, registration, notifications,
    security, payments, storage, integrations, feature flags, animations,
    bulk import, exam/QBank defaults), public endpoint
    (`/api/settings/public`), history + restore.

Configuration registry `[IN PROGRESS]` (Phase 1):

-   Per-setting metadata: `key, group, type, defaultValue, description,
    validationSchema, scopes, public, editableBy, requiresAudit,
    deprecated, dependencies`.
-   Supported types: string, integer, decimal, boolean, enum, JSON,
    color, URL, duration, percentage, rich text, image, file, array,
    object.
-   Registry-driven validation and admin rendering (no arbitrary unsafe
    values).

## P0.13 Scoped overrides `[COMPLETED]`

-   Deterministic precedence preserved:
    `SAFETY CONSTRAINTS > QBank > Topic > System > Subject > Year > Program > Exam > Country > Platform default`.
-   Every resolved key exposes provenance (which scope supplied it);
    safety keys (maintenance mode, MFA, payment provider) can never be
    overridden.
-   Admin UI: scoped override editor with provenance badges + Inherit.

## P0.14 Branding `[PARTIAL]`

-   Branding group exists (name, tagline, colors, logos) and design
    tokens flow to the UI.
-   Remaining (Phase 4): full color system (12 tokens), typography
    controls, component styles (radius/shadow/button/card), favicon/OG
    image upload, and a live branding preview panel.

## P0.15 Email infrastructure `[PLANNED]`

-   SMTP/provider configuration, sender/reply-to, domain, footer,
    unsubscribe, tracking, test email, queue, delivery status, retry
    policy.
-   Secrets encrypted and never returned to the UI.

## P0.16 Email template builder `[PLANNED]`

-   DB-driven templates (welcome, verification, password reset, purchase,
    entitlement events, waitlist, results, announcements, security,
    custom) with subject/preheader/body/version/audience/language.
-   Visual drag-and-drop block editor with desktop/tablet/mobile preview;
    sanitized HTML output; variable picker with validation; draft/
    published/archived + version compare/restore.

## P0.17 Announcement builder `[COMPLETED]`

-   Types: banner, alert, popup, modal, toast, dashboard card, exam
    notice, QBank launch, maintenance, promotional.
-   Scheduling, targeting (roles/audience), dismissible/once/session/
    repeat, animations that respect `prefers-reduced-motion`.
-   Reusable, admin-editable templates.

## P0.18 Feature flags `[COMPLETED]`

-   DB-backed flags (flashcards, daily challenge, study buddies, notes,
    bookmarks, analytics, AI features, mock exams, custom exams,
    certificates, notifications, social) with server-side enforcement.
-   Scope-aware (platform/country/exam/program/university/year/subject/
    qbank/user) via the overrides engine; audited.

## P0.19 Account configuration `[PLANNED]`

-   Student-facing: profile, security, password, email, sessions,
    devices, notifications, appearance, language, study/exam
    preferences, privacy, data export, account deletion.
-   Security: active sessions, revoke, login history, suspicious-login
    notifications. Never expose sensitive auth data.

## P0.20 Registration controls `[PARTIAL]`

-   Settings exist (enabled, email verification, allowed domains,
    password policy, invite-only, maintenance restrictions).
-   Remaining: complete server-side enforcement of every rule +
    student verification + duplicate-account policy.

## P0.21 Maintenance mode `[COMPLETED]`

-   Server-side 503 for non-exempt routes with admin bypass; premium
    maintenance page; configurable title/message/image/ETA/support
    contact.

## P0.22 Notification configuration `[PARTIAL]`

-   Settings group exists (in-app/email defaults).
-   Remaining (Phase 21): per-user notification preferences, event →
    channel routing, future push/SMS.

## P0.23 SEO `[PARTIAL]`

-   Title/description/OG basics in the general group.
-   Remaining (Phase 22): dedicated SEO group (OG image, Twitter cards,
    robots, canonical, structured data) with safe injection rules.

## P0.24 Audit & security `[PARTIAL]`

-   Audit logging `[COMPLETED]` (actor, entity, diff, IP; secrets never
    logged).
-   Remaining: admin audit viewer (filters: date/actor/entity/action/
    scope), configuration history UI with diff + restore, and a formal
    security audit pass (Phase 27).

## P0.25 Testing `[PARTIAL]`

-   27 integration tests + typechecks + build `[COMPLETED]`.
-   Remaining (Phase 30): settings resolver unit tests, email variables,
    template versioning, announcement targeting, payment idempotency
    replay, import edge cases, security-sensitive behavior.

## P0.26 Production hardening `[PARTIAL]`

-   Rate limiting, CORS, parameter validation, mock-DB compatibility,
    migrations `[COMPLETED]`.
-   Remaining: secrets management, real PostgreSQL CI, observability,
    caching, CDN, backups (Phases P13).

------------------------------------------------------------------------

# Phase P1 — Medical Exam Engine

## P1.1 Question types + structured explanations `[COMPLETED]`

-   question_type (sba, best_of_five, true_false, assertion_reason, emq,
    image_based, clinical_vignette, case_based) + why_correct, why_wrong,
    exam_pearl, common_trap; type-aware rendering and import validation.

## P1.2 Confidence tracking `[COMPLETED]`

-   Per-question confidence ratings feeding analytics.

## P1.3 Exam engine core `[IN PROGRESS]`

-   Exam definitions + templates, university/year-specific rules,
    subject/topic selection, custom + timed + mock exams, negative
    marking, pass/fail, review, navigation, question palette,
    pause/resume, autosave, result generation + analytics, attempt
    history.
-   Session creation already resolves scoped rules (duration, count)
    from the overrides engine; explicit client values win.
-   Universities are data, never hard-coded: `[PLANNED]` UHS, KMU,
    KEMU, SZABMU, NUMS, FCPS, JCAT, PGET profiles on top of the engine.

------------------------------------------------------------------------

# Phase P2 — Student Learning Platform `[PLANNED]`

Dashboard · progress · weak areas · bookmarks · notes · flashcards ·
spaced repetition · daily challenge · study plans · streaks · goals ·
revision planner · performance analytics · personalized recommendations.

Foundations shipped (dashboard, bookmarks, notes, daily challenge,
flashcards, progress, streaks).

------------------------------------------------------------------------

# Phase P3 — Medical Question Intelligence `[PLANNED]`

Question quality metrics · difficulty/discrimination · topic performance
· cohort analytics · item analysis · duplicate similarity · question
health · flawed-question reporting · reviewer analytics.

------------------------------------------------------------------------

# Phase P4 — Advanced Analytics `[PLANNED]`

Student: accuracy, speed, completion, retention, weak topics,
improvement, percentile. Admin: question/QBank performance, revenue,
conversion, entitlement, retention, exam performance, content quality.

------------------------------------------------------------------------

# Phase P5 — Content & Curriculum Platform `[PLANNED]`

Curriculum builder · university curriculum mapping · subject/topic
mapping · learning objectives · resources · notes · lectures ·
references · flashcards · revision content.

------------------------------------------------------------------------

# Phase P6 — Commercial Platform `[PLANNED]`

Subscriptions · bundles · coupons · discounts · promotions · invoices ·
refunds · affiliate/referrals · institutional licensing · university
partnerships.

------------------------------------------------------------------------

# Phase P7 — Communication Platform `[PLANNED]`

Email · in-app notifications · push · announcements · campaigns ·
segmentation · automated journeys. (Depends on P0.15/P0.16/P0.22.)

------------------------------------------------------------------------

# Phase P8 — AI Medical Learning Layer `[PLANNED] (future only)`

AI explanations · AI tutor · question generation · question validation ·
semantic search · personalized study plans · adaptive testing.

AI output must never silently replace reviewed medical content.

------------------------------------------------------------------------

# Phase P9 — Mobile / PWA `[PLANNED]`

Installable PWA · offline mode · local question caching · sync · push
notifications · mobile exam UX.

------------------------------------------------------------------------

# Phase P10 — Internationalization `[PLANNED]`

Languages · country configuration · localization · currencies ·
date/time · regional exam rules.

------------------------------------------------------------------------

# Phase P11 — International Exams `[PLANNED]`

USMLE, PLAB, AMC, MRCP, MRCS, DHA, Prometric — build only after the core
architecture is stable.

------------------------------------------------------------------------

# Phase P12 — Institutional / Enterprise `[PLANNED]`

Institutions · organizations · universities · institutional admins ·
licenses · cohorts · institution analytics · SSO readiness.

------------------------------------------------------------------------

# Phase P13 — Scale / Infrastructure `[PLANNED]`

Observability · logging · metrics · tracing · caching · queues · CDN ·
backups · disaster recovery · security monitoring · rate limiting ·
horizontal scaling.

------------------------------------------------------------------------

# Architecture Rules

1.  Inspect before modifying.
2.  Reuse existing architecture; do not duplicate systems.
3.  Do not break or remove working functionality without justification.
4.  Keep migrations backward compatible.
5.  Never hard-code configurable platform behavior.
6.  Never trust frontend authorization, pricing, entitlement, exam
    rules, or feature flags — all security-sensitive rules are
    server-side.
7.  Never expose secrets (DB URLs, API keys, SMTP credentials, signing
    keys, tokens).
8.  Sanitize rich content (TipTap) before persistence.
9.  Test every security-sensitive feature.
10. Keep the mock DB behaving like production (settings, users, QBanks,
    questions, templates, announcements, media, flashcards,
    entitlements, audit logs).
11. Keep TypeScript strict; avoid `any`/unsafe casts unless justified.
12. Keep API contracts synchronized; update generated clients when
    contracts change.
13. Update documentation (README, MEDICOLOGY_PLAN,
    MEDICOLOGY_ADMIN_SETTINGS_PLAN) for every major change.

## Product principles

Everything connects through:

`USER → ACCOUNT → EXAM PROFILE → TAXONOMY → QBANK → QUESTION → SESSION → ATTEMPT → RESULT → ANALYTICS → PERSONALIZED LEARNING`

and

`PLATFORM SETTINGS → SCOPED SETTINGS → EFFECTIVE CONFIGURATION → FEATURES / EXAM / QBANK / EMAIL / NOTIFICATIONS / UI`

Medicology must never become a collection of disconnected features.

## UI quality bar

The admin experience must feel like a premium SaaS product (WordPress,
Elementor, Webflow, Stripe Dashboard). Use cards, tabs, grouped
sections, side navigation, command/search, live previews, inline
editing, drawers, modals, responsive tables, empty states, skeletons,
confirmation dialogs, contextual help, status badges, validation
indicators. Respect `prefers-reduced-motion`. Avoid excessive gradients,
random shadows, and animation everywhere.

Visual builders (email, announcement, template) follow the
`LEFT blocks / CENTER canvas / RIGHT properties / TOP save-preview-publish` layout.

## Recommended execution order

1.  Audit + plan sync (this document).
2.  Phase 1 — Configuration Registry (metadata over settings).
3.  Phase P0.15/P0.16 — Email infrastructure + template builder.
4.  Phase P0.19/P0.20 — Account configuration + registration controls.
5.  Phase P0.23 — SEO group.
6.  Phase P0.24 — Audit viewer + config history UI.
7.  Phase P1.3 — Exam engine completion.
8.  Phases P2+ per roadmap.
