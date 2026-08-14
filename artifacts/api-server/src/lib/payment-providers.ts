import crypto from 'crypto';

// ============================================================================
// Provider-agnostic payment abstraction.
//
// The API never trusts the frontend's claim that a payment succeeded. Orders
// are created server-side with amounts from the DB, then verified through the
// provider adapter (provider API call or signed webhook) before an entitlement
// is granted. Real providers are NOT configured yet — constructing one throws,
// so the API refuses rather than faking a verification.
// ============================================================================

export interface PaymentContext {
  orderId: string;
  qbankSlug: string;
  qbankName: string;
  amount: number;
  currency: string;
}

export interface PaymentProviderAdapter {
  name: string;
  createPayment(order: PaymentContext): Promise<{
    redirectUrl?: string;
    sessionId?: string;
    meta?: Record<string, any>;
  }>;
  verifyPayment(
    order: PaymentContext & { gatewayResponse?: Record<string, any> | null },
    params: { ref?: string }
  ): Promise<{ verified: boolean; transactionRef?: string }>;
  handleWebhook?(payload: any): Promise<{ orderId: string; verified: boolean; transactionRef?: string }>;
}

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

/**
 * Development/mock provider — simulates a hosted gateway.
 *
 * createPayment mints a one-time dev token and redirects the client to the
 * app's callback page as if the gateway had succeeded. verifyPayment only
 * succeeds when the ref the client presents matches that server-minted token,
 * so a caller cannot conjure a verified payment out of thin air. In dev this
 * is inherently spoofable (the token travels through the browser) — it exists
 * so the full order → verify → entitlement loop is exercisable locally. It is
 * never active in production (see getPaymentProvider).
 */
class DevProvider implements PaymentProviderAdapter {
  readonly name = 'dev';

  async createPayment(order: PaymentContext) {
    const devToken = crypto.randomBytes(24).toString('hex');
    const redirectUrl = `${APP_BASE_URL}/payment/callback?status=success&orderId=${order.orderId}&provider=dev&ref=${devToken}`;
    return { redirectUrl, meta: { devToken } };
  }

  async verifyPayment(
    order: PaymentContext & { gatewayResponse?: Record<string, any> | null },
    params: { ref?: string }
  ) {
    const token = order.gatewayResponse?.devToken;
    const verified = typeof token === 'string' && token.length > 0 && token === params.ref;
    return { verified, transactionRef: verified ? `dev-${order.orderId}` : undefined };
  }
}

class StripeProvider implements PaymentProviderAdapter {
  readonly name = 'stripe';
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
    }
  }
  async createPayment(_order: PaymentContext): Promise<never> {
    throw new Error('Stripe createPayment is not implemented yet');
  }
  async verifyPayment(_order: PaymentContext, _params: { ref?: string }): Promise<never> {
    throw new Error('Stripe verifyPayment is not implemented yet');
  }
}

class JazzCashProvider implements PaymentProviderAdapter {
  readonly name = 'jazzcash';
  constructor() {
    if (!process.env.JAZZCASH_MERCHANT_ID || !process.env.JAZZCASH_SECRET) {
      throw new Error('JazzCash is not configured (JAZZCASH_MERCHANT_ID / JAZZCASH_SECRET missing)');
    }
  }
  async createPayment(_order: PaymentContext): Promise<never> {
    throw new Error('JazzCash createPayment is not implemented yet');
  }
  async verifyPayment(_order: PaymentContext, _params: { ref?: string }): Promise<never> {
    throw new Error('JazzCash verifyPayment is not implemented yet');
  }
}

class EasyPaisaProvider implements PaymentProviderAdapter {
  readonly name = 'easypaisa';
  constructor() {
    if (!process.env.EASYPAISA_MERCHANT_ID || !process.env.EASYPAISA_SECRET) {
      throw new Error('Easypaisa is not configured (EASYPAISA_MERCHANT_ID / EASYPAISA_SECRET missing)');
    }
  }
  async createPayment(_order: PaymentContext): Promise<never> {
    throw new Error('Easypaisa createPayment is not implemented yet');
  }
  async verifyPayment(_order: PaymentContext, _params: { ref?: string }): Promise<never> {
    throw new Error('Easypaisa verifyPayment is not implemented yet');
  }
}

const REGISTRY: Record<string, new () => PaymentProviderAdapter> = {
  dev: DevProvider,
  stripe: StripeProvider,
  jazzcash: JazzCashProvider,
  easypaisa: EasyPaisaProvider,
};

/**
 * Resolve a provider adapter. Real providers throw unless their env credentials
 * are configured; the dev provider is only constructible when the app is not
 * running in production (defense in depth — never ship dev payment spoofing).
 */
export function getPaymentProvider(name: string): PaymentProviderAdapter {
  const key = (name || 'dev').toLowerCase();
  if (key === 'dev') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Dev payment provider is disabled in production');
    }
    return new DevProvider();
  }
  const Cls = REGISTRY[key];
  if (!Cls) throw new Error(`Unknown payment provider "${name}"`);
  return new Cls();
}
