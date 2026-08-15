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

test('platform settings: public whitelist, admin update/reset roundtrip, validation', async () => {
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const postJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  // 1. Public endpoint needs no auth and only exposes whitelisted groups.
  const pub: any = await (await fetch(`${BASE}/settings/public`)).json();
  assert.ok(pub.settings?.branding?.primaryColor, 'public branding present');
  assert.ok(pub.settings?.general?.siteName, 'public general present');
  assert.equal(pub.settings?.security, undefined, 'security is never exposed publicly');
  assert.equal(pub.settings?.payments, undefined, 'payments are never exposed publicly');

  // 2. Admin login (mock seed admin).
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };

  // 3. Admin GET returns merged settings + defaults.
  const adminGet: any = await (await fetch(`${BASE}/admin/settings`, { headers: auth })).json();
  assert.ok(adminGet.settings?.branding?.primaryColor);
  assert.ok(adminGet.defaults?.branding?.primaryColor);

  // 4. PUT updates branding; public endpoint reflects it.
  const putRes = await fetch(`${BASE}/admin/settings`, putJson(auth, { branding: { primaryColor: '#dc2626', borderRadius: 20 } }));
  assert.equal(putRes.status, 200);
  const putBody: any = await putRes.json();
  assert.equal(putBody.settings.branding.primaryColor, '#dc2626');
  assert.equal(putBody.settings.branding.borderRadius, 20);
  const pub2: any = await (await fetch(`${BASE}/settings/public`)).json();
  assert.equal(pub2.settings.branding.primaryColor, '#dc2626', 'public reflects the saved brand color');

  // 5. Invalid color is rejected.
  const bad = await fetch(`${BASE}/admin/settings`, putJson(auth, { branding: { primaryColor: 'not-a-color' } }));
  assert.equal(bad.status, 400);

  // 6. Non-admin is forbidden.
  const { token: userToken } = await registerUser('settings-user@test.com');
  const forbidden = await fetch(`${BASE}/admin/settings`, { headers: { Authorization: `Bearer ${userToken}` } });
  assert.equal(forbidden.status, 403);

  // 7. Reset restores defaults.
  const resetRes = await fetch(`${BASE}/admin/settings/reset`, postJson(auth, { group: 'branding' }));
  assert.equal(resetRes.status, 200);
  const resetBody: any = await resetRes.json();
  assert.equal(resetBody.settings.branding.primaryColor, '#0d9488', 'reset returns default brand color');
});

test('role management: admin assigns editor/teacher, guards enforce role boundaries', async () => {
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const postJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  // Dev mock admin is a superadmin.
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const superAuth = { Authorization: `Bearer ${adminBody.token}` };

  // 1. Create a plain user via the admin endpoint.
  const email = `role-${Date.now()}@test.com`;
  const created: any = await (await fetch(`${BASE}/admin/users`, postJson(superAuth, {
    name: 'Role Test', email, password: 'TestPass123', college: 'Demo College', year: 2,
  }))).json();
  assert.equal(created.role, 'user', 'new users default to user role');
  const userId = created.id;

  // 2. Assign editor, then teacher — both succeed and sync isAdmin=false.
  const toEditor = await fetch(`${BASE}/admin/users/${userId}`, putJson(superAuth, { role: 'editor' }));
  assert.equal(toEditor.status, 200);
  const editorBody: any = await toEditor.json();
  assert.equal(editorBody.role, 'editor');
  const toTeacher = await fetch(`${BASE}/admin/users/${userId}`, putJson(superAuth, { role: 'teacher' }));
  const teacherBody: any = await toTeacher.json();
  assert.equal(teacherBody.role, 'teacher');

  // 3. Unknown roles are rejected outright.
  const bad = await fetch(`${BASE}/admin/users/${userId}`, putJson(superAuth, { role: 'hacker' }));
  assert.equal(bad.status, 400);

  // 4. A plain admin cannot grant or revoke admin roles (403).
  const adminUser: any = await (await fetch(`${BASE}/admin/users`, postJson(superAuth, {
    name: 'Plain Admin', email: `plain-admin-${Date.now()}@test.com`, password: 'TestPass123', college: 'Demo College', year: 2, role: 'admin',
  }))).json();
  const adminLogin2 = await fetch(`${BASE}/auth/login`, json({}, { email: adminUser.email, password: 'TestPass123' }));
  const adminLogin2Body: any = await adminLogin2.json();
  const adminAuth = { Authorization: `Bearer ${adminLogin2Body.token}` };
  const grantAdmin = await fetch(`${BASE}/admin/users/${userId}`, putJson(adminAuth, { role: 'admin' }));
  assert.equal(grantAdmin.status, 403, 'plain admin cannot grant admin role');
  const demoteSuper = await fetch(`${BASE}/admin/users/1`, putJson(adminAuth, { role: 'user' }));
  assert.equal(demoteSuper.status, 403, 'plain admin cannot demote the superadmin');

  // 5. Self-demotion is blocked (400) so the platform never loses its last admin.
  const selfDemote = await fetch(`${BASE}/admin/users/1`, putJson(superAuth, { role: 'user' }));
  assert.equal(selfDemote.status, 400, 'superadmin cannot demote themselves');

  // 6. Role changes land in the audit trail with the before → after pair.
  const audit: any = await (await fetch(`${BASE}/admin/audit-logs?limit=20`, { headers: superAuth })).json();
  const logs = audit.logs || audit.auditLogs || [];
  const roleChanges = logs.filter((l: any) => l.action === 'user.role_change' && String(l.entityId) === String(userId));
  assert.ok(roleChanges.length >= 2, 'role changes are audited');
  assert.match(roleChanges[0].summary, /user → editor/, 'audit records the old and new role');
});

test('feature flags: public exposure, server-side enforcement, cache invalidation', async () => {
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };

  // 1. Public endpoint exposes flags (safe, not secret).
  const pub: any = await (await fetch(`${BASE}/settings/public`)).json();
  assert.equal(pub.settings.featureFlags.flashcards, true, 'flags exposed publicly');
  assert.equal(pub.settings.featureFlags.payments, true);

  // 2. Disable flashcards → the flashcards API is blocked server-side (503).
  const off = await fetch(`${BASE}/admin/settings`, putJson(auth, { featureFlags: { flashcards: false } }));
  assert.equal(off.status, 200);
  const decks: any = await (await fetch(`${BASE}/flashcards/decks`)).json();
  assert.equal(decks.error, 'FEATURE_DISABLED', 'flashcards route enforces the flag');

  // 3. Public endpoint reflects the change.
  const pub2: any = await (await fetch(`${BASE}/settings/public`)).json();
  assert.equal(pub2.settings.featureFlags.flashcards, false);

  // 4. Re-enable → route works again (cache invalidated on write).
  const on = await fetch(`${BASE}/admin/settings`, putJson(auth, { featureFlags: { flashcards: true } }));
  assert.equal(on.status, 200);
  const decks2 = await fetch(`${BASE}/flashcards/decks`);
  assert.ok(decks2.status !== 503, 'flashcards route restored after re-enable');

  // 5. Non-admin cannot flip flags.
  const { token: userToken } = await registerUser('flag-user@test.com');
  const forbidden = await fetch(`${BASE}/admin/settings`, putJson({ Authorization: `Bearer ${userToken}` }, { featureFlags: { payments: false } }));
  assert.equal(forbidden.status, 403);
});

test('maintenance mode: enforced server-side with admin bypass and auth/settings exempt', async () => {
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };

  // Enable maintenance.
  const on = await fetch(`${BASE}/admin/settings`, putJson(auth, { security: { maintenanceMode: true } }));
  assert.equal(on.status, 200);

  // 1. Public routes (non-exempt) → 503.
  const qs = await fetch(`${BASE}/questions?limit=1`);
  assert.equal(qs.status, 503, 'normal API is blocked during maintenance');

  // 2. Auth still works (login required to reach admin).
  const loginAgain = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  assert.equal(loginAgain.status, 200, 'auth is exempt during maintenance');

  // 3. Public settings endpoint still reachable (frontend needs maintenance status).
  const pub = await fetch(`${BASE}/settings/public`);
  assert.equal(pub.status, 200, 'settings/public stays up during maintenance');
  const pubBody: any = await pub.json();
  assert.equal(pubBody.maintenance.enabled, true, 'public endpoint reports maintenance status');

  // 4. Admin bypass: admin endpoints keep working.
  const adminGet = await fetch(`${BASE}/admin/settings`, { headers: auth });
  assert.equal(adminGet.status, 200, 'admin bypass during maintenance');

  // 5. Disable maintenance → routes restored.
  const off = await fetch(`${BASE}/admin/settings`, putJson(auth, { security: { maintenanceMode: false } }));
  assert.equal(off.status, 200);
  const qs2 = await fetch(`${BASE}/questions?limit=1`);
  assert.ok(qs2.status !== 503, 'normal API restored after maintenance off');
});

test('settings history: audit snapshots + restore roundtrip', async () => {
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const postJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };

  // 1. Change branding to a known value.
  await fetch(`${BASE}/admin/settings`, putJson(auth, { branding: { primaryColor: '#123456', borderRadius: 6 } }));

  // 2. History shows the entry with a restorable old snapshot.
  const history: any = await (await fetch(`${BASE}/admin/settings/history`, { headers: auth })).json();
  assert.ok(history.logs.length > 0, 'history has entries');
  const updateEntry = history.logs.find(
    (l: any) => l.action === 'settings.update' && l.newValues?.branding?.primaryColor === '#123456'
  );
  assert.ok(updateEntry, 'update entry for our change is present');
  assert.ok(updateEntry.oldValues?.branding, 'entry carries the pre-change snapshot');

  // 3. Restore → branding returns to the pre-change value.
  const restoreRes = await fetch(`${BASE}/admin/settings/restore`, postJson(auth, { id: updateEntry.id }));
  assert.equal(restoreRes.status, 200);
  const restored: any = await restoreRes.json();
  assert.notEqual(restored.settings.branding.primaryColor, '#123456', 'restore reverted the change');
  assert.equal(typeof restored.settings.branding.primaryColor, 'string');

  // 4. Restore is audit-logged itself and non-admins cannot restore.
  const { token: userToken } = await registerUser('hist-user@test.com');
  const forbidden = await fetch(`${BASE}/admin/settings/restore`, postJson({ Authorization: `Bearer ${userToken}` }, { id: updateEntry.id }));
  assert.equal(forbidden.status, 403);
});

test('announcements: scheduling window, themes/priorities, and reusable template CRUD', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };
  const postJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  // 1. Create a scheduled announcement (starts tomorrow) + one live now.
  const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const past = new Date(Date.now() - 3600 * 1000).toISOString();
  const upcoming = await fetch(`${BASE}/announcements`, postJson(auth, {
    title: 'Scheduled', content: '<p>Not yet</p>', type: 'banner', theme: 'warning',
    priority: 'high', startsAt: future, isActive: true,
  }));
  assert.equal(upcoming.status, 201);
  const live = await fetch(`${BASE}/announcements`, postJson(auth, {
    title: 'Live Now', content: '<p>Hello</p>', type: 'toast', theme: 'success',
    priority: 'high', startsAt: past, isActive: true,
  }));
  assert.equal(live.status, 201);

  // 2. Active feed only returns the live one (scheduling enforced) and sorts high priority first.
  const { token: userToken } = await registerUser('ann-user@test.com');
  const userAuth = { Authorization: `Bearer ${userToken}` };
  const active: any = await (await fetch(`${BASE}/announcements/active`, { headers: userAuth })).json();
  const titles = active.announcements.map((a: any) => a.title);
  assert.ok(titles.includes('Live Now'), 'live announcement is served');
  assert.ok(!titles.includes('Scheduled'), 'future-dated announcement is not served');
  assert.equal(active.announcements[0].title, 'Live Now');

  // 3. Invalid theme/priority rejected.
  const bad = await fetch(`${BASE}/announcements`, postJson(auth, {
    title: 'X', content: '<p>Y</p>', type: 'banner', theme: 'neon',
  }));
  assert.equal(bad.status, 400);

  // 4. Template CRUD: create, list, use-prefill is client-side but server round-trips, update, delete.
  const tpl = await fetch(`${BASE}/announcements/templates`, postJson(auth, {
    name: 'Exam Alert', category: 'exam_alert', type: 'exam_alert', theme: 'error',
    title: 'Midterm coming up', content: '<p>Prepare now</p>', buttonText: 'Open',
  }));
  assert.equal(tpl.status, 201);
  const tplBody: any = await tpl.json();
  const tplId = tplBody.id;
  const list: any = await (await fetch(`${BASE}/announcements/templates`, { headers: auth })).json();
  assert.ok(list.templates.some((t: any) => t.id === tplId && t.category === 'exam_alert'), 'template listed');

  const upd = await fetch(`${BASE}/announcements/templates/${tplId}`, putJson(auth, { title: 'Midterm TOMORROW' }));
  assert.equal(upd.status, 200);
  const updBody: any = await upd.json();
  assert.equal(updBody.title, 'Midterm TOMORROW');

  const del = await fetch(`${BASE}/announcements/templates/${tplId}`, { method: 'DELETE', headers: auth });
  assert.equal(del.status, 200);

  // 5. Non-admin cannot create announcements or templates.
  const forbidden = await fetch(`${BASE}/announcements`, postJson(userAuth, { title: 'Nope', content: '<p>nope</p>' }));
  assert.equal(forbidden.status, 403);
  const tplForbidden = await fetch(`${BASE}/announcements/templates`, { headers: userAuth });
  assert.equal(tplForbidden.status, 403);
});

test('animation settings: validated roundtrip, public exposure, reduced-motion defaults', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.com', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };
  const putJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  // 1. Public endpoint exposes animation prefs (safe, not secret) with defaults.
  const pub: any = await (await fetch(`${BASE}/settings/public`)).json();
  assert.equal(pub.settings.animations.enabled, true, 'animations exposed publicly');
  assert.equal(pub.settings.animations.defaultEffect, 'fade');

  // 2. Update effect + duration; round-trips through the admin API.
  const put = await fetch(`${BASE}/admin/settings`, putJson(auth, {
    animations: { defaultEffect: 'bounce', durationMs: 900, repeat: 'infinite' },
  }));
  assert.equal(put.status, 200);
  const body: any = await put.json();
  assert.equal(body.settings.animations.defaultEffect, 'bounce');
  assert.equal(body.settings.animations.durationMs, 900);

  // 3. Public endpoint reflects the change.
  const pub2: any = await (await fetch(`${BASE}/settings/public`)).json();
  assert.equal(pub2.settings.animations.defaultEffect, 'bounce');

  // 4. Unknown effects and out-of-range values are rejected.
  const bad1 = await fetch(`${BASE}/admin/settings`, putJson(auth, { animations: { defaultEffect: 'spin' } }));
  assert.equal(bad1.status, 400);
  const bad2 = await fetch(`${BASE}/admin/settings`, putJson(auth, { animations: { durationMs: 99999 } }));
  assert.equal(bad2.status, 400);

  // 5. Non-admin cannot change animation settings.
  const { token: userToken } = await registerUser('anim-user@test.com');
  const forbidden = await fetch(`${BASE}/admin/settings`, putJson({ Authorization: `Bearer ${userToken}` }, { animations: { enabled: false } }));
  assert.equal(forbidden.status, 403);

  // 6. Restore defaults so the suite stays deterministic.
  await fetch(`${BASE}/admin/settings/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ group: 'animations' }),
  });
});
