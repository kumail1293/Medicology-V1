# P0 Schema Notes

Status of the database layer for **Phase P0** (MEDICOLOGY_PLAN.md). The
database is the source of truth: no products, universities, exams, prices or
entitlements are hard-coded anywhere in the API routes.

## Migrations

| Migration | Contents |
|---|---|
| `0000_p0_qbanks_entitlements_waitlist` | All 32 tables: users, taxonomy (countries → exam systems → exams → programs → academic years → subjects → systems → topics → subtopics), questions, question_versions, audit_logs, qbanks, qbank_questions (unique `(qbank_id, question_id)`), entitlements, payment_orders, waitlist (unique `(user_id, qbank_id)`), plus the legacy app tables. |
| `0001_p0_performance_indexes` | Additive-only secondary indexes for production hot paths: entitlements `(user_id, qbank_id)` + `(user_id)`, qbank_questions `(qbank_id)` + `(question_id)`, waitlist `(qbank_id)`, payment_orders `(user_id, idempotency_key)` + `(user_id)` + `(status)`, questions `(status)`, question_versions `(question_id)`, audit_logs `(entity_type, entity_id)`. No drops, no data changes — safe on existing databases. |

## P0 contract enforced by the schema

- **QID**: `questions.qid` is `UNIQUE` and never reassigned by the API (update
  routes strip it); the import pipeline refuses to overwrite a QID that exists.
- **Question ↔ QBank**: many-to-many via `qbank_questions` with a unique
  `(qbank_id, question_id)` — a question can belong to UHS, KMU, FCPS and NLE
  without duplication.
- **Entitlements**: `entitlements` is the access-control table. Payment orders
  (`payment_orders.order_id` unique, `(user_id, idempotency_key)` indexed) feed
  it through the verified `payments.verify` / webhook path — a purchase row is
  never used as access control.
- **Review lifecycle**: `questions.status` drives `draft → pending_review →
  under_medical_review → approved → published` (+ flagged/errata/archived),
  with every transition snapshotted into `question_versions`.

## Remaining P0 follow-ups (tracked debt)

1. **Legacy `qbank_purchases` table** — predates the entitlement model and is
   no longer read or written by any code (schema export only). Kept for
   historical data; safe to drop in a later cleanup migration once confirmed
   unused in production.
2. **Expired-entitlement sweep** — access expiry is computed on read
   (`expiresAt`), and `status: 'expired'` is never written. Optional
   maintenance job to mark expired rows; not required for correctness.
3. **Partial unique index on active entitlements** — a DB-level guarantee of
   "one active grant per (user, qbank)" would duplicate what
   `grantEntitlement` already enforces in code. Deferred because existing
   production data may contain duplicates; add only after a dedupe pass.
4. **Duplicate-detection speed** — the importer runs bigram similarity in JS
   over the full questions table. For very large banks, a `pg_trgm` GIN index
   on `questions.question_text` would let the check push into Postgres
   (P1/P3 optimization, not P0-critical).
5. **`qbanks.question_count` cache** — kept in sync by the admin mapping
   endpoint; a trigger or nightly recount guards against drift if rows are
   ever inserted outside the API.

## Generating migrations

```bash
cd lib/db
./node_modules/.bin/drizzle-kit generate --name <slug>
```

The config reads `DATABASE_URL` from the root `.env` (used only for the
connection string — `generate` never connects to the database).
