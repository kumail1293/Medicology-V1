import { db } from '../db.js';
import { emailTemplatesTable } from '@workspace/db';
import { eq } from './drizzle.js';
import { sendEmail } from './mailer.js';
import { interpolate } from './email-renderer.js';

// ============================================================================
// Transactional email dispatcher.
//
// Looks up a PUBLISHED template by slug and sends it with the given data via
// the mailer (SMTP or log provider). Sends are non-blocking best-effort: a
// missing template or a delivery failure is logged, never thrown — a failed
// welcome email must not break registration.
// ============================================================================

export interface TransactionalSendInput {
  to: string;
  slug: string;
  userId?: number;
  data?: Record<string, string | number | boolean | undefined>;
  templateId?: number;
}

export async function sendTransactional(input: TransactionalSendInput): Promise<{ ok: boolean; status: string; reason?: string }> {
  try {
    const rows = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.slug, input.slug));
    const template = rows.find((t: any) => t.status === 'published') ?? rows[0];
    if (!template) {
      console.warn(`[email] No template for slug "${input.slug}" — send skipped`);
      return { ok: false, status: 'skipped', reason: `no template "${input.slug}"` };
    }
    const t = template as any;
    // The template may reference the user's name etc. via variables; resolve
    // the subject through the same interpolation used by the renderer.
    const subject = interpolate(t.subject, input.data ?? {});
    const result = await sendEmail({
      to: input.to,
      subject,
      blocks: t.bodyBlocks ?? [],
      templateId: input.templateId ?? t.id,
      requestedById: input.userId ?? null,
      data: input.data ?? {},
    });
    return { ok: result.ok, status: result.status, reason: result.error };
  } catch (err: any) {
    console.error(`[email] sendTransactional failed for "${input.slug}":`, err.message);
    return { ok: false, status: 'failed', reason: err.message };
  }
}

/** Fire-and-forget wrapper so callers never await delivery. */
export function queueTransactional(input: TransactionalSendInput): void {
  void sendTransactional(input);
}
