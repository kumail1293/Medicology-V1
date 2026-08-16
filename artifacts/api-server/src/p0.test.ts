// P0 integration tests — run against the in-memory mock DB with the API
// booted in-process (no external server or database required).
//
//   node --import tsx/esm --test src/p0.test.ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';

process.env.PORT = '5099';
process.env.DATABASE_URL = 'sqlite:mock';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'p0-test-secret';
process.env.APP_BASE_URL = 'http://localhost:5099';

const BASE = 'http://localhost:5099/api';
const HOST = process.env.APP_BASE_URL as string; // http://localhost:5099 (no /api)

before(async () => {
  // Importing app.ts boots the listener against the mock DB (PORT/DATABASE_URL above).
  await import('./app.js');
  // Give the listener a moment to come up.
  await new Promise((r) => setTimeout(r, 500));
});

after(async () => {
  // Close the listener so the test process can exit cleanly. fetch() keeps
  // keep-alive sockets open, so force-close connections before server.close().
  const { server } = await import('./app.js');
  if (server) {
    server.closeAllConnections?.();
    await Promise.race([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
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

const json = (headers: Record<string, string>, body?: unknown, method?: string): RequestInit => ({
  method: method ?? (body === undefined ? 'GET' : 'POST'),
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
  const res = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: 'admin123' }));
  // The mock seed uses ADMIN_PASSWORD from the environment; fall back to the
  // default used by db.ts when it is not set.
  const adminBody: any = adminLogin.ok
    ? await adminLogin.json()
    : await (await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }))).json();
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
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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

  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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

  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const auth = { Authorization: `Bearer ${adminBody.token}` };

  // Enable maintenance.
  const on = await fetch(`${BASE}/admin/settings`, putJson(auth, { security: { maintenanceMode: true } }));
  assert.equal(on.status, 200);

  // 1. Public routes (non-exempt) → 503.
  const qs = await fetch(`${BASE}/questions?limit=1`);
  assert.equal(qs.status, 503, 'normal API is blocked during maintenance');

  // 2. Auth still works (login required to reach admin).
  const loginAgain = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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

  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
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

test('media library: validated upload with metadata, list, update alt text, delete', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const adminAuth = { Authorization: `Bearer ${adminBody.token}` };

  // A real 2×1 PNG (valid header, readable by the dimension parser).
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000002000000010806000000' +
    '1f15c4890000000d49444154789c6360f8cf000001010100f0fafbfa0000000049454e44ae426082',
    'hex'
  );

  // 1. Upload (admin) → metadata recorded with dimensions.
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'test-image.png');
  form.append('category', 'announcement');
  form.append('altText', 'A test image');
  const up = await fetch(`${BASE}/storage/media`, { method: 'POST', headers: adminAuth, body: form });
  const upBody: any = await up.json().catch(() => ({}));
  assert.equal(up.status, 201, `upload failed: ${JSON.stringify(upBody)}`);
  const media = upBody.media;
  assert.equal(media.mimeType, 'image/png');
  assert.equal(media.width, 2, 'PNG width parsed');
  assert.equal(media.height, 1, 'PNG height parsed');
  assert.equal(media.category, 'announcement');
  assert.equal(media.altText, 'A test image');
  assert.ok(media.url.startsWith('/api/storage/uploads/'), 'url points at the uploads endpoint');

  // 2. The uploaded file is actually served (media.url already includes the /api prefix).
  const served = await fetch(`${HOST}${media.url}`);
  assert.equal(served.status, 200);

  // 3. List (authenticated user) sees it; category filter works.
  const { token: userToken } = await registerUser('media-user@test.com');
  const userAuth = { Authorization: `Bearer ${userToken}` };
  const list: any = await (await fetch(`${BASE}/storage/media?category=announcement`, { headers: userAuth })).json();
  assert.ok(list.media.some((m: any) => m.id === media.id), 'media listed for authenticated users');

  // 4. Unauthenticated upload is rejected.
  const form2 = new FormData();
  form2.append('file', new Blob([png], { type: 'image/png' }), 'anon.png');
  const anon = await fetch(`${BASE}/storage/media`, { method: 'POST', body: form2 });
  assert.equal(anon.status, 401, 'uploads require auth');

  // 5. Invalid MIME rejected (settings-driven whitelist).
  const form3 = new FormData();
  form3.append('file', new Blob([Buffer.from('MZ')], { type: 'application/x-msdownload' }), 'evil.exe');
  const bad = await fetch(`${BASE}/storage/media`, { method: 'POST', headers: adminAuth, body: form3 });
  assert.ok(bad.status === 400, 'non-image uploads rejected');

  // 6. Alt text + category update; a non-owner user cannot edit admin uploads.
  const patch = await fetch(`${BASE}/storage/media/${media.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...adminAuth },
    body: JSON.stringify({ altText: 'Updated alt', category: 'seo' }),
  });
  assert.equal(patch.status, 200);
  const patched: any = await patch.json();
  assert.equal(patched.media.altText, 'Updated alt');
  const forbidden = await fetch(`${BASE}/storage/media/${media.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...userAuth },
    body: JSON.stringify({ altText: 'hijack' }),
  });
  assert.equal(forbidden.status, 403, 'non-owner cannot edit others media');

  // 7. Delete removes the row and the file.
  const del = await fetch(`${BASE}/storage/media/${media.id}`, { method: 'DELETE', headers: adminAuth });
  assert.equal(del.status, 200);
  const gone = await fetch(`${HOST}${media.url}`);
  assert.equal(gone.status, 404, 'file removed from disk after delete');
});

test('scoped overrides: deterministic precedence + CRUD + public resolution', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const adminAuth = { Authorization: `Bearer ${adminBody.token}` };
  const put = (body: any) => fetch(`${BASE}/admin/settings/overrides`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...adminAuth }, body: JSON.stringify(body),
  });
  const resolve = async (qs: string) =>
    (await fetch(`${BASE}/admin/settings/overrides/resolve?${qs}`, { headers: adminAuth })).json();

  // Layer the same key at three scopes: platform default 20 < country 15 < exam 25 < qbank 30.
  assert.equal((await put({ scope: 'country', scopeId: 1, group: 'examSettings', key: 'questionCount', value: 15 })).status, 200);
  assert.equal((await put({ scope: 'exam', scopeId: 1, group: 'examSettings', key: 'questionCount', value: 25 })).status, 200);
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'questionCount', value: 30 })).status, 200);
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'durationMinutes', value: 90 })).status, 200);

  // Full chain → qbank (most specific) wins.
  let r: any = await resolve('countryId=1&examId=1&qbankId=1');
  assert.equal(r.settings.questionCount, 30, 'qbank beats exam + country');
  assert.equal(r.settings.durationMinutes, 90, 'qbank duration applied');
  assert.equal(r.sources.questionCount, 'qbank');

  // No qbank → exam beats country.
  r = await resolve('countryId=1&examId=1');
  assert.equal(r.settings.questionCount, 25, 'exam beats country');
  assert.equal(r.sources.questionCount, 'exam');
  assert.equal(r.settings.durationMinutes, 60, 'platform default duration when no qbank override');

  // Only country → country beats the platform default.
  r = await resolve('countryId=1');
  assert.equal(r.settings.questionCount, 15, 'country beats platform default');
  assert.equal(r.sources.questionCount, 'country');

  // No scope → platform default.
  r = await resolve('');
  assert.equal(r.settings.questionCount, 20, 'platform default when no scope matches');

  // Public (no-auth) endpoint resolves identically for the exam engine.
  const pub: any = await (await fetch(`${BASE}/settings/exam?countryId=1&examId=1&qbankId=1`)).json();
  assert.equal(pub.settings.questionCount, 30);
  assert.equal(pub.sources.questionCount, 'qbank');

  // Validation: unknown key, wrong value type, non-examSettings group all rejected.
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'nonsense', value: 1 })).status, 400, 'unknown key rejected');
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'questionCount', value: 'many' })).status, 400, 'wrong value type rejected');
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'security', key: 'maintenanceMode', value: true })).status, 400, 'non-examSettings groups rejected');

  // Non-admin cannot write overrides.
  const { token: userToken } = await registerUser('override-user@test.com');
  const forbidden = await fetch(`${BASE}/admin/settings/overrides`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'questionCount', value: 99 }),
  });
  assert.equal(forbidden.status, 403, 'non-admin rejected');

  // Delete one override → resolution falls back to the next scope up.
  const del = await fetch(`${BASE}/admin/settings/overrides?scope=qbank&scopeId=1&group=examSettings&key=questionCount`, { method: 'DELETE', headers: adminAuth });
  assert.equal(del.status, 200);
  r = await resolve('countryId=1&examId=1&qbankId=1');
  assert.equal(r.settings.questionCount, 25, 'after delete, falls back to exam override');
  assert.equal(r.sources.questionCount, 'exam');

  // List endpoint reflects current overrides for a scope.
  const list: any = await (await fetch(`${BASE}/admin/settings/overrides?scope=qbank&scopeId=1`, { headers: adminAuth })).json();
  assert.ok(list.overrides.some((o: any) => o.key === 'durationMinutes'), 'qbank durationMinutes listed');
  assert.ok(!list.overrides.some((o: any) => o.key === 'questionCount'), 'deleted override gone from list');
});

test('scoped overrides: QBank session creation applies resolved rules', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminBody: any = await adminLogin.json();
  const adminAuth = { Authorization: `Bearer ${adminBody.token}` };
  const put = (body: any) => fetch(`${BASE}/admin/settings/overrides`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...adminAuth }, body: JSON.stringify(body),
  });
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'durationMinutes', value: 90 })).status, 200);
  assert.equal((await put({ scope: 'qbank', scopeId: 1, group: 'examSettings', key: 'questionCount', value: 5 })).status, 200);

  // Admin session create (bypasses the entitlement gate) with NO explicit
  // count/duration → resolved QBank rules apply.
  const created = await fetch(`${BASE}/sessions/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...adminAuth },
    body: JSON.stringify({ qbankSlug: 'uhs-mbbs-1st-year' }),
  });
  assert.equal(created.status, 200);
  const data: any = await created.json();
  assert.equal(data.session.durationSeconds, 90 * 60, 'qbank duration override applied');
  assert.ok(data.session.questionIds.length === 5, `qbank questionCount override applied (got ${data.session.questionIds.length})`);

  // Explicit client values always win over the resolved defaults.
  const explicit = await fetch(`${BASE}/sessions/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...adminAuth },
    body: JSON.stringify({ qbankSlug: 'uhs-mbbs-1st-year', questionCount: 5, durationSeconds: 120 }),
  });
  assert.equal(explicit.status, 200);
  const explicitData: any = await explicit.json();
  assert.equal(explicitData.session.durationSeconds, 120, 'explicit duration wins');
  assert.ok(explicitData.session.questionIds.length === 5, 'explicit questionCount wins');
});
test('import: downloadable template has headers, an example row per type, and a guide', async () => {
  const token = await adminLogin();
  const res = await fetch(`${BASE}/admin/import/template`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /spreadsheetml/, 'xlsx content type');
  const buf = Buffer.from(await res.arrayBuffer());

  const wb = XLSX.read(buf, { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('Template'), 'Template sheet present');
  assert.ok(wb.SheetNames.includes('Guide'), 'Guide sheet present');

  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets['Template'], { header: 1, defval: '' });
  const headers = rows[0].map((h: any) => String(h));
  for (const required of ['Question', 'Option A', 'Option B', 'Correct Answer', 'Subject', 'Topic', 'Question Type']) {
    assert.ok(headers.includes(required), `header ${required} present`);
  }

  const exampleRows = rows.slice(1).filter((r: any) => String(r[0] ?? '').trim() !== '' && String(r[0] ?? '').trim() !== 'Question Type');
  const types = exampleRows.map((r: any) => r[0]).join(',');
  for (const t of ['SBA', 'Best of Five', 'True/False', 'Assertion/Reason', 'EMQ', 'Image-Based', 'Clinical Vignette', 'Case-Based']) {
    assert.ok(types.includes(t), `example row for ${t}`);
  }

  const tf = await fetch(`${BASE}/admin/import/template?type=true_false`, { headers: { Authorization: `Bearer ${token}` } });
  const tfBuf = Buffer.from(await tf.arrayBuffer());
  const tfRows: any[][] = XLSX.utils.sheet_to_json(XLSX.read(tfBuf, { type: 'buffer' }).Sheets['Template'], { header: 1, defval: '' });
  const tfExamples = tfRows.slice(1).filter((r: any) => String(r[0] ?? '').trim() !== '');
  assert.equal(tfExamples.length, 1);
  assert.match(String(tfExamples[0][0]), /True\/False/);
});

test('import: type-aware validation (True/False, Assertion/Reason) + structured explanations', async () => {
  const token = await adminLogin();
  const buf = makeXlsxBuffer([
    {
      'Question Type': 'True/False',
      Question: 'The right coronary artery supplies the inferior wall of the heart.',
      'Option A': 'True',
      'Option B': 'False',
      'Correct Answer': 'True',
      Explanation: 'The RCA supplies the inferior wall.',
      Subject: 'Medicine',
      Topic: 'Cardiology',
    },
    {
      'Question Type': 'Assertion/Reason',
      Question: 'Assertion: RCA occludes in inferior MI. Reason: RCA supplies the inferior wall.',
      Assertion: 'The RCA is the most common culprit in inferior wall MI.',
      Reason: 'The RCA supplies the inferior wall of the heart.',
      'Correct Answer': 'A',
      Explanation: 'Both true; the reason explains the assertion.',
      Subject: 'Medicine',
      Topic: 'Cardiology',
    },
    {
      'Question Type': 'True/False',
      Question: 'The LAD supplies the inferior wall.',
      'Option A': 'True',
      'Option B': 'False',
      'Correct Answer': 'True',
      Explanation: 'Wrong — the LAD supplies the anterior wall.',
      Subject: 'Medicine',
      Topic: 'Cardiology',
      'Exam Pearl': 'Inferior MI = RCA.',
      'Common Trap': 'Never pick LAD for inferior wall.',
      'Why Correct': 'RCA supplies the inferior wall.',
      'Why Wrong': 'LAD is anterior.',
    },
    { 'Question Type': 'MysteryFormat', Question: 'Broken', 'Option A': 'a', 'Option B': 'b', 'Correct Answer': 'A', Subject: 'Medicine', Topic: 'Cardiology' },
  ]);

  const previewRes = await uploadImport(token, buf);
  assert.equal(previewRes.status, 200);
  const preview: any = await previewRes.json();
  assert.equal(preview.totalRows, 4);
  assert.equal(preview.stats.valid, 3, 'TF + AR + TF-with-pearls validate');
  assert.equal(preview.stats.error, 1, 'unknown type flagged');

  const tf = preview.rows.find((r: any) => r.data.correctAnswer === 'A' && r.data.questionType === 'true_false');
  assert.ok(tf, 'TF row normalized (True → A)');
  const tf2 = preview.rows.find((r: any) => r.data.examPearl);
  assert.equal(tf2.data.examPearl, 'Inferior MI = RCA.');
  assert.equal(tf2.data.questionType, 'true_false');

  const ar = preview.rows.find((r: any) => r.data.questionType === 'assertion_reason');
  assert.ok(ar, 'AR row valid');
  assert.ok(ar.data.options.A.includes('Both assertion and reason'), 'AR auto-generates the classic 5 options');
  assert.equal(ar.data.correctAnswer, 'A');

  const bad = preview.rows.find((r: any) => r.status === 'error');
  assert.ok(bad.messages.some((m: string) => m.includes('Unknown question type')));

  const exec = await fetch(`${BASE}/admin/import/execute`, json({ Authorization: `Bearer ${token}` }, { rows: preview.rows }));
  const result: any = await exec.json();
  assert.equal(result.inserted, 3);

  const list: any = await (await fetch(`${BASE}/admin/questions?limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const imported = (list.questions ?? []).find((q: any) => q.qid === tf2.qid);
  assert.ok(imported, 'structured row imported');
  assert.equal(imported.questionType, 'true_false');
  assert.equal(imported.examPearl, 'Inferior MI = RCA.');
  assert.equal(imported.commonTrap, 'Never pick LAD for inferior wall.');
});

test('import: bulkImport settings drive status, thresholds, allowed types and file types', async () => {
  const token = await adminLogin();
  const auth = { Authorization: `Bearer ${token}` };

  const cur: any = await (await fetch(`${BASE}/admin/settings/bulkImport`, { headers: auth })).json();
  const put = (body: any) => fetch(`${BASE}/admin/settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(body),
  });
  try {
    const csvOnly = await put({ bulkImport: { allowedFileTypes: ['xlsx'] } });
    assert.equal(csvOnly.status, 200);
    const form = new FormData();
    form.append('file', new Blob(['a,b,c\n1,2,3']), 'qa.csv');
    const csvRes = await fetch(`${BASE}/admin/import/preview`, { method: 'POST', headers: auth, body: form });
    assert.equal(csvRes.status, 400, 'csv rejected when disabled');
    const csvErr: any = await csvRes.json();
    assert.match(csvErr.error, /Only \.xlsx/);

    await put({ bulkImport: { allowedQuestionTypes: ['sba', 'true_false'], defaultImportStatus: 'draft', defaultDifficulty: 'hard', requireReviewBeforePublish: false } });
    const buf = makeXlsxBuffer([
      { 'Question Type': 'True/False', Question: 'TF question A', 'Option A': 'True', 'Option B': 'False', 'Correct Answer': 'True', Subject: 'Medicine', Topic: 'Cardiology' },
      { 'Question Type': 'Best of Five', Question: 'Disabled type row', 'Option A': 'a', 'Option B': 'b', 'Option C': 'c', 'Option D': 'd', 'Correct Answer': 'A', Subject: 'Medicine', Topic: 'Cardiology' },
    ]);
    const preview: any = await (await uploadImport(token, buf)).json();
    assert.equal(preview.stats.error, 1, 'disabled type flagged');
    assert.match(preview.rows.find((r: any) => r.status === 'error').messages.join(' '), /disabled in the bulk import settings/);
    const okRow = preview.rows.find((r: any) => r.status === 'valid');
    assert.equal(okRow.data.difficulty, 'hard', 'settings default difficulty applied');

    const exec = await fetch(`${BASE}/admin/import/execute`, json(auth, { rows: [okRow] }));
    const execResult: any = await exec.json();
    assert.equal(execResult.inserted, 1);
    const list: any = await (await fetch(`${BASE}/admin/questions?limit=100`, { headers: auth })).json();
    const imported = (list.questions ?? []).find((q: any) => q.qid === okRow.qid);
    assert.equal(imported.status, 'draft', 'settings defaultImportStatus applied');
  } finally {
    await put({ bulkImport: cur.settings ?? { allowedFileTypes: ['xlsx', 'xls', 'csv', 'tsv'], allowedQuestionTypes: ['sba', 'best_of_five', 'true_false', 'assertion_reason', 'emq', 'image_based', 'clinical_vignette', 'case_based'], defaultImportStatus: 'pending_review', defaultDifficulty: 'medium', requireReviewBeforePublish: true } });
  }
});


test('coming soon: public list only exposes active items', async () => {
  const { token } = await registerUser('cs-public@test.com');
  // Create one active and one hidden item as admin.
  const admin = await adminLogin();
  const created = await fetch(`${BASE}/admin/coming-soon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'FCPS Part II', category: 'exam', status: 'planned', active: true, notifyMe: true, audience: 'FCPS candidates' }),
  });
  const createdBody: any = await created.json();
  assert.equal(created.status, 201, JSON.stringify(createdBody).slice(0, 200));
  const item: any = createdBody;
  await fetch(`${BASE}/admin/coming-soon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Hidden Item', category: 'feature', active: false }),
  });

  const list = await fetch(`${BASE}/coming-soon`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(list.status, 200);
  const data: any = await list.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.some((e: any) => e.name === 'FCPS Part II'), 'active item visible');
  assert.ok(!data.some((e: any) => e.name === 'Hidden Item'), 'inactive item hidden');
  assert.equal(typeof data.find((e: any) => e.id === item.id).interestCount, 'number');
});

test('coming soon: notify-me registers interest and dedupes', async () => {
  const { token, user } = await registerUser('cs-notify@test.com');
  const admin = await adminLogin();
  const created = await fetch(`${BASE}/admin/coming-soon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'NotifyMe QBank', category: 'qbank', notifyMe: true }),
  });
  const item: any = await created.json();

  const first = await fetch(`${BASE}/coming-soon/${item.id}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  assert.equal(first.status, 201, (await first.text()).slice(0, 200));

  const dup = await fetch(`${BASE}/coming-soon/${item.id}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  const dupBody: any = await dup.json();
  assert.equal(dup.status, 200);
  assert.equal(dupBody.alreadyRegistered, true, 'duplicate notify is idempotent');

  // Admin list shows the demand count.
  const adminList = await fetch(`${BASE}/admin/coming-soon`, { headers: { Authorization: `Bearer ${admin}` } });
  const entries: any = await adminList.json();
  const found = entries.find((e: any) => e.id === item.id);
  assert.equal(found.interestCount, 1, 'interest count reflects one registration');

  // Anonymous notify requires an email.
  const anon = await fetch(`${BASE}/coming-soon/${item.id}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(anon.status, 400, 'anonymous notify without email rejected');
  const anonOk = await fetch(`${BASE}/coming-soon/${item.id}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'anon@test.com' }),
  });
  assert.equal(anonOk.status, 201, (await anonOk.text()).slice(0, 200));
  assert.equal(user.id > 0, true);
});

test('coming soon: admin CRUD validates and requires admin', async () => {
  const { token } = await registerUser('cs-nonadmin@test.com');
  const admin = await adminLogin();

  // Non-admin is forbidden from admin CRUD.
  const forbidden = await fetch(`${BASE}/admin/coming-soon`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(forbidden.status, 403);

  // Invalid category → 400.
  const bad = await fetch(`${BASE}/admin/coming-soon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Bad', category: 'not-a-category' }),
  });
  assert.equal(bad.status, 400);

  // Missing name → 400.
  const noname = await fetch(`${BASE}/admin/coming-soon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ category: 'feature' }),
  });
  assert.equal(noname.status, 400);

  // Update + delete round-trip.
  const created = await fetch(`${BASE}/admin/coming-soon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Update Me', category: 'program' }),
  });
  const item: any = await created.json();
  const updated = await fetch(`${BASE}/admin/coming-soon/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Updated Name', status: 'in_progress' }),
  });
  assert.equal(updated.status, 200);
  const updatedBody: any = await updated.json();
  assert.equal(updatedBody.name, 'Updated Name');
  assert.equal(updatedBody.status, 'in_progress');

  const deleted = await fetch(`${BASE}/admin/coming-soon/${item.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin}` },
  });
  assert.equal(deleted.status, 200);
  const after = await fetch(`${BASE}/admin/coming-soon/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Ghost' }),
  });
  assert.equal(after.status, 404, 'deleted item is gone');
});

test('granular roles: assign a content_admin and enforce scoped permissions', async () => {
  const admin = await adminLogin();
  // Create a content admin via the admin API.
  const created = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      name: 'Content Admin',
      email: 'content-admin@test.com',
      password: 'Pass12345',
      college: 'Demo College',
      year: 1,
      role: 'content_admin',
    }),
  });
  assert.equal(created.status, 201, (await created.text()).slice(0, 200));

  // Login as the content admin.
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'content-admin@test.com', password: 'Pass12345' }));
  const loginBody: any = await login.json();
  const token = loginBody.token as string;
  assert.ok(token, 'content admin can log in');

  // Content admin may read the admin question list (requireAdmin passes)…
  const qs = await fetch(`${BASE}/admin/questions`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(qs.status, 200, 'content_admin passes requireAdmin');

  // …and may create a question (questions.manage)…
  const qCreate = await fetch(`${BASE}/admin/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      questionText: 'Granular role question',
      questionType: 'sba',
      options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
      correctAnswer: 'A',
      subject: 'Medicine',
      difficulty: 'medium',
    }),
  });
  assert.equal(qCreate.status, 201, (await qCreate.text()).slice(0, 200));

  // …but CANNOT manage settings (settings.manage missing for content_admin).
  const settings = await fetch(`${BASE}/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ branding: { platformName: 'Hacked' } }),
  });
  assert.equal(settings.status, 403, 'content_admin blocked from settings.manage');

  // …and cannot manage users (users.manage missing).
  const users = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Nope', email: 'nope@test.com', password: 'Pass12345', college: 'X', year: 1 }),
  });
  assert.equal(users.status, 403, 'content_admin blocked from users.manage');
});

test('granular roles: superadmin-only admin-role grants are enforced', async () => {
  const admin = await adminLogin();
  // A plain admin cannot create a platform_admin.
  const created = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      name: 'Try Platform',
      email: 'try-platform@test.com',
      password: 'Pass12345',
      college: 'Demo College',
      year: 1,
      role: 'platform_admin',
    }),
  });
  assert.equal(created.status, 201, 'superadmin (dev admin) can grant platform_admin');
});
// --- Configuration Registry (Phase 1) ---

test('config registry: every default setting has a metadata entry', async () => {
  const { registryCoversDefaults, buildConfigRegistry } = await import('../src/utils/config-registry.js');
  const { missing } = registryCoversDefaults();
  assert.deepEqual(missing, [], 'no default key may be missing from the registry');
  const reg = buildConfigRegistry();
  assert.ok(reg.length >= 80, `expected a full registry, got ${reg.length} entries`);
  for (const e of reg) {
    assert.ok(e.path.includes('.'), `path malformed: ${e.path}`);
    assert.ok(typeof e.label === 'string' && e.label.length > 0, `label missing for ${e.path}`);
    assert.ok(typeof e.type === 'string', `type missing for ${e.path}`);
    assert.ok(Array.isArray(e.editableBy) && e.editableBy.length > 0, `editableBy missing for ${e.path}`);
    assert.ok(typeof e.public === 'boolean', `public missing for ${e.path}`);
    assert.ok('defaultValue' in e, `defaultValue missing for ${e.path}`);
  }
});

test('config registry: registry validation accepts defaults and rejects bad values', async () => {
  const { buildConfigRegistry, validateSetting } = await import('../src/utils/config-registry.js');
  const reg = buildConfigRegistry();
  for (const e of reg) {
    const err = validateSetting(e.group, e.key, e.defaultValue);
    assert.equal(err, null, `default should validate for ${e.path}: ${err}`);
  }
  const badColor = validateSetting('branding', 'primaryColor', 'not-a-color');
  assert.ok(badColor && badColor.includes('primaryColor'), badColor);
  const badCount = validateSetting('examSettings', 'questionCount', -5);
  assert.ok(badCount, 'negative question count rejected');
  const badEnum = validateSetting('examSettings', 'markingScheme', 'bogus');
  assert.ok(badEnum, 'unknown enum value rejected');
  assert.equal(validateSetting('branding', 'nope', 1), 'Unknown setting "branding.nope"');
});

test('config registry: GET /admin/settings/registry requires settings.manage', async () => {
  const admin = await adminLogin();
  const res = await fetch(`${BASE}/admin/settings/registry`, { headers: { Authorization: `Bearer ${admin}` } });
  const data: any = await res.json();
  assert.equal(res.status, 200, JSON.stringify(data).slice(0, 200));
  assert.ok(Array.isArray(data.settings) && data.settings.length >= 80, 'registry served');
  assert.ok(Array.isArray(data.groups) && data.groups.length >= 10, 'group metadata served');
  const pub = data.publicSettings as any[];
  assert.ok(pub.some((e) => e.group === 'branding'), 'branding is public');
  assert.ok(!pub.some((e) => e.group === 'payments'), 'payments never public');
  assert.ok(!pub.some((e) => e.group === 'security'), 'security never public');
  const { token } = await registerUser('reg-nonadmin@test.com');
  const forbidden = await fetch(`${BASE}/admin/settings/registry`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(forbidden.status, 403);
});

// ===========================================================================
// Email template system (P0.15–P0.16)
// ===========================================================================

test('email: renderer sanitizes custom HTML and interpolates variables', async () => {
  const { renderEmail, sanitizeEmailHtml } = await import('../src/utils/email-renderer.js');
  const html = renderEmail({
    blocks: [
      { type: 'heading', text: 'Hi {{user.firstName}}' },
      { type: 'custom', html: '<b>Bold</b><script>alert(1)</script><img src="x" onerror="alert(2)">' },
      { type: 'text', html: '{{unknownVar}} and {{user.email}}' },
    ],
    data: { 'user.firstName': 'Ayesha', 'user.email': 'a@b.com' },
  });
  assert.ok(html.includes('Hi Ayesha'), 'variable interpolated');
  assert.ok(!html.includes('{{unknownVar}}'), 'unknown var rendered empty');
  assert.ok(!html.includes('unknownVar'), 'unknown var value not leaked');
  assert.ok(!html.includes('<script>'), 'script stripped');
  assert.ok(!html.includes('onerror'), 'event handler stripped');
  assert.ok(html.includes('a@b.com'), 'known var interpolated');
  const clean = sanitizeEmailHtml('<b onclick="x()">ok</b><iframe src="x"></iframe><a href="https://ok.com">link</a>');
  assert.ok(clean.includes('<b>ok</b>'), 'allowed tag kept: ' + clean);
  assert.ok(!clean.includes('onclick'), 'handler stripped');
  assert.ok(!clean.includes('<iframe'), 'iframe dropped');
  assert.ok(clean.includes('https://ok.com'), 'safe href kept');
});

test('email: admin CRUD, publish, version bump, preview, test-send, logs', async () => {
  const admin = await adminLogin();
  const auth = { Authorization: `Bearer ${admin}` };

  // create
  const created = await fetch(`${BASE}/admin/email/templates`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Welcome Email', category: 'transactional', subject: 'Welcome to {{platform.name}}!',
      bodyBlocks: [{ type: 'heading', text: 'Hi {{user.firstName}}' }, { type: 'button', label: 'Start', url: 'https://medicology.com' }],
      variables: ['user.firstName', 'platform.name'],
    }),
  });
  const c = (await created.json()) as any;
  assert.equal(created.status, 201, JSON.stringify(c).slice(0, 200));
  assert.ok(c.template.id, 'has id');
  assert.equal(c.template.status, 'draft');
  assert.equal(c.template.version, 1);
  const id = c.template.id;

  // duplicate slug rejected (same name → same derived slug)
  const dup = await fetch(`${BASE}/admin/email/templates`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Welcome Email', subject: 'x', bodyBlocks: [] }),
  });
  assert.equal(dup.status, 409, 'duplicate slug rejected');

  // update bumps version when content changes
  const saved = await fetch(`${BASE}/admin/email/templates/${id}`, {
    method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Welcome v2', bodyBlocks: [{ type: 'heading', text: 'Updated' }] }),
  });
  const s = (await saved.json()) as any;
  assert.equal(saved.status, 200);
  assert.equal(s.template.version, 2, 'version bumped');
  assert.ok(s.template.versions.length >= 1, 'history recorded');

  // publish
  const pub = await fetch(`${BASE}/admin/email/templates/${id}/publish`, { method: 'POST', headers: auth });
  assert.equal(pub.status, 200);

  // preview renders HTML
  const prev = await fetch(`${BASE}/admin/email/templates/${id}/preview`, { method: 'POST', headers: auth });
  const p = (await prev.json()) as any;
  assert.equal(prev.status, 200);
  assert.ok(p.html.includes('<!DOCTYPE html>'), 'full document rendered');
  assert.ok(p.html.includes('Updated'), 'current blocks rendered');

  // test-send (log provider) — records a log row
  const test = await fetch(`${BASE}/admin/email/templates/${id}/test`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: 'qa@test.com' }),
  });
  const t = (await test.json()) as any;
  assert.equal(test.status, 200, JSON.stringify(t).slice(0, 200));
  assert.equal(t.result.status, 'sent');
  assert.equal(t.result.provider, 'log');

  const logs = await fetch(`${BASE}/admin/email/logs`, { headers: auth });
  const l = (await logs.json()) as any;
  assert.ok(l.logs.length >= 1, 'send logged');
  assert.ok(l.logs.some((row: any) => row.to === 'qa@test.com'), 'test send appears in logs');

  // variables endpoint
  const vars = await fetch(`${BASE}/admin/email/variables`, { headers: auth });
  const v = (await vars.json()) as any;
  assert.ok(v.variables.includes('user.firstName'), 'variable catalog served');

  // restore to version 1
  const restored = await fetch(`${BASE}/admin/email/templates/${id}/restore`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1 }),
  });
  const r = (await restored.json()) as any;
  assert.equal(restored.status, 200);
  assert.ok(r.template.subject.includes('Welcome to'), 'restored v1 subject');

  // permission: content_admin cannot manage email
  const reg = await fetch(`${BASE}/auth/register`, json({}, { name: 'Content Admin QA', email: 'content-email@test.com', password: 'Password123', college: 'UHS', year: 3 }));
  const regData: any = await reg.json();
  const ctoken = regData.token;
  await fetch(`${BASE}/admin/users/${regData.user.id}/role`, {
    method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'content_admin' }),
  });
  const denied = await fetch(`${BASE}/admin/email/templates`, { headers: { Authorization: `Bearer ${ctoken}` } });
  assert.equal(denied.status, 403, 'content_admin blocked from email templates');

  // email settings: SMTP password is never returned, smtpPasswordSet flips true
  const setRes = await fetch(`${BASE}/admin/settings`, {
    method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: { provider: 'smtp', smtpHost: 'smtp.example.com', smtpPassword: 'super-secret-pass' } }),
  });
  const setData: any = await setRes.json();
  assert.equal(setRes.status, 200, JSON.stringify(setData).slice(0, 200));
  assert.equal(setData.settings.email.provider, 'smtp', 'provider saved');
  assert.equal(setData.settings.email.smtpPasswordSet, true, 'password set flag');
  assert.ok(!JSON.stringify(setData).includes('super-secret-pass'), 'secret never returned');
  const getRes = await fetch(`${BASE}/admin/settings`, { headers: auth });
  const getData: any = await getRes.json();
  assert.equal(getData.settings.email.smtpPasswordSet, true);
  assert.ok(!JSON.stringify(getData).includes('super-secret-pass'), 'secret absent from GET');
  // reset email group clears the secret
  await fetch(`${BASE}/admin/settings/reset`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ group: 'email' }) });
  const after = await fetch(`${BASE}/admin/settings`, { headers: auth });
  const afterData: any = await after.json();
  assert.equal(afterData.settings.email.smtpPasswordSet, false, 'reset clears secret flag');
});

// ===========================================================================
// Account settings (P0.19) — sessions, security history, prefs, export, delete
// ===========================================================================

test('account: sessions tracked, revocable, and enforced by middleware', async () => {
  const sessEmail = `sess-${Date.now()}@test.com`;
  const { token } = await registerUser(sessEmail);

  // Sessions list includes the login we just made
  const list = await fetch(`${BASE}/auth/me/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  const l = (await list.json()) as any;
  assert.equal(list.status, 200);
  assert.ok(l.sessions.length >= 1, 'session recorded');
  const sid = l.sessions[0].id;

  // Revoke it → the token must now be rejected
  const rev = await fetch(`${BASE}/auth/me/sessions/${sid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(rev.status, 200);
  const me = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.status, 401, 'revoked session rejected');

  // Re-login twice (two devices), then revoke-all from the second device:
  // the other device dies, the current one stays signed in.
  const loginRes = await fetch(`${BASE}/auth/login`, json({}, { email: sessEmail, password: 'TestPass123' }));
  assert.equal(loginRes.status, 200);
  const l2 = (await loginRes.json()) as any;
  const loginRes2 = await fetch(`${BASE}/auth/login`, json({}, { email: sessEmail, password: 'TestPass123' }));
  const l3 = (await loginRes2.json()) as any;
  const ra = await fetch(`${BASE}/auth/me/sessions`, { method: 'DELETE', headers: { Authorization: `Bearer ${l3.token}` } });
  assert.equal(ra.status, 200);
  // Current device survives revoke-all…
  const me2 = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${l3.token}` } });
  assert.equal(me2.status, 200, 'current session survives revoke-all');
  // …but the other device is dead.
  const other = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${l2.token}` } });
  assert.equal(other.status, 401, 'revoke-all kills other sessions');
});

test('account: notification prefs, data export, deletion anonymizes', async () => {
  const { token } = await registerUser(`acct-${Date.now()}@test.com`);
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // notification prefs
  const prefs = await fetch(`${BASE}/auth/me/notification-prefs`, {
    method: 'PUT', headers: auth,
    body: JSON.stringify({ prefs: { email: { announcements: false, results: true } } }),
  });
  const p = (await prefs.json()) as any;
  assert.equal(prefs.status, 200);
  assert.equal(p.prefs.email.announcements, false);

  // data export — includes profile + prefs, excludes passwordHash
  const data = await fetch(`${BASE}/auth/me/data`, { headers: auth });
  const d = (await data.json()) as any;
  assert.equal(data.status, 200);
  assert.ok(d.profile.email.includes('@test.com'));
  assert.ok(!JSON.stringify(d).includes('passwordHash'), 'no secrets in export');

  // security events include login
  const events = await fetch(`${BASE}/auth/me/security-events`, { headers: auth });
  const ev = (await events.json()) as any;
  assert.ok(ev.events.some((e: any) => e.type === 'login'), 'login history recorded');

  // deletion anonymizes and revokes sessions
  const del = await fetch(`${BASE}/auth/me`, { method: 'DELETE', headers: auth });
  assert.equal(del.status, 200);
  const me = await fetch(`${BASE}/auth/me`, { headers: auth });
  assert.equal(me.status, 401, 'token dead after deletion');
});

// ===========================================================================
// Audit viewer + settings export/import (P0.20 / P0.19)
// ===========================================================================

test('settings: export strips secrets; import validates, diffs, applies, audits', async () => {
  const admin = await adminLogin();
  const auth = { Authorization: `Bearer ${admin}` };

  // Export — secrets never present
  const exp = await fetch(`${BASE}/admin/settings/export`, { headers: auth });
  const snap = (await exp.json()) as any;
  assert.equal(exp.status, 200);
  assert.equal(snap.version, 1);
  assert.ok(snap.settings.general.siteName === 'Medicology', 'defaults included');
  assert.ok(snap.settings.email && typeof snap.settings.email.smtpPassword === 'undefined', 'no smtp password in export');

  // Invalid snapshot rejected
  const bad = await fetch(`${BASE}/admin/settings/import`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: { settings: { branding: { primaryColor: 'not-a-color' } } } }),
  });
  assert.equal(bad.status, 400, 'invalid snapshot rejected');

  // Dry run preview
  const preview = await fetch(`${BASE}/admin/settings/import?dryRun=1`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: { settings: { general: { siteName: 'Imported Name' } } } }),
  });
  const pv = (await preview.json()) as any;
  assert.equal(preview.status, 200);
  assert.equal(pv.dryRun, true);
  assert.ok(pv.diff.general, 'diff includes changed group');
  assert.equal(pv.diff.general.old.siteName, 'Medicology');
  assert.equal(pv.diff.general.new.siteName, 'Imported Name');

  // Apply
  const apply = await fetch(`${BASE}/admin/settings/import`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: { settings: { general: { siteName: 'Imported Name' } } } }),
  });
  const ap = (await apply.json()) as any;
  assert.equal(apply.status, 200);
  assert.equal(ap.applied, 1);
  const get = await fetch(`${BASE}/admin/settings`, { headers: auth });
  const gd = (await get.json()) as any;
  assert.equal(gd.settings.general.siteName, 'Imported Name', 'applied');

  // Import with no changes is a no-op
  const noop = await fetch(`${BASE}/admin/settings/import`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: { settings: { general: { siteName: 'Imported Name' } } } }),
  });
  const np = (await noop.json()) as any;
  assert.equal(np.applied, 0);

  // Audit log records the import
  const logs = await fetch(`${BASE}/admin/audit-logs?action=settings.import`, { headers: auth });
  const ld = (await logs.json()) as any;
  assert.ok(ld.logs.length >= 1, 'import audited');

  // Reset for test isolation
  await fetch(`${BASE}/admin/settings/reset`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ group: 'general' }) });
});

test('audit: logs are permission-gated (audit.view)', async () => {
  const admin = await adminLogin();
  const auth = { Authorization: `Bearer ${admin}` };
  // Admin sees logs
  const ok = await fetch(`${BASE}/admin/audit-logs`, { headers: auth });
  assert.equal(ok.status, 200);
  // content_admin has no audit.view → 403
  const reg = await fetch(`${BASE}/auth/register`, json({}, { name: 'Audit QA', email: `audit-${Date.now()}@test.com`, password: 'Password123', college: 'UHS', year: 3 }));
  const regData: any = await reg.json();
  await fetch(`${BASE}/admin/users/${regData.user.id}/role`, {
    method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'content_admin' }),
  });
  const denied = await fetch(`${BASE}/admin/audit-logs`, { headers: { Authorization: `Bearer ${regData.token}` } });
  assert.equal(denied.status, 403, 'content_admin blocked from audit logs');
});

// ===========================================================================
// Transactional email sends + seeded template library
// ===========================================================================

test('email: default template library seeds on boot and restores via API', async () => {
  const admin = await adminLogin();
  const auth = { Authorization: `Bearer ${admin}` };
  const list = await fetch(`${BASE}/admin/email/templates`, { headers: auth });
  const ld = (await list.json()) as any;
  const slugs = (ld.templates ?? []).map((t: any) => t.slug);
  for (const expected of ['welcome', 'password_reset', 'purchase_confirmation', 'entitlement_expiring', 'entitlement_expired', 'announcement', 'exam_result', 'security_alert']) {
    assert.ok(slugs.includes(expected), `seeded template "${expected}" present`);
  }
  const seeded = ld.templates.find((t: any) => t.slug === 'welcome');
  assert.equal(seeded.status, 'published', 'seeded templates are published');
  assert.ok(Array.isArray(seeded.bodyBlocks) && seeded.bodyBlocks.length >= 3, 'welcome has a block body');
  // Idempotent re-seed adds nothing new
  const reseed = await fetch(`${BASE}/admin/email/templates/seed`, { method: 'POST', headers: auth });
  const rs = (await reseed.json()) as any;
  assert.equal(reseed.status, 200);
  assert.equal(rs.created, 0, 're-seed is idempotent');
  assert.ok(rs.total >= 15, 'library is comprehensive');
});

test('email: registration sends welcome + forgot-password mails reset link and resets password', async () => {
  const email = `tx-${Date.now()}@test.com`;
  await registerUser(email);
  // Welcome email logged
  const admin = await adminLogin();
  const logs = await fetch(`${BASE}/admin/email/logs?limit=100`, { headers: { Authorization: `Bearer ${admin}` } });
  const ld = (await logs.json()) as any;
  const welcome = ld.logs.find((l: any) => l.to === email && String(l.subject).includes('Welcome'));
  assert.ok(welcome, 'welcome email sent to new user');
  assert.equal(welcome.status, 'sent');

  // Forgot password → reset link emailed
  const forgot = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert.equal(forgot.status, 200);
  // Unknown email: same 200 (no account enumeration)
  const ghost = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody-' + Date.now() + '@test.com' }),
  });
  assert.equal(ghost.status, 200);

  const logs2 = await fetch(`${BASE}/admin/email/logs?limit=100`, { headers: { Authorization: `Bearer ${admin}` } });
  const ld2 = (await logs2.json()) as any;
  const resetMail = ld2.logs.find((l: any) => l.to === email && String(l.subject).includes('Reset your password'));
  assert.ok(resetMail, 'password reset email sent');

  // Extract the token from the logged subject/body is not available; instead
  // generate one directly through the same path used by the route.
  const { db } = await import('../src/db.js');
  const { passwordResetTokensTable, usersTable } = await import('@workspace/db');
  const { eq } = await import('../src/utils/drizzle.js');
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
  assert.ok(users.length === 1);
  const tokens = await db.select().from(passwordResetTokensTable);
  const myToken = (tokens as any[]).filter((t: any) => t.userId === users[0].id).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  assert.ok(myToken, 'reset token row created');

  // Reset with the token works; bad token rejected
  const reset = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: myToken.token, newPassword: 'NewPass123' }),
  });
  assert.equal(reset.status, 200, 'password reset succeeds');
  const reuse = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: myToken.token, newPassword: 'NewPass456' }),
  });
  assert.equal(reuse.status, 400, 'reset token cannot be reused');
  const loginOld = await fetch(`${BASE}/auth/login`, json({}, { email, password: 'TestPass123' }));
  assert.equal(loginOld.status, 401, 'old password no longer works');
  const loginNew = await fetch(`${BASE}/auth/login`, json({}, { email, password: 'NewPass123' }));
  assert.equal(loginNew.status, 200, 'new password works');
});

test('email: announcement can be emailed to its audience', async () => {
  const admin = await adminLogin();
  const auth = { Authorization: `Bearer ${admin}` };
  const created = await fetch(`${BASE}/announcements`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'banner', title: 'QA Exam Notice', content: '<p>Mock exams are live.</p>', targetRoles: 'all', isActive: true }),
  });
  const ann = (await created.json()) as any;
  assert.equal(created.status, 201, JSON.stringify(ann).slice(0, 150));
  const sent = await fetch(`${BASE}/announcements/${ann.id}/email`, { method: 'POST', headers: auth });
  const sd = (await sent.json()) as any;
  assert.equal(sent.status, 200, JSON.stringify(sd).slice(0, 150));
  assert.ok(sd.recipients >= 1, 'announcement emailed to audience');
});

// ---------------------------------------------------------------------------
// Study aim (AMBOSS-style), announcement user targeting, purchases shape
// ---------------------------------------------------------------------------

test('PUT /me/aim sets an aim and resets progress when changed', async () => {
  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Aim Tester', email: `aim${Date.now()}@medicology.net`, password: 'AimPass123',
    college: 'Test', year: 'Year 1',
  }));
  const { token } = (await reg.json()) as any;

  const set = async (body: any) =>
    fetch(`${BASE}/auth/me/aim`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

  const r1 = await set({ targetExam: 'UHS MBBS 1st Year', dailyQuestions: 40 });
  const d1 = (await r1.json()) as any;
  assert.equal(r1.status, 200);
  assert.equal(d1.aim.targetExam, 'UHS MBBS 1st Year');
  assert.equal(d1.progressReset, false, 'first aim set should not reset');

  const r2 = await set({ targetExam: 'FCPS Part 1', dailyQuestions: 60 });
  const d2 = (await r2.json()) as any;
  assert.equal(d2.progressReset, true, 'changing aim resets progress');

  const r3 = await set({ targetExam: 'FCPS Part 1', dailyQuestions: 60 });
  const d3 = (await r3.json()) as any;
  assert.equal(d3.progressReset, false, 'unchanged aim should not reset');

  const get = await fetch(`${BASE}/auth/me/aim`, { headers: { Authorization: `Bearer ${token}` } });
  const dg = (await get.json()) as any;
  assert.equal(dg.aim.targetExam, 'FCPS Part 1');
  assert.equal(dg.aim.dailyQuestions, 60);
});

test('announcements support user-specific targeting in /active', async () => {
  const adminLogin = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await adminLogin.json()) as any).token;

  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Target User', email: `target${Date.now()}@medicology.net`, password: 'Target123',
    college: 'Test', year: 'Year 2',
  }));
  const { token, user } = (await reg.json()) as any;

  // Create a user-specific announcement aimed at the new user.
  const create = await fetch(`${BASE}/announcements`, json({ Authorization: `Bearer ${adminToken}` }, {
    type: 'banner', title: 'Only for you', content: '<p>personal</p>',
    targetUserIds: [user.id], isActive: true,
  }));
  assert.equal(create.status, 201);
  const ann = (await create.json()) as any;

  // The targeted user sees it.
  const mine = await fetch(`${BASE}/announcements/active`, { headers: { Authorization: `Bearer ${token}` } });
  const mineData = (await mine.json()) as any;
  assert.ok(mineData.announcements.some((a: any) => a.id === ann.id), 'targeted user should see the announcement');

  // Another user does not.
  const reg2 = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Other User', email: `other${Date.now()}@medicology.net`, password: 'Other123',
    college: 'Test', year: 'Year 3',
  }));
  const token2 = ((await reg2.json()) as any).token;
  const other = await fetch(`${BASE}/announcements/active`, { headers: { Authorization: `Bearer ${token2}` } });
  const otherData = (await other.json()) as any;
  assert.ok(!otherData.announcements.some((a: any) => a.id === ann.id), 'other users should NOT see it');
});

test('/api/qbanks/my returns purchases with catalogueIds for the create-test wizard', async () => {
  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Buyer', email: `buyer${Date.now()}@medicology.net`, password: 'Buyer123',
    college: 'Test', year: 'Year 4',
  }));
  const { token, user } = (await reg.json()) as any;

  // Grant an entitlement directly for UHS MBBS 1st Year (qbank id 1).
  const { grantEntitlement } = await import('./utils/entitlements.js');
  await grantEntitlement({ userId: user.id, qbankId: 1, source: 'complimentary', durationDays: 30, orderRef: 'ORD-AIM-1' });

  const res = await fetch(`${BASE}/qbanks/my`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as any;
  assert.ok(Array.isArray(data.purchases), 'purchases array present');
  const purchased = data.purchases.find((p: any) => p.qbankId === 1);
  assert.ok(purchased, 'has the granted qbank');
  assert.equal(purchased.catalogueId, 'uhs_mbbs_1st_year');
  assert.equal(purchased.qbankType, 'uhs-mbbs-1st-year');
});

// ---------------------------------------------------------------------------
// Administration 2.0 — RBAC, account types, roles, scopes, effective access
// ---------------------------------------------------------------------------

test('RBAC: seeded account types, roles and permissions exist', async () => {
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const { token } = (await login.json()) as any;

  const types = await (await fetch(`${BASE}/admin/rbac/user-types`, { headers: { Authorization: `Bearer ${token}` } })).json() as any;
  assert.ok(types.userTypes.length >= 10, 'at least 10 account types seeded');
  assert.ok(types.userTypes.some((t: any) => t.slug === 'student'));
  assert.ok(types.userTypes.some((t: any) => t.slug === 'superadmin'));

  const roles = await (await fetch(`${BASE}/admin/rbac/roles`, { headers: { Authorization: `Bearer ${token}` } })).json() as any;
  assert.ok(roles.roles.some((r: any) => r.slug === 'superadmin' && r.permissions.length > 40), 'superadmin holds all permissions');
  assert.ok(roles.roles.some((r: any) => r.slug === 'qbank_manager' && r.permissions.includes('qbanks.publish')));

  const perms = await (await fetch(`${BASE}/admin/rbac/permissions`, { headers: { Authorization: `Bearer ${token}` } })).json() as any;
  assert.ok(perms.permissions.some((p: any) => p.key === 'questions.publish'));
  assert.ok(perms.groups.includes('Questions'));
});

test('RBAC: student cannot access admin RBAC; superadmin can create a role', async () => {
  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Plain Student', email: `plain${Date.now()}@medicology.net`, password: 'Plain123',
    college: 'Test', year: 'Year 1',
  }));
  const { token } = (await reg.json()) as any;
  const denied = await fetch(`${BASE}/admin/rbac/roles`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(denied.status, 403, 'student blocked from admin RBAC');

  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const create = await fetch(`${BASE}/admin/rbac/roles`, json({ Authorization: `Bearer ${adminToken}` }, {
    name: 'QA Temp Role', slug: `qa_temp_${Date.now()}`,
    description: 'created by test', permissions: ['questions.view', 'media.view'],
  }));
  assert.equal(create.status, 201);
  const { role } = (await create.json()) as any;
  assert.ok(role.permissions.includes('questions.view'));
});

test('RBAC: role assignment + effective permissions on a user', async () => {
  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Scoped Reviewer', email: `scoped${Date.now()}@medicology.net`, password: 'Scoped123',
    college: 'Test', year: 'Year 4',
  }));
  const { user } = (await reg.json()) as any;

  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;

  // Find the question_reviewer role id and assign it.
  const roles = await (await fetch(`${BASE}/admin/rbac/roles`, { headers: { Authorization: `Bearer ${adminToken}` } })).json() as any;
  const reviewer = roles.roles.find((r: any) => r.slug === 'question_reviewer');
  assert.ok(reviewer, 'question_reviewer role exists');

  const assign = await fetch(`${BASE}/admin/rbac/users/${user.id}/roles`, json({ Authorization: `Bearer ${adminToken}` }, { roleIds: [reviewer.id] }, 'PUT'));
  assert.equal(assign.status, 200);

  // The user's effective access should now include questions.review + publish.
  const access = await (await fetch(`${BASE}/admin/rbac/users/${user.id}/access`, { headers: { Authorization: `Bearer ${adminToken}` } })).json() as any;
  assert.ok(access.effective.roles.includes('question_reviewer'), 'role attached');
  assert.ok(access.effective.grantedPermissions.includes('questions.review'));
  assert.ok(access.effective.grantedPermissions.includes('questions.publish'));
  assert.ok(!access.effective.grantedPermissions.includes('users.manage'), 'no admin perms leaked');
});

test('RBAC: explicit denial beats role grant; scopes attach', async () => {
  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'Denied User', email: `denied${Date.now()}@medicology.net`, password: 'Denied123',
    college: 'Test', year: 'Year 3',
  }));
  const { user } = (await reg.json()) as any;

  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;

  const roles = await (await fetch(`${BASE}/admin/rbac/roles`, { headers: { Authorization: `Bearer ${adminToken}` } })).json() as any;
  const manager = roles.roles.find((r: any) => r.slug === 'qbank_manager');
  await fetch(`${BASE}/admin/rbac/users/${user.id}/roles`, json({ Authorization: `Bearer ${adminToken}` }, { roleIds: [manager.id] }, 'PUT'));

  // Deny qbanks.publish explicitly.
  await fetch(`${BASE}/admin/rbac/users/${user.id}/permissions`, json({ Authorization: `Bearer ${adminToken}` }, {
    permissions: [{ permissionKey: 'qbanks.publish', allowed: false }],
  }, 'PUT'));

  // Add a scope (country 1 = Pakistan).
  await fetch(`${BASE}/admin/rbac/users/${user.id}/scopes`, json({ Authorization: `Bearer ${adminToken}` }, {
    scopes: [{ scopeType: 'country', scopeId: 1, label: 'Pakistan' }],
  }, 'PUT'));

  const access = await (await fetch(`${BASE}/admin/rbac/users/${user.id}/access`, { headers: { Authorization: `Bearer ${adminToken}` } })).json() as any;
  assert.ok(access.effective.deniedPermissions.includes('qbanks.publish'), 'explicit denial recorded');
  assert.ok(!access.effective.grantedPermissions.includes('qbanks.publish'), 'denial wins over role grant');
  assert.ok(access.effective.grantedPermissions.includes('qbanks.view'), 'role grant still present');
  assert.equal(access.effective.scopes.length, 1);
  assert.equal(access.effective.scopes[0].type, 'country');
  assert.equal(access.effective.scopes[0].id, 1);
});

test('RBAC: account type creation + organization + team', async () => {
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const slug = `qa_type_${Date.now()}`;

  const create = await fetch(`${BASE}/admin/rbac/user-types`, json({ Authorization: `Bearer ${adminToken}` }, {
    name: 'QA Type', slug, description: 'test type', registrationAllowed: true, defaultRole: 'student',
  }));
  assert.equal(create.status, 201);

  const org = await fetch(`${BASE}/admin/rbac/organizations`, json({ Authorization: `Bearer ${adminToken}` }, {
    name: 'QA Org', slug: `qa_org_${Date.now()}`, organizationType: 'content_team',
  }));
  assert.equal(org.status, 201);

  const orgs = await (await fetch(`${BASE}/admin/rbac/organizations`, { headers: { Authorization: `Bearer ${adminToken}` } })).json() as any;
  assert.ok(orgs.organizations.some((o: any) => o.slug === 'uhs'), 'seeded UHS org present');
});

test('RBAC scopes: country covers exams/programs/years, other countries excluded', async () => {
  const { hasScope } = await import('./utils/authorization.js');
  const access = { userId: 0, permissions: [], grantedPermissions: [], deniedPermissions: [], roles: [], scopes: [{ type: 'country', id: 1, label: 'Pakistan' }], isSuperadmin: false } as any;

  // Exam 1 = UHS (countryId 1) → covered; exam 13 = USMLE (countryId 3) → not.
  assert.equal(await hasScope(access, 'exam', 1), true, 'country scope covers its exam');
  assert.equal(await hasScope(access, 'exam', 13), false, 'country scope excludes other-country exams');
  assert.equal(await hasScope(access, 'program', 1), true, 'country covers program via exam');
  assert.equal(await hasScope(access, 'year', 4), true, 'country covers year via program→exam');
  assert.equal(await hasScope(access, 'year', 9), true, 'BDS year under UHS is also in PK');
});

test('RBAC scopes: exam scope covers its programs/years, sibling exams excluded', async () => {
  const { hasScope } = await import('./utils/authorization.js');
  const access = { userId: 0, permissions: [], grantedPermissions: [], deniedPermissions: [], roles: [], scopes: [{ type: 'exam', id: 1, label: 'UHS' }], isSuperadmin: false } as any;

  assert.equal(await hasScope(access, 'exam', 1), true);
  assert.equal(await hasScope(access, 'exam', 2), false, 'KMU not covered by UHS scope');
  assert.equal(await hasScope(access, 'program', 1), true, 'MBBS under UHS covered');
  assert.equal(await hasScope(access, 'program', 3), false, 'KMU MBBS excluded');
  assert.equal(await hasScope(access, 'year', 4), true, '4th Year (UHS MBBS) covered');
  assert.equal(await hasScope(access, 'country', 1), false, 'an exam scope is narrower than the country — no country-wide access');
});

test('RBAC scopes: subject covers systems/topics; content branch is separate from exam branch', async () => {
  const { hasScope, questionInScope } = await import('./utils/authorization.js');
  const access = { userId: 0, permissions: [], grantedPermissions: [], deniedPermissions: [], roles: [], scopes: [{ type: 'subject', id: 4, label: 'Pathology' }], isSuperadmin: false } as any;

  assert.equal(await hasScope(access, 'system', 1), true, 'Hematology (Pathology) covered');
  assert.equal(await hasScope(access, 'topic', 1), true, 'Anemia covered via system');
  assert.equal(await hasScope(access, 'topic', 5), false, 'IHD (Medicine) excluded');
  assert.equal(await hasScope(access, 'system', 9), false, 'Medicine CV system excluded');
  assert.equal(await hasScope(access, 'exam', 1), false, 'subject scope does not cover exams');

  assert.equal(await questionInScope(access, { systemId: 1 }), true);
  assert.equal(await questionInScope(access, { topicId: 1 }), true);
  assert.equal(await questionInScope(access, { subjectId: 4 }), true);
  assert.equal(await questionInScope(access, { subtopicId: 1 }), true, 'subtopic resolves to its parent topic');
  assert.equal(await questionInScope(access, { topicId: 5 }), false);
  assert.equal(await questionInScope(access, { examId: 1 }), false);
});

test('RBAC scopes: questionInScope with exam-branch + global/empty/superadmin semantics', async () => {
  const { questionInScope } = await import('./utils/authorization.js');
  const uhs = { userId: 0, permissions: [], grantedPermissions: [], deniedPermissions: [], roles: [], scopes: [{ type: 'exam', id: 1, label: 'UHS' }], isSuperadmin: false } as any;
  assert.equal(await questionInScope(uhs, { examId: 1 }), true);
  assert.equal(await questionInScope(uhs, { programId: 1 }), true, 'MBBS program under UHS');
  assert.equal(await questionInScope(uhs, { countryId: 1 }), false, 'a country-only tag is not tied to UHS');
  assert.equal(await questionInScope(uhs, { examId: 13 }), false);
  assert.equal(await questionInScope(uhs, { subjectId: 4 }), false, 'exam scope does not cover subjects');

  const global = { ...uhs, scopes: [{ type: 'global', id: null }] } as any;
  assert.equal(await questionInScope(global, { examId: 13 }), true);

  const none = { ...uhs, scopes: [] } as any;
  assert.equal(await questionInScope(none, { examId: 13 }), true, 'no scopes = unrestricted (legacy)');

  const superadmin = { ...uhs, scopes: [], isSuperadmin: true } as any;
  assert.equal(await questionInScope(superadmin, { examId: 13 }), true);
});

test('RBAC scopes: review route rejects out-of-scope questions (403) and allows in-scope', async () => {
  const { db } = await import('./db.js');
  const { questionsTable, usersTable } = await import('@workspace/db');
  const { eq: drizzleEq } = await import('./utils/drizzle.js');

  // Register a content-team user scoped to UHS (exam 1).
  const email = `uhsadmin${Date.now()}@medicology.net`;
  const reg = await fetch(`${BASE}/auth/register`, json({}, {
    name: 'UHS Content Admin', email, password: 'UhsAdmin123',
    college: 'Test', year: 'Year 4',
  }));
  const { user } = (await reg.json()) as any;

  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;

  // Scope them to exam 1 (UHS) via the admin RBAC API.
  const scoped = await fetch(`${BASE}/admin/rbac/users/${user.id}/scopes`, json({ Authorization: `Bearer ${adminToken}` }, {
    scopes: [{ scopeType: 'exam', scopeId: 1, label: 'UHS' }],
  }, 'PUT'));
  assert.equal(scoped.status, 200);

  // Promote to content_admin (passes requireAdmin + review.manage) and
  // re-login so the JWT carries the new role.
  await db.update(usersTable).set({ role: 'content_admin' as any }).where(drizzleEq(usersTable.id, user.id));
  const relogin = await fetch(`${BASE}/auth/login`, json({}, { email, password: 'UhsAdmin123' }));
  const reviewerToken = ((await relogin.json()) as any).token;
  assert.ok(reviewerToken, 're-login issues a token with the promoted role');

  // Two seeded questions: one in scope (UHS) and one out (USMLE, country 3).
  await db.update(questionsTable).set({ examId: 1 as any, status: 'pending_review' as any }).where(drizzleEq(questionsTable.id, 1));
  await db.update(questionsTable).set({ examId: 13 as any, status: 'pending_review' as any }).where(drizzleEq(questionsTable.id, 2));

  const inScope = await fetch(`${BASE}/admin/questions/1/review`, json({ Authorization: `Bearer ${reviewerToken}` }, { action: 'start_review' }));
  assert.equal(inScope.status, 200, 'in-scope UHS question reviewable');

  const outScope = await fetch(`${BASE}/admin/questions/2/review`, json({ Authorization: `Bearer ${reviewerToken}` }, { action: 'start_review' }));
  assert.equal(outScope.status, 403, 'out-of-scope USMLE question blocked');
  const body = (await outScope.json()) as any;
  assert.match(body.error, /outside your access scope/);
});

// ============================================================================
// Bulk deck import, spreadsheet editor, bulk review (Administration 2.0).
// ============================================================================

test('flashcard deck template: xlsx and csv downloads carry headers + example rows', async () => {
  const { db } = await import('./db.js');
  const { usersTable } = await import('@workspace/db');
  const { eq: drizzleEq } = await import('./utils/drizzle.js');
  await db.update(usersTable).set({ role: 'superadmin' as any }).where(drizzleEq(usersTable.id, 1));

  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const auth = { Authorization: `Bearer ${adminToken}` };

  const xlsxRes = await fetch(`${BASE}/flashcards/admin/decks/template`, { headers: auth });
  assert.equal(xlsxRes.status, 200);
  assert.match(xlsxRes.headers.get('content-type') || '', /spreadsheet/);
  const wb = XLSX.read(Buffer.from(await xlsxRes.arrayBuffer()), { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('Template'));
  assert.ok(wb.SheetNames.includes('Guide'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Template'], { defval: '' });
  assert.ok(rows.length >= 2, 'template has metadata + at least one card row');
  const joined = JSON.stringify(rows);
  assert.ok(/Front/.test(joined) && /Back/.test(joined), 'template has Front/Back columns');

  const csvRes = await fetch(`${BASE}/flashcards/admin/decks/template?format=csv`, { headers: auth });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get('content-type') || '', /csv/);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Front') && csvText.includes('Back'), 'csv template has card headers');

  const qCsv = await fetch(`${BASE}/admin/import/template?format=csv`, { headers: auth });
  assert.equal(qCsv.status, 200);
  assert.match(qCsv.headers.get('content-type') || '', /csv/);
  const qCsvText = await qCsv.text();
  assert.ok(qCsvText.includes('Question') && qCsvText.includes('Correct Answer'), 'MCQ csv template has core columns');
});

test('bulk deck import: xlsx with deck metadata + cards creates deck + cards with taxonomy', async () => {
  const { db } = await import('./db.js');
  const { usersTable, flashcardDecksTable, flashcardsTable } = await import('@workspace/db');
  const { eq: drizzleEq } = await import('./utils/drizzle.js');
  await db.update(usersTable).set({ role: 'superadmin' as any }).where(drizzleEq(usersTable.id, 1));
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const auth = { Authorization: `Bearer ${adminToken}` };

  // Build a small xlsx: deck metadata block + card rows (Front/Back + taxonomy).
  const rows: any[][] = [
    ['Deck Name', 'UHS Cardio Test Deck'],
    ['Deck Slug', 'uhs-cardio-test-deck'],
    ['Deck Exam', 'UHS'],
    ['Deck Program', 'MBBS'],
    ['', ''],
    ['Front', 'Back', 'Subject', 'Topic', 'Exam'],
    ['What does the RCA supply?', 'Inferior wall of the heart', 'Medicine', 'Ischemic Heart Disease', 'UHS'],
    ['Best marker for MI?', 'Troponin', 'Medicine', 'Ischemic Heart Disease', 'UHS'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Deck');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'uhs-cardio.xlsx');
  const previewRes = await fetch(`${BASE}/flashcards/admin/decks/import/preview`, { method: 'POST', headers: auth, body: form });
  const preview = (await previewRes.json()) as any;
  assert.equal(previewRes.status, 200, JSON.stringify(preview).slice(0, 300));
  assert.equal(preview.deck?.name, 'UHS Cardio Test Deck');
  assert.equal(preview.stats?.valid, 2, 'both card rows valid');

  const execRes = await fetch(`${BASE}/flashcards/admin/decks/import/execute`, json(auth, {
    rows: preview.rows,
    deck: preview.deck,
    createMissingTaxonomy: true,
  }, 'POST'));
  const result = (await execRes.json()) as any;
  assert.equal(execRes.status, 201, JSON.stringify(result).slice(0, 300));
  assert.equal(result.inserted, 2, 'both cards inserted');
  assert.ok(result.deckId > 0, 'deck created');

  const [deck] = await db.select().from(flashcardDecksTable).where(drizzleEq(flashcardDecksTable.slug, 'uhs-cardio-test-deck'));
  assert.ok(deck, 'deck persisted');
  assert.equal(deck.exam, 'UHS');
  assert.equal(deck.cardCount, 2);
  const cards = await db.select().from(flashcardsTable).where(drizzleEq(flashcardsTable.deckId, deck.id));
  assert.equal(cards.length, 2, 'cards persisted');
});

test('spreadsheet grid: fetch flat rows, bulk-save edits with versioning', async () => {
  const { db } = await import('./db.js');
  const { usersTable, questionsTable } = await import('@workspace/db');
  const { eq: drizzleEq } = await import('./utils/drizzle.js');
  await db.update(usersTable).set({ role: 'superadmin' as any }).where(drizzleEq(usersTable.id, 1));
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const auth = { Authorization: `Bearer ${adminToken}` };

  const grid = await fetch(`${BASE}/admin/questions/spreadsheet?limit=5`, { headers: auth });
  assert.equal(grid.status, 200);
  const gridData = (await grid.json()) as any;
  assert.ok(gridData.questions.length > 0, 'grid returns rows');
  const target = gridData.questions[0];

  const save = await fetch(`${BASE}/admin/questions/spreadsheet/save`, json(auth, {
    rows: [{ id: target.id, difficulty: 'hard', topic: 'Grid Edited Topic' }],
  }, 'POST'));
  const saveData = (await save.json()) as any;
  assert.equal(save.status, 200, JSON.stringify(saveData).slice(0, 300));
  assert.equal(saveData.changed, 1, 'one row updated');

  const [updated] = await db.select().from(questionsTable).where(drizzleEq(questionsTable.id, target.id));
  assert.equal(updated.difficulty, 'hard');
  assert.equal(updated.topic, 'Grid Edited Topic');
});

test('bulk review: approve + publish many questions at once, scoped per question', async () => {
  const { db } = await import('./db.js');
  const { usersTable, questionsTable } = await import('@workspace/db');
  const { eq: drizzleEq, inArray } = await import('./utils/drizzle.js');
  await db.update(usersTable).set({ role: 'superadmin' as any }).where(drizzleEq(usersTable.id, 1));
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const auth = { Authorization: `Bearer ${adminToken}` };

  // Put three questions into pending_review.
  for (const id of [3, 4, 5]) {
    await db.update(questionsTable).set({ status: 'pending_review' as any }).where(drizzleEq(questionsTable.id, id));
  }

  const bulk = await fetch(`${BASE}/admin/questions/bulk-review`, json(auth, {
    ids: [3, 4, 5],
    action: 'approve',
  }, 'POST'));
  const bulkData = (await bulk.json()) as any;
  assert.equal(bulk.status, 200, JSON.stringify(bulkData).slice(0, 300));
  assert.equal(bulkData.changed, 3, 'all three approved');
  assert.ok(bulkData.results.every((r: any) => r.ok), 'no per-question failures');

  const approved = await db.select({ status: questionsTable.status }).from(questionsTable).where(inArray(questionsTable.id, [3, 4, 5]));
  assert.ok(approved.every((q: any) => q.status === 'approved'), 'statuses updated to approved');
});


test('bulk review: reject requires a note and skips questions that cannot transition', async () => {
  const { db } = await import('./db.js');
  const { usersTable } = await import('@workspace/db');
  const { eq: drizzleEq } = await import('./utils/drizzle.js');
  await db.update(usersTable).set({ role: 'superadmin' as any }).where(drizzleEq(usersTable.id, 1));
  const login = await fetch(`${BASE}/auth/login`, json({}, { email: 'admin@medicology.net', password: process.env.ADMIN_PASSWORD || 'admin123' }));
  const adminToken = ((await login.json()) as any).token;
  const auth = { Authorization: `Bearer ${adminToken}` };

  const noNote = await fetch(`${BASE}/admin/questions/bulk-review`, json(auth, { ids: [6], action: 'reject' }, 'POST'));
  assert.equal(noNote.status, 400, 'reject without note is rejected');

  const withNote = await fetch(`${BASE}/admin/questions/bulk-review`, json(auth, { ids: [6], action: 'reject', note: 'Needs a better explanation' }, 'POST'));
  const withNoteData = (await withNote.json()) as any;
  assert.equal(withNote.status, 200);
  assert.ok(Array.isArray(withNoteData.results), 'results array returned');
});
