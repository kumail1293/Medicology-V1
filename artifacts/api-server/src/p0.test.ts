// P0 integration tests — run against the in-memory mock DB with the API
// booted in-process (no external server or database required).
//
//   node --import tsx/esm --test src/p0.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';

process.env.PORT = '5099';
process.env.DATABASE_URL = 'sqlite:mock';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'p0-test-secret';
process.env.APP_BASE_URL = 'http://localhost:5099';

const BASE = 'http://localhost:5099/api';

before(async () => {
  // Importing app.ts boots the listener against the mock DB (PORT/DATABASE_URL above).
  await import('./app.js');
  // Give the listener a moment to come up.
  await new Promise((r) => setTimeout(r, 500));
});

async function registerUser(email: string) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'P0 Test',
      email,
      password: 'TestPass123',
      college: 'Demo College',
      university: 'UHS',
      year: 2,
    }),
  });
  const data: any = await res.json();
  assert.equal(res.status, 201, data.error ? `register failed: ${data.error}` : JSON.stringify(data).slice(0, 200));
  return { token: data.token as string, user: data.user as { id: number } };
}

const json = (headers: Record<string, string>, body?: unknown): RequestInit => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('catalogue is database-driven (no hard-coded products)', async () => {
  const { token } = await registerUser('catalogue@test.com');
  const res = await fetch(`${BASE}/qbanks/catalogue`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  const data: any = await res.json();
  assert.ok(Array.isArray(data.catalogue) && data.catalogue.length > 0);
  const uhs2 = data.catalogue.find((c: any) => c.slug === 'uhs-mbbs-2nd-year');
  assert.ok(uhs2, 'uhs-mbbs-2nd-year should exist from the DB seed');
  assert.equal(uhs2.status, 'available');
  assert.equal(typeof uhs2.price, 'number');
  assert.equal(typeof uhs2.currency, 'string');
  const bds = data.catalogue.find((c: any) => c.slug === 'uhs-bds-1st-year');
  assert.equal(bds.status, 'coming_soon');
});

test('payment flow: gated → initiate → verify → entitlement granted (idempotent)', async () => {
  const { token } = await registerUser('payflow@test.com');
  const auth = { Authorization: `Bearer ${token}` };

  // 1. Locked before purchase.
  const before: any = await (await fetch(`${BASE}/qbanks/usmle-step1/access`, { headers: auth })).json();
  assert.equal(before.hasAccess, false);

  // 2. QBank-scoped session creation is denied server-side.
  const gated = await fetch(`${BASE}/sessions/create`, json(auth, { qbankSlug: 'usmle-step1', questionCount: 3 }));
  assert.equal(gated.status, 403);
  const gatedBody: any = await gated.json();
  assert.equal(gatedBody.code, 'QBANK_LOCKED');

  // 3. QBank questions endpoint is denied too.
  const qsLocked = await fetch(`${BASE}/qbanks/usmle-step1/questions`, { headers: auth });
  assert.equal(qsLocked.status, 403);

  // 4. Initiate creates a pending order (server-priced).
  const init: any = await (await fetch(`${BASE}/payments/initiate`, json(auth, { qbankType: 'usmle-step1', provider: 'dev' }))).json();
  assert.ok(init.orderId);
  assert.ok(init.redirectUrl);
  const ref = new URL(init.redirectUrl).searchParams.get('ref');
  assert.ok(ref);

  // 5. Idempotent initiate — same pending order, no duplicate charge.
  const init2: any = await (await fetch(`${BASE}/payments/initiate`, json(auth, { qbankType: 'usmle-step1', provider: 'dev' }))).json();
  assert.equal(init2.orderId, init.orderId);

  // 6. Forged/wrong ref is rejected and does not brick the order.
  const bad = await fetch(`${BASE}/payments/verify`, json(auth, { orderId: init.orderId, provider: 'dev', ref: 'forged-ref' }));
  assert.equal(bad.status, 400);

  // 7. Correct ref verifies and grants the entitlement.
  const ok: any = await (await fetch(`${BASE}/payments/verify`, json(auth, { orderId: init.orderId, provider: 'dev', ref }))).json();
  assert.equal(ok.verified, true);
  assert.equal(ok.alreadyProcessed, false);

  // 8. Re-verification is idempotent — no double grant.
  const again: any = await (await fetch(`${BASE}/payments/verify`, json(auth, { orderId: init.orderId, provider: 'dev', ref }))).json();
  assert.equal(again.verified, true);
  assert.equal(again.alreadyProcessed, true);

  // 9. Access is now granted and protected operations open up.
  const after: any = await (await fetch(`${BASE}/qbanks/usmle-step1/access`, { headers: auth })).json();
  assert.equal(after.hasAccess, true);

  const sess = await fetch(`${BASE}/sessions/create`, json(auth, { qbankSlug: 'usmle-step1', questionCount: 3 }));
  assert.equal(sess.status, 200);

  const qsOpen = await fetch(`${BASE}/qbanks/usmle-step1/questions`, { headers: auth });
  assert.equal(qsOpen.status, 200);
  const qsData: any = await qsOpen.json();
  assert.ok(Array.isArray(qsData.questionIds));
});

test('entitlements: grant is idempotent, expiry + revoke revoke access', async () => {
  const { user } = await registerUser('entitle@test.com');
  const { grantEntitlement, hasActiveEntitlement, revokeEntitlement } = await import('./utils/entitlements.js');
  const { findQbankBySlug } = await import('./utils/entitlements.js');
  const qbank = await findQbankBySlug('uhs-mbbs-2nd-year');
  assert.ok(qbank);

  // Payment grant gets a duration-based expiry.
  const g1 = await grantEntitlement({ userId: user.id, qbankId: qbank.id, source: 'payment', durationDays: 30, orderRef: 'ORD-TEST-1' });
  assert.equal(g1.created, true);
  assert.ok(g1.entitlement.expiresAt);
  const days = (new Date(g1.entitlement.expiresAt).getTime() - Date.now()) / 86400000;
  assert.ok(days > 29 && days < 31, `expected ~30 days, got ${days}`);

  // A second grant while active reuses the existing entitlement.
  const g2 = await grantEntitlement({ userId: user.id, qbankId: qbank.id, source: 'payment', durationDays: 30, orderRef: 'ORD-TEST-2' });
  assert.equal(g2.created, false);
  assert.equal(g2.entitlement.id, g1.entitlement.id);

  assert.equal(await hasActiveEntitlement(user.id, qbank.id), true);

  // Revocation removes access.
  await revokeEntitlement(g1.entitlement.id, user.id);
  assert.equal(await hasActiveEntitlement(user.id, qbank.id), false);
});

// ---------------------------------------------------------------------------
// Import pipeline (P0.6): upload → validate → duplicate/QID detect → execute.
// ---------------------------------------------------------------------------

function makeXlsxBuffer(rows: Record<string, any>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function adminLogin() {
  const res = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const data: any = await res.json();
  assert.ok(data.token, 'admin login should succeed');
  return data.token as string;
}

async function uploadImport(token: string, buffer: Buffer, name = 'qa-import.xlsx') {
  const form = new FormData();
  form.append('file', new Blob([buffer]), name);
  return fetch(`${BASE}/admin/import/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
}

test('import: preview validates rows, assigns QIDs, and rows enter the review queue', async () => {
  const token = await adminLogin();
  const buf = makeXlsxBuffer([
    {
      Question: 'A 30-year-old woman with palpitations and weight loss. Which investigation is most appropriate?',
      'Option A': 'ECG',
      'Option B': 'Chest X-ray',
      'Option C': 'MRI brain',
      'Option D': 'Lumbar puncture',
      'Correct Answer': 'A',
      Explanation: 'Palpitations with weight loss suggest hyperthyroidism; ECG is the first-line investigation.',
      Subject: 'Medicine',
      Topic: 'Endocrinology',
      Difficulty: 'easy',
    },
    // A broken row must be flagged, not silently imported.
    {
      Question: '',
      'Option A': 'Only',
      'Option B': 'Two',
      'Correct Answer': 'Z',
    },
  ]);

  const previewRes = await uploadImport(token, buf);
  assert.equal(previewRes.status, 200);
  const preview: any = await previewRes.json();
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.stats.valid, 1);
  assert.equal(preview.stats.error, 1);

  const good = preview.rows.find((r: any) => r.status === 'valid');
  assert.match(good.qid, /^QID-MED-\d{9}$/, 'valid rows get a generated QID');
  const bad = preview.rows.find((r: any) => r.status === 'error');
  assert.ok(bad.messages.some((m: string) => m.includes('Missing question text')));
  assert.ok(bad.messages.some((m: string) => m.includes('Correct answer')));

  // Execute imports the valid row only.
  const exec = await fetch(`${BASE}/admin/import/execute`, json({ Authorization: `Bearer ${token}` }, { rows: preview.rows }));
  assert.equal(exec.status, 200);
  const result: any = await exec.json();
  assert.equal(result.inserted, 1);
  assert.equal(result.skipped, 0);

  // Imported questions enter the review pipeline — never auto-published.
  const list: any = await (await fetch(`${BASE}/admin/questions?status=pending_review&limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const found = (list.questions ?? []).find((q: any) => q.qid === good.qid);
  assert.ok(found, 'imported question should be pending_review');
  assert.equal(found.status, 'pending_review');
});

test('import: duplicate text and QID conflicts are detected and never overwrite', async () => {
  const token = await adminLogin();
  // Grab an existing seeded question to reuse its QID and text.
  const existingRes = await fetch(`${BASE}/admin/questions?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const existing: any = (await (existingRes.json() as Promise<any>)).questions[0];
  assert.ok(existing?.qid && existing?.questionText);

  const buf = makeXlsxBuffer([
    {
      QID: existing.qid,
      Question: 'A completely brand new question with zero overlap to any seed.',
      'Option A': 'A1',
      'Option B': 'B1',
      'Option C': 'C1',
      'Option D': 'D1',
      'Correct Answer': 'A',
    },
    {
      Question: existing.questionText, // identical to an existing question
      'Option A': 'A2',
      'Option B': 'B2',
      'Option C': 'C2',
      'Option D': 'D2',
      'Correct Answer': 'B',
    },
  ]);

  const preview: any = await (await uploadImport(token, buf)).json();
  const qidRow = preview.rows.find((r: any) => r.qid === existing.qid);
  assert.equal(qidRow.status, 'duplicate');
  assert.ok(qidRow.messages.some((m: string) => m.includes('already exists')), 'QID conflict should be flagged');
  assert.equal(qidRow.existingId, existing.id);

  const textRow = preview.rows.find((r: any) => r.data.questionText === existing.questionText);
  assert.equal(textRow.status, 'duplicate');
  assert.ok(textRow.messages.some((m: string) => m.includes('Possible duplicate')), 'identical text should be flagged as duplicate');

  // Executing with duplicates forced must skip the QID conflict (no overwrite).
  const exec = await fetch(`${BASE}/admin/import/execute`, json({ Authorization: `Bearer ${token}` }, { rows: preview.rows, includeDuplicates: true }));
  const result: any = await exec.json();
  assert.ok(result.skipped >= 1, 'QID-conflict row should be skipped');

  const after: any = await (await fetch(`${BASE}/admin/questions?limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const stillThere = (after.questions ?? []).find((q: any) => q.id === existing.id && q.questionText === existing.questionText);
  assert.ok(stillThere, 'existing question must be untouched');
});

// ---------------------------------------------------------------------------
// Review lifecycle + versioning (P0.5).
// ---------------------------------------------------------------------------

test('review lifecycle: transitions enforced, invalid moves rejected, versions recorded', async () => {
  const token = await adminLogin();
  const created: any = await (
    await fetch(
      `${BASE}/admin/questions`,
      json(
        { Authorization: `Bearer ${token}` },
        {
          questionText: 'Review lifecycle test question',
          options: { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta' },
          correctAnswer: 'A',
          difficulty: 'easy',
        }
      )
    )
  ).json();
  assert.equal(created.status, 'draft');
  const id = created.id;

  const step = async (action: string) => {
    const res = await fetch(`${BASE}/admin/questions/${id}/review`, json({ Authorization: `Bearer ${token}` }, { action }));
    return res;
  };

  assert.equal((await step('submit')).status, 200);
  assert.equal((await step('start_review')).status, 200);
  assert.equal((await step('approve')).status, 200);

  // Rejection requires a note (question is 'approved', a rejectable state).
  const rejectNoNote = await fetch(`${BASE}/admin/questions/${id}/review`, json({ Authorization: `Bearer ${token}` }, { action: 'reject' }));
  assert.equal(rejectNoNote.status, 400);

  assert.equal((await step('publish')).status, 200);

  // Invalid transition: submitting an already-published question is a 409.
  const invalid = await step('submit');
  assert.equal(invalid.status, 409);
  const invalidBody: any = await invalid.json();
  assert.equal(invalidBody.currentStatus, 'published');

  // Every transition appended a version row (create + submit + review + approve + publish).
  const versions: any = await (await fetch(`${BASE}/admin/questions/${id}/versions`, { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.ok(Array.isArray(versions.versions) && versions.versions.length >= 5, `expected >=5 versions, got ${versions.versions?.length}`);
  assert.equal(versions.versions[versions.versions.length - 1].newValues.status, 'published');

  // Published content is visible to the public questions feed.
  const published: any = await (await fetch(`${BASE}/admin/questions?status=published&limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.ok((published.questions ?? []).some((q: any) => q.id === id));
});

test('QID is immutable: edits and review moves never change it', async () => {
  const token = await adminLogin();
  const created: any = await (
    await fetch(
      `${BASE}/admin/questions`,
      json(
        { Authorization: `Bearer ${token}` },
        {
          questionText: 'QID immutability test question',
          options: { A: 'a1', B: 'b1', C: 'c1', D: 'd1' },
          correctAnswer: 'B',
        }
      )
    )
  ).json();
  const qid = created.qid;
  assert.match(qid, /^QID-MED-\d{9}$/);

  const updRes = await fetch(`${BASE}/admin/questions/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      questionText: 'QID immutability test question (edited)',
      qid: 'QID-MED-999999999', // must be ignored — never reassignable
    }),
  });
  const updated: any = await updRes.json();
  assert.equal(updRes.status, 200, `update failed: ${JSON.stringify(updated).slice(0, 300)}`);
  assert.equal(updated.qid, qid, 'QID must not change on update');
  assert.notEqual(updated.questionText, created.questionText);
});

test('payment webhook: dev provider exposes no webhook endpoint (501)', async () => {
  const res = await fetch(`${BASE}/payments/webhook/dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 501);
});

test('waitlist: notify registers once per user+qbank, admin sees demand', async () => {
  const { token } = await registerUser('waitlist@test.com');
  const auth = { Authorization: `Bearer ${token}` };

  const n1: any = await (await fetch(`${BASE}/qbanks/uhs-bds-1st-year/notify`, json(auth, {}))).json();
  assert.equal(n1.registered, true);
  assert.equal(n1.created, true);

  const n2: any = await (await fetch(`${BASE}/qbanks/uhs-bds-1st-year/notify`, json(auth, {}))).json();
  assert.equal(n2.registered, true);
  assert.equal(n2.created, false);

  // Admin demand view.
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: 'admin123' }));
  // The mock seed uses ADMIN_PASSWORD from the environment; fall back to the
  // default used by db.ts when it is not set.
  const adminBody: any = adminLogin.ok
    ? await adminLogin.json()
    : await (await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }))).json();
  const demand: any = await (await fetch(`${BASE}/admin/waitlist`, { headers: { Authorization: `Bearer ${adminBody.token}` } })).json();
  assert.ok(Array.isArray(demand.demand));
  const bds = demand.demand.find((d: any) => d.slug === 'uhs-bds-1st-year');
  assert.ok(bds && bds.count >= 1, 'admin demand should include the waitlist entry');
});
