import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { paymentOrdersTable } from '@workspace/db';
import { eq, and } from '../utils/drizzle.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { findQbankBySlug, grantEntitlement } from '../utils/entitlements.js';
import { getPaymentProvider } from '../lib/payment-providers.js';
import { recordAudit } from '../utils/audit.js';

export const paymentsRouter = Router();

const isPayableStatus = (status: string) => status === 'available' || status === 'beta';

/**
 * POST /api/payments/initiate
 * Body: { qbankType (slug), provider, idempotencyKey? }
 *
 * Amount/currency come from the QBank row — never from the client. Creating an
 * order is idempotent: repeat calls with the same key reuse the pending order
 * instead of charging twice.
 */
paymentsRouter.post('/initiate', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const qbankSlug = req.body?.qbankType;
    if (!qbankSlug || typeof qbankSlug !== 'string') {
      return res.status(400).json({ error: 'qbankType is required' });
    }

    const qbank = await findQbankBySlug(qbankSlug);
    if (!qbank) return res.status(404).json({ error: 'QBank not found' });
    if (!isPayableStatus(qbank.status)) {
      return res.status(409).json({ error: `QBank "${qbank.slug}" is not available for purchase` });
    }
    if (!qbank.price) {
      return res.status(409).json({ error: 'QBank has no price configured' });
    }

    let adapter;
    try {
      adapter = getPaymentProvider(req.body?.provider);
    } catch (err: any) {
      return res.status(503).json({ error: err.message });
    }

    const idempotencyKey =
      (typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()) ||
      `user:${req.user!.id}:qbank:${qbank.id}`;

    // Reuse a still-pending order for this key (idempotency — no double charges).
    const pendingOrders = await db
      .select()
      .from(paymentOrdersTable)
      .where(
        and(
          eq(paymentOrdersTable.userId, req.user!.id),
          eq(paymentOrdersTable.idempotencyKey, idempotencyKey),
          eq(paymentOrdersTable.status, 'pending')
        )
      );
    if (pendingOrders.length > 0) {
      const existing = pendingOrders[0];
      return res.status(201).json({
        orderId: existing.orderId,
        provider: existing.provider,
        status: existing.status,
        redirectUrl: existing.gatewayResponse?.redirectUrl ?? null,
      });
    }

    const orderId = `ORD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const payment = await adapter.createPayment({
      orderId,
      qbankSlug: qbank.slug,
      qbankName: qbank.name,
      amount: qbank.price,
      currency: qbank.currency,
    });

    const [order] = await db
      .insert(paymentOrdersTable)
      .values({
        orderId,
        userId: req.user!.id,
        qbankType: qbank.slug,
        provider: adapter.name,
        amount: qbank.price,
        currency: qbank.currency,
        status: 'pending',
        idempotencyKey,
        gatewayResponse: {
          ...(payment.meta ?? {}),
          redirectUrl: payment.redirectUrl ?? null,
        },
      })
      .returning();

    await recordAudit({
      actor: { id: req.user!.id },
      action: 'payment.order_created',
      entityType: 'payment_order',
      entityId: order.id,
      entityLabel: orderId,
      summary: `Created ${qbank.name} order for ${qbank.currency} ${qbank.price} via ${adapter.name}`,
      newValues: { amount: qbank.price, currency: qbank.currency, qbankSlug: qbank.slug },
      ip: req.ip,
    });

    res.status(201).json({
      orderId,
      provider: adapter.name,
      status: 'pending',
      redirectUrl: payment.redirectUrl ?? null,
    });
  } catch (err: any) {
    console.error('Error in payments initiate:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/verify
 * Body: { orderId, provider, ref }
 *
 * Verifies the payment with the provider, then grants the entitlement.
 * Idempotent: a paid order returns success without granting twice.
 */
paymentsRouter.post('/verify', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { orderId, ref } = req.body ?? {};
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const [order] = await db
      .select()
      .from(paymentOrdersTable)
      .where(eq(paymentOrdersTable.orderId, orderId));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only the order owner may verify it — no cross-user access claims.
    if (Number(order.userId) !== Number(req.user!.id)) {
      return res.status(403).json({ error: 'Not your order' });
    }

    if (order.status === 'paid') {
      return res.json({ verified: true, alreadyProcessed: true, qbankType: order.qbankType });
    }
    if (order.status === 'failed' || order.status === 'cancelled') {
      return res.status(400).json({ error: `Order is ${order.status}` });
    }

    let adapter;
    try {
      adapter = getPaymentProvider(order.provider);
    } catch (err: any) {
      return res.status(503).json({ error: err.message });
    }

    const result = await adapter.verifyPayment(
      { ...order, gatewayResponse: order.gatewayResponse },
      { ref }
    );
    if (!result.verified) {
      // Keep the order pending — a failed verification (bad ref, provider
      // hiccup) must not brick the order; the legitimate redirect can retry.
      return res.status(400).json({ error: 'Payment could not be verified' });
    }

    const qbank = await findQbankBySlug(order.qbankType);
    if (!qbank) return res.status(404).json({ error: 'QBank no longer exists' });

    await db
      .update(paymentOrdersTable)
      .set({
        status: 'paid',
        transactionRef: result.transactionRef ?? null,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrdersTable.id, order.id));

    const { entitlement, created } = await grantEntitlement({
      userId: order.userId,
      qbankId: qbank.id,
      source: 'payment',
      durationDays: qbank.durationDays ?? 365,
      orderRef: orderId,
      grantedBy: req.user!.id,
      metadata: { transactionRef: result.transactionRef ?? null, provider: order.provider },
    });

    await recordAudit({
      actor: { id: req.user!.id },
      action: 'payment.verified',
      entityType: 'payment_order',
      entityId: order.id,
      entityLabel: orderId,
      summary: `Payment verified (${order.provider}) — ${created ? 'entitlement granted' : 'entitlement already active'}`,
      oldValues: { status: 'pending' },
      newValues: { status: 'paid', qbankSlug: qbank.slug, entitlementId: entitlement.id },
      ip: req.ip,
    });

    res.json({
      verified: true,
      qbankType: order.qbankType,
      qbankSlug: qbank.slug,
      qbankName: qbank.name,
      alreadyProcessed: !created,
    });
  } catch (err: any) {
    console.error('Error in payments verify:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/webhook/:provider
 * Provider-signed callback endpoint (for real gateways). The adapter validates
 * the signature; the same idempotent grant path runs afterwards.
 */
paymentsRouter.post('/webhook/:provider', async (req: any, res: any) => {
  try {
    let adapter;
    try {
      adapter = getPaymentProvider(req.params.provider);
    } catch (err: any) {
      return res.status(503).json({ error: err.message });
    }
    if (!adapter.handleWebhook) {
      return res.status(501).json({ error: `Webhooks not supported for ${adapter.name}` });
    }

    const result = await adapter.handleWebhook(req.body);
    if (!result?.verified || !result.orderId) {
      return res.status(400).json({ error: 'Webhook signature invalid' });
    }

    const [order] = await db
      .select()
      .from(paymentOrdersTable)
      .where(eq(paymentOrdersTable.orderId, result.orderId));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') {
      return res.json({ received: true, alreadyProcessed: true });
    }

    const qbank = await findQbankBySlug(order.qbankType);
    if (!qbank) return res.status(404).json({ error: 'QBank no longer exists' });

    await db
      .update(paymentOrdersTable)
      .set({
        status: 'paid',
        transactionRef: result.transactionRef ?? null,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrdersTable.id, order.id));

    await grantEntitlement({
      userId: order.userId,
      qbankId: qbank.id,
      source: 'payment',
      durationDays: qbank.durationDays ?? 365,
      orderRef: order.orderId,
      metadata: { transactionRef: result.transactionRef ?? null, provider: order.provider },
    });

    await recordAudit({
      action: 'payment.verified',
      entityType: 'payment_order',
      entityId: order.id,
      entityLabel: order.orderId,
      summary: `Payment verified via ${order.provider} webhook — entitlement granted`,
      oldValues: { status: 'pending' },
      newValues: { status: 'paid', qbankSlug: qbank.slug },
      ip: req.ip,
    });

    res.json({ received: true });
  } catch (err: any) {
    console.error('Error in payments webhook:', err);
    res.status(500).json({ error: err.message });
  }
});
