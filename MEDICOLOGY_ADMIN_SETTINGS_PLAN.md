# Medicology — Admin Settings & Platform Configuration Plan

## Objective

Build a centralized, secure, database/config-driven administration system for Medicology, inspired by the flexibility of WordPress/Elementor but purpose-built for a medical examination platform.

> **Any platform-wide setting that an administrator should be able to change must not be hard-coded throughout React components.**

## Core Architecture

```text
Admin UI
   ↓
Validated Admin API
   ↓
Settings Service
   ↓
Database + Cache
   ↓
Public Configuration / Authenticated Configuration
   ↓
React + CSS Design Tokens
```

Use the existing Medicology database, authentication, authorization, audit, media, taxonomy, announcement, and admin infrastructure. **Do not create duplicate systems.**

## Settings Areas

### 1. Branding
- Platform/brand name
- Short name
- Tagline
- Logo
- Light/dark logos
- Favicon
- App icon
- Login/email logos
- Open Graph image
- Primary/secondary/accent colors
- Success/warning/error colors

### 2. Appearance
- Light / dark / system mode
- Default theme
- User theme override
- Border radius
- Shadows
- Component density
- Card/button/navigation styles
- Design tokens exposed through CSS variables

### 3. Typography
- Primary/secondary/heading fonts
- Font scale
- Heading scale
- Line height
- Letter spacing
- Trusted/allowlisted font sources only

### 4. Login & Authentication
- Login branding
- Background/image
- Welcome text
- Registration availability
- Password reset
- Social login visibility
- Terms/privacy/support links
- Maintenance behavior

### 5. Registration
- Registration enabled/disabled
- Email verification
- Allowed domains
- Password policy
- Terms/privacy acceptance
- Onboarding
- Default role
- Default free entitlement
- Invite/referral controls

### 6. Email Branding
- Sender name/address
- Reply-to
- Logo/header/footer
- Brand colors
- Support/legal/social links
- Reusable email templates
- Safe variables such as `{{user.name}}`, `{{qbank.name}}`, `{{order.id}}`

### 7. Footer & Social
- Footer text
- Copyright
- About/contact
- Social links
- Privacy/terms/refund/support links
- Sitemap visibility

### 8. SEO
- Default title/description
- Title suffix
- Canonical URL
- Open Graph defaults
- Social image
- Robots defaults
- Sitemap controls
- Per-page overrides

### 9. Maintenance
- Enable/disable
- Title/message
- Logo/background
- Countdown
- Admin bypass
- Allowed routes
- Emergency contact

Enforce maintenance server-side where required.

### 10. QBank Defaults
- Free/paid behavior
- Default question/session count
- Time limits
- Explanation behavior
- Answer reveal behavior
- Bookmark/notes/reporting
- Negative marking defaults
- Attempt limits
- Trial/entitlement defaults

Global values are defaults; university/exam/QBank settings override them.

### 11. Platform-Wide Exam Settings
Support:
`Country → Exam Body/University → Program → Year → Subject → System → Topic → Subtopic`

Configurable:
- Question count
- Duration
- Marking scheme
- Negative marking
- Pass percentage
- Navigation
- Question palette
- Review behavior
- Auto-submit
- Pause/resume
- Attempts
- Result visibility

Never assume all universities use the same rules.

### 12. Notifications
- In-app
- Email
- Announcements
- Purchases
- Entitlement expiry
- New QBank
- Waitlist availability
- System alerts

### 13. Announcements
Build a reusable announcement builder supporting:
- Banner
- Modal
- Toast
- Notification
- Homepage section
- Dashboard card
- Full announcement
- Exam alert
- Promotion

Fields:
`title, subtitle, rich body, CTA, URL, image/icon, priority, audience, schedule, status, theme, dismissible, frequency, target route`

### 14. Announcement Templates
Include reusable templates for:
- Exam alerts
- New QBank launches
- Promotions
- System notices
- Maintenance notices
- New feature announcements

Templates must be editable from admin.

### 15. Animation Controls
Support configurable:
- None
- Fade
- Slide
- Scale
- Zoom
- Bounce
- Shimmer
- Pulse
- Marquee
- Typewriter

Controls:
- Duration
- Delay
- Repeat
- Direction
- Entrance/exit
- Trigger

Always respect `prefers-reduced-motion`.

### 16. Feature Flags
Examples:
`FLASHCARDS, RICH_CONTENT, PAST_PAPERS, AI_TUTOR, AI_QUESTION_REVIEW, SPACED_REPETITION, STUDY_BUDDIES, DAILY_CHALLENGE, PAYMENTS, WAITLIST, NEW_EXAM_ENGINE`

Support:
- Enabled/disabled
- Environment
- Admin preview
- Optional rollout percentage
- Start/end dates

Protected backend features must also enforce flags server-side.

### 17. Coming Soon
Admin-created future:
- Exams
- QBanks
- Features
- Programs
- Resources

Fields:
`name, description, category, icon/image, expected release, status, notify-me, audience, CTA`

Example:
`FCPS → Coming Soon → Notify Me`

### 18. Media Management
Reusable media layer for:
- Logos
- Icons
- Announcement images
- QBank covers
- Flashcard images
- Rich-content images
- SEO images

Track ID, filename, MIME, size, dimensions, URL, alt text, uploader, timestamp.

Validate uploads.

### 19. Audit & Versioning
Record administrative changes:
- Actor
- Section/key
- Previous value
- New value
- Timestamp
- Reason

Do not log secrets.

Support:
- History
- Diff
- Restore

### 20. Permissions
Recommended roles:
- Super Admin
- Platform Admin
- Content Admin
- Exam Admin
- Finance Admin
- Marketing Admin
- Support Admin

Use server-side authorization for every mutation.

## API

Suggested structure:

```text
GET   /api/config/public
GET   /api/admin/settings
GET   /api/admin/settings/:section
PATCH /api/admin/settings/:section
POST  /api/admin/settings/validate
GET   /api/admin/settings/history
POST  /api/admin/settings/restore
```

`/api/config/public` must expose only explicitly public values.

Never expose database URLs, API keys, payment credentials, SMTP secrets, signing keys, or tokens.

## Frontend Rule

Do not do this:

```tsx
const brandColor = "#123456";
```

Prefer a centralized configuration provider and CSS variables/design tokens:

```tsx
const config = usePlatformConfig();
```

The application should be rebrandable without rebuilding the frontend.

## Admin UX

Create an Elementor-inspired settings experience:

```text
Admin
├── Dashboard
├── Branding
├── Appearance
├── Typography
├── Navigation
├── Authentication
├── Registration
├── Email
├── SEO
├── Social
├── Footer
├── Notifications
├── Announcements
├── QBanks
├── Exams
├── Payments
├── Feature Flags
├── Coming Soon
├── Media
├── Maintenance
└── Advanced
```

Include search, grouped sections, live preview where safe, unsaved-change warnings, validation, reset/save controls, permissions, and responsive UI.

## Configuration Precedence

```text
System safety constraints
        ↓
University/Exam override
        ↓
QBank/content override
        ↓
Platform default
```

Make resolution deterministic and tested.

## Caching

Use:

```text
Database
  ↓
Validated settings service
  ↓
Cache
  ↓
API
  ↓
Frontend
```

Invalidate affected cache entries after successful changes.

## Testing

Cover:
- CRUD
- validation
- authorization
- public/private separation
- cache invalidation
- audit logging
- restore
- feature flags
- maintenance mode
- announcement scheduling
- animation configuration
- registration enforcement
- QBank defaults
- exam overrides

## Acceptance Criteria

The system is complete only when:
1. Branding can change without source-code edits.
2. Public configuration contains no secrets.
3. Server-side validation and authorization exist.
4. Mutations are auditable.
5. Previous configuration can be restored.
6. Scoped exam/QBank settings override global defaults.
7. Feature flags work safely on backend and frontend.
8. Announcement templates are reusable.
9. Animations respect reduced-motion.
10. Maintenance mode is reliable.
11. Settings persist through restarts/deployments.
12. Critical paths have tests.
13. Existing QBank/taxonomy/payment/content infrastructure is reused.
14. Typecheck, build, and tests pass.

## Progress

Shipped (commit `726024d` + follow-ups):

-   ✅ Feature flags (item 16) — settings group, public exposure, and
    server-side `requireFeature` enforcement (503) on payments, flashcards,
    daily challenge, study buddies, waitlist.
-   ✅ Maintenance mode (item 9) — server-side 503 enforcement with
    health/auth/settings/admin exemptions (admin bypass) + frontend screen.
-   ✅ Audit & versioning (item 19, partial) — settings updates snapshot
    `oldValues`; `GET /api/admin/settings/history` + `POST
    /api/admin/settings/restore`; Admin UI Activity & History tab.
-   ✅ Section-scoped API — `GET`/`PATCH /api/admin/settings/:section`.
-   ✅ Cache invalidation for flags/maintenance on every settings write.
-   ✅ Animation controls (item 15) — master switch, effect picker
    (none/fade/slide/scale/zoom/bounce/shimmer/pulse/marquee/typewriter),
    duration/delay/repeat, applied via CSS variables + an `.anim` utility;
    `prefers-reduced-motion` always wins (verified in-browser).
-   ✅ Announcement templates + scheduling (items 13–14) — `starts_at`
    scheduling window, themes, priorities, dismissibility + frequency,
    route targeting; reusable admin-authored templates (exam alert, QBank
    launch, promotion, system notice, maintenance, feature) with
    one-click "Use template" prefill; audit-logged mutations.
-   ✅ Media library (item 18) — new `media` table (migration `0006`):
    validated uploads (settings-driven MIME whitelist + size cap), image
    dimensions parsed from headers, categories (logo/icon/announcement/
    qbank_cover/flashcard/rich_content/seo/other), alt text + search,
    owner-scoped edit/delete, audit trail; Admin → Media Library page with
    grid/filter/search, shared MediaPicker dialog wired into the rich-text
    editor (insert at cursor), and public file serving.
-   ✅ QBank/exam scoped overrides (items 10–11) — new
    `settings_overrides` table (migration `0007`) keyed by
    (scope, scopeId, group, key) with JSONB values; scopes follow the plan's
    precedence: safety constraints → QBank → topic → system → subject →
    year → program → exam → country → platform default (fully
    deterministic, provenance per key). New `examSettings` group covers QBank
    defaults (trial questions, attempts, bookmarks/notes/reporting) and exam
    behavior (count, duration, marking, pass %, navigation, palette, review,
    auto-submit, pause/resume, result visibility, explanations, reveal).
    Admin → Settings → Scoped Overrides lets admins pick a scope + entity
    and set/remove per-key overrides with live provenance badges; session
    creation applies the resolved rules (explicit client values win), and a
    public `GET /api/settings/exam` serves the resolution to the exam engine.

Deferred (next):
coming-soon catalogue (17), granular admin roles (20).

## Implementation Order

1. Audit `8d5af0e` and the existing settings implementation.
2. Consolidate any duplicate settings logic.
3. Create/extend database schema and migration.
4. Implement settings service + validation.
5. Implement permission-aware admin UI.
6. Implement public configuration endpoint.
7. Connect branding/design tokens.
8. Implement announcements/templates/animations.
9. Implement feature flags and Coming Soon.
10. Add audit/version history and restore.
11. Add tests.
12. Run typecheck/build/test suite.
13. Update documentation.
