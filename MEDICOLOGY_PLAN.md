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

### Full-app audit — Aug 2026 (user + admin sides)

Walked every user nav page and every admin page in the browser (36
pages) and cross-checked every frontend API call against the backend
routes. **Result: zero failing requests across all 36 pages, zero console
errors.** What was found and fixed:

-   **`/api/daily/challenge` did not exist** — the Daily Challenge page
    (via the generated client) 404'd. Backend only had `/api/daily/` +
    `/status` with a different shape. Added the `/challenge` route
    returning the client-expected `{ questions, date, isCompleted,
    streak }` with real streak computation from challenge history.
-   **`/api/progress/topics` did not exist** — the Analytics Topic
    Mastery Heat Map 404'd (marked `TODO` in the page). Implemented the
    endpoint: aggregates `user_progress` per question subject/topic into
    `{ subject, topic, attempted, correct, accuracy }` rows.
-   **`/api/cases` had zero backend** — Clinical Cases is a full
    progressive-disclosure UI but nothing served it. Added `clinical_cases`
    + `case_completions` tables (migration `0017`), `GET /api/cases` with
    system/difficulty/examType filters, `POST /api/cases/:id/complete`
    (idempotent, server-recorded), and 8 realistic seeded cases
    (cardiology, GI, neuro, resp, endocrine, paeds, diabetes).
-   **`/api/leaderboard` had zero backend** — Leaderboard 404'd.
    Implemented `GET /api/leaderboard` with all / university / subject
    filters, ranked by accuracy (tie-broken by questions solved +
    reward points).
-   **Duplicate admin route** — `/admin-dashboard` was a second entry
    point to the same page as `/admin`; removed (single canonical `/admin`).
-   **Fake admin dashboard data** — Recent Activity was hard-coded
    ("John Doe…") and System Health showed everything "online" with
    invented latencies. Now: Recent Activity reads real audit logs,
    System Health probes `/api/healthz` (latency), storage, and email
    configuration live; the fake trend percentages were removed.
-   **SaaS-style admin navigation** — the flat admin sidebar is now
    grouped into sections (Overview / Content / Users & Access /
    Communication / Platform / System) with a filter box, and the
    Settings page nav is grouped into categories (General / Design /
    Content & Exams / Users & Commerce / Communication / Platform /
    System) with a **"Search settings…"** box that filters groups live.

### Student page polish pass 2 — Aug 2026 (Study Planner, Achievements, Buddies)

-   **Study Planner** — added a **Next 7 Days** strip (compact per-day cards
    with subject, question target, completion check), **week progress**
    (`X/7 done` in the week-view header), a **Reset Plan** action with
    inline confirm, and loading/error notices while analytics fetch (schedule
    gracefully falls back to balanced subject weights when analytics fail).
-   **Achievements** — skeleton grid while loading (instead of a pulsing
    text line), a **full error state with Try Again** (the old code had no
    catch — a failed fetch left the page hung), a **Current Streak** stat
    card, and a **Next Achievement** hint with a progress bar toward the
    closest locked achievement (visible even at 0% for new users).
-   **Study Buddies** — skeleton cards while loading, an **error state with
    Try Again** (the old code showed a misleading "No buddies yet" when the
    API failed), a stats header (buddy + pending-request counts), a confirm
    before removing a buddy / declining a request, and error toasts on
    failure. **Fixed a real bug**: Remove used `buddy.id` (the user id) but
    the DELETE endpoint expects the relationship id (`buddy.buddyId`) —
    removals were deleting the wrong row or silently failing. **Hardened the
    backend**: `DELETE /api/buddies/:id` now verifies the caller is a party
    to the relationship (403 otherwise) instead of letting any authenticated
    user delete any relationship.

### Student page polish pass — Aug 2026 (Notes Library, Review Hub, Dashboard)

-   **Notes Library was UI-only** — the page called `/api/notes` (per-question
    personal notes) expecting `title/subject/content/tags`, and its bookmark
    route didn't exist. Built the real backend: `study_notes` +
    `study_note_bookmarks` tables (migration `0018`), student
    `GET /api/study-notes` (published only, subject/search filters, featured
    first, per-user `bookmarked` flag) + `POST /api/study-notes/:id/bookmark`
    toggle, and admin CRUD at `/api/admin/study-notes` (audited, permission
    gated). Seeded 12 realistic faculty-style notes (cardiac AP, UMN/LMN,
    antibiotics, cranial nerves, LFTs, acid-base, gram staining, immunity,
    diabetes, vitamins, chest pain, renal). The page now reads real data,
    bookmarks persist server-side, and the subject dropdown derives from live
    taxonomy subjects.
-   **New Admin → Notes Library manager** (`/admin/notes`) — stats header,
    status filter chips, search, table with featured/status quick toggles,
    and a create/edit modal with markdown content + auto-slug.
-   **Review Hub** — tab bar now shows live counts, each list (bookmarks,
    wrong, notes) has a search box with a "no matches" state, and notes can
    be deleted. Fixed `GET /api/practice/wrong` (the Wrong Qs tab 404'd —
    endpoint didn't exist): returns latest-attempt wrong questions with
    subject/topic/limit filters. Also fixed a contract mismatch where the
    generated client sent `noteText` but the notes PUT handler only read
    `text` (saves silently stored nothing); it now accepts both.
-   **Dashboard** — stat cards and the Exam Readiness ring show skeleton
    loaders while analytics fetch instead of raw zeros.

### Notes upgrade — rich rendering, share-as-PNG & branded PDF (Aug 2026)

Notes are no longer a raw markdown dump — they now render like a
reference page (Amboss/UWorld/Osmosis style) and export as branded
assets for social sharing.

-   **Rich markdown renderer** (`MarkdownNote`) — new `react-markdown` +
    `remark-gfm` pipeline with textbook typography: GFM tables in styled
    cards, **callout cards** for blockquotes that open with a marker word
    or emoji (`💡 Tip`, `🧠 Mnemonic`, `⚠️ Trap`, `📌 High-Yield`,
    `🩺 Clinical Pearl`, `🔴 Warning`), ` ```mermaid ` fenced blocks
    rendered as live diagrams (lazy-loaded `mermaid`, themed to
    light/dark, static under `prefers-reduced-motion`), lazy images with
    captions, task-list checkboxes, and slug-anchored h2/h3 headings.
-   **Student reading view** — sticky header with bookmark / share /
    PDF / practice actions, a reading-progress bar, a side table of
    contents (auto-extracted, click-to-scroll), reading-time estimate,
    and the bottom "Practice related MCQs" CTA.
-   **Share as PNG** — share modal with platform presets sized per
    network (Instagram Post 1080×1350, Instagram Story 1080×1920,
    X/Twitter 1200×675, Facebook 1200×630, LinkedIn 1200×627, Square
    1080×1080) and a live preview. The card is a branded design (brand
    gradient, logo chip, subject chip, title, excerpt, tags, handles
    from settings — `@medicologyworld`, `medicology.net`) rasterized
    with `html-to-image` at exact pixel dimensions.
-   **Download PDF** — opens a dedicated print window with a light,
    branded layout (logo + brand + title header, domain / email /
    social-handles footer, `@page` margins, print-safe tables/callouts/
    diagrams) — identical output in light and dark app themes. Uses a
    separate window so the app-wide print-protection (exam security)
    is untouched.
-   **Admin Notes editor** — Write/Preview tabs (live render of the
    same component students see), a snippet palette that inserts markdown
    blocks at the cursor (table, tip/mnemonic/trap/high-yield callouts,
    mermaid diagram, checklist, divider) and an image picker wired to the
    Media Library (`MediaPicker`).
-   **Content** — 4 new high-yield notes (Hemostasis & the coagulation
    cascade, RAAS pathway + drug targets, Heart Failure HFrEF/HFpEF
    algorithm, Bugs & Drugs coverage) and 3 retrofits (Acid-Base,
    Gram Stain, Chest Pain) now include mermaid flowcharts and structured
    mnemonics/traps — 16 seeded notes total.
-   New deps (frontend): `react-markdown`, `remark-gfm`, `mermaid`
    (lazy chunk), `html-to-image`. New unit + component tests: callout
    classification, heading extraction, excerpts, presets, and rendered
    callouts/tables/checklists/anchors. Browser-verified end to end:
    reading view (4 callouts, table, mermaid SVG, TOC), both PNG
    exports, and the branded PDF window — zero console errors besides
    benign Google-Fonts CORS noise during headless PNG font-embedding.

### Notes reading-view overlap fix — animation stacking-context trap (Aug 2026)

Reported: the app sidebar (z-40) painted **over** the notes reading view,
hiding the left portion of the reader. Root-caused with browser probes
(`elementsFromPoint` + computed-style chains):

-   The page wrapper in `AppLayout` carries the `anim` class, which runs
    the platform-configured CSS mount animation with
    `animation-fill-mode: both`. For every effect except `fade`
    (slide/scale/zoom/bounce) the final keyframe is a non-`none`
    `transform` (`translateY(0)` / `scale(1)`), and `both` retains it
    forever. A retained transform makes that wrapper a **containing block
    for `position: fixed` descendants** and a stacking context — so the
    reader's `fixed inset-0 z-50` resolved against the wrapper's box
    (inside `main`, starting at x=270) instead of the viewport, and its
    z-index lost to the sidebar in the root stacking context.
-   Fix 1 (systemic): `animation-fill-mode` changed `both` → `backwards`
    on `.anim`. Every effect's end keyframe equals the element's natural
    state (opacity 1, no transform), so there is zero visual difference
    after the animation — but no retained transform, so no trap for *any*
    fixed overlay under *any* effect. (Also strictly better for
    marquee/typewriter, which settle at their natural state.)
-   Fix 2 (guarantee): the notes reading view is now rendered through a
    React portal to `document.body`, so it always resolves against the
    viewport regardless of wrappers.
-   Verified in-browser with `anim-effect-slide` forced: overlay rect now
    covers the full viewport (x:0, w:1280) and wins the hit test over the
    sidebar (previously x:270 / sidebar span won). Regression: 72/72 API,
    105/105 frontend, typecheck + production build clean.

### Notes feature pack — math, MedPedia hub, share excerpts, server export & block editor (Aug 2026)

Five connected upgrades to the study-notes system:

-   **Math in notes (KaTeX)** — `remark-math` + `rehype-katex` in the
    `MarkdownNote` pipeline; `$inline$` and `$$display$$` LaTeX render in the
    reader, the admin preview, the block editor and the PDF export (KaTeX CDN
    stylesheet injected into the print window when the note contains math).
    Seed notes now carry real formulas (anion gap, Winter's formula, GFR /
    clearance, filtration fraction, Starling forces).
-   **Notes Hub (MedPedia)** — the `/notes` landing is now a wiki-style
    knowledge base: gradient hero with instant search + live stats (notes /
    subjects / total reading time), subject quick-nav chips with counts and
    color dots, a Featured row, a Recently-updated list, and the full
    filterable grid below. Pure client-side aggregation over the existing
    published-notes API.
-   **Custom share excerpts** — selecting text inside the reader raises a
    floating "Share selection / Copy" bar; "Share selection" opens the share
    modal in custom-excerpt mode (your passage, not the auto-derived
    excerpt) and rasterizes it at the chosen platform size; Copy is a
    one-click clipboard action.
-   **Server-side export** — `GET /api/study-notes/:id/export?format=html|html-preview|md`
    (authenticated; published notes for students, any status for admins).
    The server renders the note with `marked` (GFM) + `katex.renderToString`
    into a branded, self-contained HTML document (site name/logo/socials from
    platform settings, mermaid hydrated from CDN, print-ready `@page` CSS) —
    the reader's Export menu offers "Open web version", "Download markdown",
    and the existing client-side branded PDF. Content is HTML-escaped before
    rendering and `javascript:` hrefs are neutralized (XSS tests included).
-   **Canva-style admin editor** — the admin note editor is now a visual
    block editor (`NoteBlockEditor`) with a markdown ⇄ block model
    (`note-blocks.ts`, lossless round-trip): drag-to-reorder cards with
    move/duplicate/delete, an add-block palette (heading, paragraph, list,
    checklist, callout with tone picker, table, mermaid, math with live
    KaTeX preview, image with Media Library upload, divider, code), a
    live student preview pane, a raw-markdown Source tab, and a mermaid
    **connector builder** that edits flowchart nodes/edges (id, label,
    shape, edge labels) visually and regenerates the source.
-   New deps: frontend `katex`, `remark-math`, `rehype-katex`; API `marked`,
    `katex`. New tests: 21 frontend (KaTeX rendering, block parse/serialize
    round-trip, flowchart builder, editor helpers) + 2 API (export contract,
    HTML escaping / href sanitization). Browser-verified end to end with zero
    console errors.

### Full-app walkthrough & link audit — Aug 2026

Automated browser walkthrough of every page on both sides (35 admin
routes + 19 student routes + public login/register), with console-error,
failed-request and broken-link capture. Findings fixed:

-   **`/api/questions/filters` 404** — the generated client calls
    `/filters` but the backend only served `/meta/filters` (and the
    `/:id` route swallowed it). Now served at both paths, declared before
    `/:id`.
-   **Dead footer links** — settings defaults pointed Support/Privacy/
    Terms/Refunds at non-existent internal routes (`/support`, `/privacy`
    ...). Defaults now point to real destinations
    (`mailto:admin@medicology.net`, medicology.net pages) so they are never
    dead links.
-   **Seeded promo announcement CTA → `/premium`** (no route) — now points
    to `/subscription`.
-   **Social handles & icons** — defaults aligned to the real
    `@medicologyworld` handles across all 7 platforms (Instagram, Facebook,
    X, TikTok, YouTube, LinkedIn, WhatsApp); login footer now renders an
    icon for every platform (added TikTok/WhatsApp icon mappings — brand
    icons don't exist in the installed lucide-react version, so Music /
    MessageCircle stand in).

Verified clean after fixes: login (admin + fresh student registration with
captcha) → all pages render, zero console errors, zero failed requests,
zero broken links. Note: admin credentials are the env default
`admin@medicology.net / admin123` (`ADMIN_PASSWORD` is empty in `.env`).

### Admin page polish pass — Aug 2026 (lean pages)

Upgraded the five leanest admin pages to the same quality bar as the
rest of the panel (browser-verified, zero console errors):

-   **Question Flags** — stats header (total / pending / resolved),
    live search, question preview modal, and the backend now joins the
    reporting user's email/name + question text for context.
-   **Audit Logs** — action + entity-type filter dropdowns, CSV export,
    refresh button, pagination range indicator, and a cleaner diff modal
    (before/after per group).
-   **Media Library** — multi-file upload with per-file progress,
    drag-and-drop zone, and a click-to-zoom lightbox preview.
-   **Taxonomy** — per-entity counts, better empty states.
-   **Coming Soon** — category filter chips with counts and a live
    search box (empty state preserved when no items exist).

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
| Granular RBAC | `[COMPLETED]` | **Administration 2.0**: DB-driven account types, roles, permission registry (52 keys / 11 groups), organizations & teams, access scopes, effective-authorization engine (`can()` — roles + account type + direct grants − explicit denials, server-enforced), Role Builder, Account Type manager, Permission Matrix, per-user Effective Access drawer |
| Configuration registry (per-key metadata) | `[COMPLETED]` | per-key metadata (group/type/default/validation/scopes/public/audit) + `/admin/settings/registry` |
| Email infrastructure + template builder | `[COMPLETED]` | SMTP/log mailer, secret-safe storage, DB templates with versions, visual block builder, device preview, test-send, send logs, **transactional sends** + 17 seeded templates; **medicology.net** branding + **@medicologyworld social icons** in every email |
| Account configuration | `[COMPLETED]` | profile, password, sessions (track/revoke/revoke-all, middleware-enforced), login history, notification prefs, data export, deletion |
| Registration enforcement audit | `[COMPLETED]` | open/closed, allowed domains, invite-only, password policy — enforced server-side on register |
| SEO / footer-social groups | `[COMPLETED]` | dedicated groups, public exposure, applied via `usePlatformConfig` (SEO meta + footer/socials) |
| Audit viewer / settings import-export / command center | `[COMPLETED]` | Admin Audit Logs page; settings export (secrets stripped) + validated import with diff preview; admin Ctrl+K palette |

Database migrations (all additive, backward compatible):

`0000` QBank/entitlements/waitlist · `0001` performance indexes ·
`0002` flashcard decks+cards · `0003` app_settings · `0004` question
types + structured explanations · `0005` announcement templates ·
`0006` media library · `0007` settings overrides · `0008` coming soon ·
`0009` email templates + logs · `0010` user sessions + notification
prefs · `0011` entitlement `emailNotifiedAt` (transactional expiry emails) ·
`0012` announcement user targeting (`targetUserIds`) · `0013` user profile
bio/phone · `0014` user study aim (`studyAim` — AMBOSS-style goal) ·
`0015` RBAC (user_types, permissions, roles, role_permissions,
user_roles, user_permissions, organizations, teams, team_members,
user_scopes, role_scopes) + `users.userType` · `0016` flashcard deck
taxonomy · `0017` clinical cases + case completions · `0018` study
notes library (study_notes + study_note_bookmarks).

Tests: 72 API integration tests + 105 frontend tests (settings precedence, overrides, imports,
bulk deck import incl. Anki .apkg with media + per-note-type field
mapping + per-card edit/skip + oversized-execute-payload regression +
previewId/delta execute flow,
spreadsheet grid + bulk save, bulk
review, media, coming soon, RBAC + Administration 2.0 + taxonomy-aware
scope enforcement, email templates/renderer/
secret handling, sessions/revocation, export/import, audit gating,
transactional sends, template seeding, forgot/reset password,
announcement email, study aim + progress reset, announcement user
targeting, purchases shape,
daily challenge shape, topic heat map, leaderboard, clinical cases,
study notes library (list/filters/bookmark toggle per user, admin CRUD
with draft visibility + note DELETE), review-hub wrong questions
(latest attempt wins, filters, limit)),
backend + frontend typecheck, production
build, 36-page browser audit (no failing requests), RBAC pages +
access drawer — all green.

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
-   **Test-creation UX**: `/api/qbanks/my` now returns a `purchases` array
    (catalogueIds derived from slugs) so the create-test wizard unlocks
    purchased QBanks; MBBS banks match per-university prefixes
    (`uhs_mbbs_1st_year` → UHS), and entitlement is enforced server-side
    on session creation (never trust the frontend).

## P0.4 Import engine `[COMPLETED]`

-   XLSX/CSV/TSV upload → parse → validate → preview → duplicate
    detection → taxonomy resolution → QID generation → error report →
    review-gated import.
-   Per-type templates (SBA, Best-of-five, True/False, Assertion/Reason,
    EMQ, Image-based, Vignette, Case) with a Guide sheet.
-   Per-row editing with the full question editor before import.
-   Never auto-publish; imports land in the Review Queue.
-   **Template downloads in `.xlsx` and `format=csv`** (all question
    types, Guide sheet, example rows).
-   **Spreadsheet editor** (`/admin/spreadsheet`): Excel-style inline
    grid over all questions (question text, options A–E, answer,
    subject/system/topic, difficulty, status, explanation), inline cell
    editing, dirty-cell tracking, bulk save with per-row validation,
    version history + audit, per-row full editor, search/status
    filters/pagination.
-   **Bulk review** (admin Review Queue): multi-select rows →
    approve/publish/reject/archive in one action, scope-enforced per
    question, transition-validated, note required for rejection.

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
-   **Decks are taxonomy-orgaized** (country/exam/program/year +
    subject/system/topic/subtopic) — a deck taxonomy separate from the
    MCQ taxonomy (migration `0016`); admin deck modal picks taxonomy
    values.
-   **Admin bulk deck import** (`/admin/flashcards`): xlsx/csv/tsv with
    a deck-metadata block (Deck Name, Exam, Program, Year, Subject…) +
    card rows (Front/Back/Note/Tags/Image), plain Anki `front\tback`
    text, or **full Anki `.apkg` packages** (e.g. AnKing Overhaul for
    Step 1 & 2) — the SQLite collection is parsed (note types, field
    layout, tags, cloze templates preserved), embedded media is
    extracted into the shared media library with `<img>` references
    rewritten to served URLs; **audio + video + fonts are extracted too**
    — Anki `[sound:…]` tags, `<span class="sound">` and `<audio>`/`<source>`
    srcs are rewritten to served `/api/storage/uploads/…` URLs and the
    study session renders them as real `<audio>` players (not stripped);
    **per-note-type field mapping** — the preview surfaces each note
    type's fields (front + multi-select back picker) and a `fieldMap`
    override re-runs the preview so admins can fix wrong auto-guesses
    before importing; **per-card review before import** — the preview
    lists every row (paginated + searchable) with front/back preview,
    inline rich-text editing (front/back/tags), and skip/include
    toggles; skipped rows are excluded from the execute step and edits
    persist into the imported cards; the execute endpoint has its own
    500mb JSON body limit (large decks exceed the global 50mb) and the
    admin UI normalizes backend errors so failures show a readable
    message instead of `[object Object]`; **server-side preview store** —
    the preview endpoint persists the parsed rows keyed by a single-use
    `previewId` and the execute step sends only the small deltas (row
    edits + skipped indices) instead of re-uploading every card's HTML,
    so even multi-GB AnKing decks import without hitting body-size
    limits; preview with per-row validation,
    taxonomy auto-create, duplicate-slug handling (reuses existing
    deck), audit-free card insert with sort order.
-   **Deck template downloads** (`.xlsx` and `format=csv`) with example
    rows + guide for exam-specific decks.
-   **Card image rendering fix**: deck links now render images
    (relative URLs resolved, markdown `![alt](path)` converted) instead
    of the camera-emoji fallback.

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

## Administration 2.0 — Unified Access & Configuration `[IN PROGRESS]`

Database-driven, layered authorization replacing the flat role-string model:

-   **Account types ≠ roles ≠ permissions ≠ scopes** — `user_types` (registration
    policy, default role, admin access) · `roles` (system + custom templates) ·
    `permissions` registry (52 namespaced keys / 11 groups) · `access_scopes`
    (country → exam → program → year → subject → system → topic → qbank).
-   **Effective authorization engine** (`utils/authorization.ts`) — resolved per
    request with deterministic precedence:
    `explicit denials > direct grants > role permissions > account-type default role > legacy/superadmin`.
    A denial always wins; `requireCan()` enforces every admin mutation server-side.
    `hasScope()` / `questionInScope()` support taxonomy-aware scoping with
    full parent inheritance — a country scope covers its exams/programs/years,
    a subject scope covers its systems/topics, and `subtopic` resolves to its
    parent topic. Enforced on the question review route (403 outside scope).
-   **Organizations & teams** — `organizations` (university / exam_authority /
    institution / content_team / publisher / partner) + `teams` + `team_members`
    (user → team → role → scope), seeded with UHS / KMU / CPSP / PMDC.
-   **Admin UI** — `/admin/roles` Role Builder (permission matrix, enable-all,
    duplicate, archive, system-role protection) · `/admin/user-types` Account
    Type manager · `/admin/permissions` Permission Matrix viewer · upgraded
    `/admin/users` with an **Effective Access** drawer (account type, role
    assignment, direct grants/denials, scope builder, resolved permissions with
    provenance). All mutations audited.
-   Seeded identically in mock DB and PostgreSQL (`utils/seed-rbac.ts`, idempotent).
-   **Remaining (next phases):** team-scoped assignment UI, permission preview
    for arbitrary role combos, 2FA readiness, configuration snapshots/import-export
    polish, system health page.
-   **UI/UX bug-fix pass:** removed the duplicate "Admin Panel" nav item;
    removed the legacy raw-HTML announcement renderer from the student layout
    (announcements now render exclusively through `AnnouncementDisplay` with
    sanitized RichText); admin announcement/template previews use
    `richTextToPlain`; wired the admin dashboard Quick Actions to their real
    pages; corrected stale `medicology.pk` → `medicology.net` share links.

## P0.14 Branding `[PARTIAL]`

-   Branding group exists (name, tagline, colors, logos) and design
    tokens flow to the UI.
-   Remaining (Phase 4): full color system (12 tokens), typography
    controls, component styles (radius/shadow/button/card), favicon/OG
    image upload, and a live branding preview panel.

## P0.15 Email infrastructure `[COMPLETED]`

-   SMTP/log provider configuration, sender/reply-to, footer,
    unsubscribe, tracking, retry policy, test email.
-   SMTP password stored under a secret key, never returned by the API
    (only an `smtpPasswordSet` flag) — no secrets in the UI.
-   Mailer (`mailer.ts`) reads effective settings + secret; `email_logs`
    records every send (template, recipient, status, provider response).
-   **Transactional sends wired** (best-effort, non-blocking queue):
    welcome + verification on register, forgot/reset password (new
    endpoints), purchase confirmation on payment, entitlement expiring /
    expired sweeper (hourly + on-boot), announcement → email broadcast.
-   **17 seeded templates** (`seed-email-templates.ts`) covering every
    scenario; Admin → Email Templates → Restore defaults re-seeds.
-   **Branding**: domain/emails use `medicology.net`; every email carries a
    brand-icon social row (Instagram / Facebook / X / TikTok / YouTube /
    LinkedIn @medicologyworld) rendered as email-safe data-URI SVGs —
    auto-appended by the renderer from the footer socials settings.
-   **Announcements ≠ emails**: announcements are in-app only (general,
    role-based, or user-specific via `targetUserIds`); emails are separate
    process/promotional campaigns under Email Templates.

## P0.16 Email template builder `[COMPLETED]`

-   DB-driven templates (welcome, verification, password reset, purchase,
    entitlement events, waitlist, results, announcements, security,
    custom) with subject/preheader/body/version/audience/language.
-   Visual block editor (palette → canvas → properties; 13 block types:
    heading, text, image, button, divider, spacer, columns, social links,
    QBank card, result summary, footer, unsubscribe, custom HTML) with
    desktop/tablet/mobile preview; strict sanitized HTML output;
    variable picker (`{{user.name}}` etc., unknown vars render empty);
    draft/published/archived + version history/compare/restore.

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

## P0.19 Account configuration `[COMPLETED]`

-   Student-facing `/settings`: Appearance | Profile | **Study Aim** |
    Security | Notifications | Privacy & Data tabs.
-   **Study Aim (AMBOSS-style)**: the student sets their goal for the
    current subscription (target exam, target date, daily/weekly question
    goals). Changing the aim resets sessions, per-question progress and
    daily challenges for a fresh start (bookmarks/notes kept).
-   Editable **/profile** page (reachable from the sidebar): name, email,
    college, university, year, phone, bio + password change.
-   Security: per-login sessions tracked (unique `jti` per token),
    listed, individually revoked or revoke-all (current session kept),
    **enforced in the auth middleware** — a revoked token 401s
    everywhere; login history from `security_events`; JSON data export;
    anonymizing account deletion; server-backed notification prefs.

## P0.20 Registration controls `[COMPLETED]`

-   `registration-policy.ts` enforced server-side on `/auth/register`:
    open/closed, allowed email domains, invite-only mode, password
    policy — never trust the frontend.
-   Email verification flow (when enabled) sends a verification email;
    `forgot-password` / `reset-password` endpoints implemented with
    email delivery.

## P0.21 Maintenance mode `[COMPLETED]`

-   Server-side 503 for non-exempt routes with admin bypass; premium
    maintenance page; configurable title/message/image/ETA/support
    contact.

## P0.22 Notification configuration `[COMPLETED]`

-   Settings group exists (in-app/email defaults) + per-user
    notification preferences (server-backed, saved on the user row).
-   Event → email channel routing live via transactional emails
    (welcome, verification, password reset, purchase, entitlement
    expiring/expired, announcements). Future push/SMS: P7.

## P0.23 SEO `[COMPLETED]`

-   Dedicated SEO group (site title, meta description, keywords, OG
    title/description/image, robots, canonical URL) exposed publicly and
    applied to the document via `usePlatformConfig`; footer/social group
    renders only configured links.

## P0.24 Audit & security `[COMPLETED]`

-   Audit logging (actor, entity, diff, IP; secrets never logged) +
    Admin → Audit Logs viewer (`audit.view`-gated) with action/entity
    filters and before/after diff.
-   Settings export (secrets stripped) + validated import with dry-run
    diff preview, all audited; admin Ctrl+K command palette.
-   Formal security audit pass remains a standing Phase 27 item.

## P0.25 Testing `[PARTIAL]`

-   72 API integration tests + 105 frontend tests (incl. note utilities /
    MarkdownNote renderer) + typechecks + build `[COMPLETED]`.
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
