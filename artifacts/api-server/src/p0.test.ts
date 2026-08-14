// P0 integration tests — run against the in-memory mock DB with the API
// booted in-process (no external server or database required).
//
//   node --import tsx/esm --test src/p0.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

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
