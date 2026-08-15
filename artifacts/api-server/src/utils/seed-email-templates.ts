// ============================================================================
// Default email template library.
//
// Seeded on first boot (idempotent — skipped when templates already exist) and
// restorable from the admin UI. Every template is a structured block document
// rendered by utils/email-renderer.ts, so admins can edit or restyle each one
// in the visual builder without touching code.
// ============================================================================

import { db } from '../db.js';
import { emailTemplatesTable } from '@workspace/db';

interface SeedTemplate {
  name: string;
  slug: string;
  category: 'transactional' | 'marketing' | 'system';
  subject: string;
  preheader: string;
  senderName: string;
  senderEmail: string;
  audience: string;
  variables: string[];
  bodyBlocks: any[];
}

const FOOTER = { type: 'footer', text: '© 2026 {{platform.name}} — Master your medical knowledge.' };
const UNSUBSCRIBE = { type: 'unsubscribe', label: 'Unsubscribe' };

const HERO = (title: string, align = 'center') => ({ type: 'heading', text: title, level: 1, align });

const TEMPLATES: SeedTemplate[] = [
  {
    name: 'Welcome',
    slug: 'welcome',
    category: 'transactional',
    subject: 'Welcome to {{platform.name}}, {{user.firstName}}! 🎉',
    preheader: 'Your medical exam journey starts here.',
    senderName: '{{platform.name}} Team',
    senderEmail: 'no-reply@medicology.com',
    audience: 'new registrations',
    variables: ['user.firstName', 'user.name', 'platform.name', 'platform.siteUrl', 'platform.supportEmail', 'currentDate'],
    bodyBlocks: [
      HERO('Welcome to {{platform.name}} 👋'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>We’re thrilled to have you on board. {{platform.name}} is built by doctors for students — thousands of exam-style MCQs, clinical vignettes and spaced-repetition flashcards across every major Pakistani medical board.</p>', align: 'left' },
      { type: 'text', html: '<p>Here’s how to get the most out of your account:</p><ul><li><b>Pick your exam</b> — UHS, KMU, NUMS, FCPS and more.</li><li><b>Take a timed mock</b> to see where you stand.</li><li><b>Review weak areas</b> — we track your accuracy per topic.</li></ul>', align: 'left' },
      { type: 'button', label: 'Start studying →', url: '{{platform.siteUrl}}/dashboard', style: 'primary', align: 'center' },
      { type: 'spacer', height: 12 },
      { type: 'text', html: '<p>Questions? Our support team is one click away — <a href="mailto:{{platform.supportEmail}}">{{platform.supportEmail}}</a>.</p>', align: 'left' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Email verification',
    slug: 'email_verification',
    category: 'transactional',
    subject: 'Verify your email — {{platform.name}}',
    preheader: 'Confirm your address to activate your account.',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'new registrations with verification enabled',
    variables: ['user.firstName', 'user.email', 'platform.name', 'verificationUrl', 'platform.supportEmail'],
    bodyBlocks: [
      HERO('Verify your email 📬'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>Please confirm that <b>{{user.email}}</b> belongs to you by clicking the button below. This keeps your account secure.</p>', align: 'left' },
      { type: 'button', label: 'Verify my email', url: '{{verificationUrl}}', style: 'primary', align: 'center' },
      { type: 'text', html: '<p>If the button doesn’t work, copy and paste this link into your browser: <br /><span style="color:#0d9488;">{{verificationUrl}}</span></p><p>If you didn’t create an account, you can safely ignore this email.</p>', align: 'left' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Password reset',
    slug: 'password_reset',
    category: 'transactional',
    subject: 'Reset your password — {{platform.name}}',
    preheader: 'A reset was requested for your account.',
    senderName: '{{platform.name}} Security',
    senderEmail: 'no-reply@medicology.com',
    audience: 'users who requested a password reset',
    variables: ['user.firstName', 'user.email', 'platform.name', 'resetUrl', 'platform.supportEmail'],
    bodyBlocks: [
      HERO('Reset your password 🔐'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>We received a request to reset the password for <b>{{user.email}}</b>. The link below expires in <b>30 minutes</b>.</p>', align: 'left' },
      { type: 'button', label: 'Reset my password', url: '{{resetUrl}}', style: 'primary', align: 'center' },
      { type: 'text', html: '<p>If you didn’t request this, you can safely ignore this email — your password stays unchanged. Need help? <a href="mailto:{{platform.supportEmail}}">{{platform.supportEmail}}</a></p>', align: 'left' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Purchase confirmation',
    slug: 'purchase_confirmation',
    category: 'transactional',
    subject: 'Payment confirmed — {{qbank.name}} 🎉',
    preheader: 'Your QBank is ready to study.',
    senderName: '{{platform.name}}',
    senderEmail: 'billing@medicology.com',
    audience: 'purchasers',
    variables: ['user.firstName', 'qbank.name', 'qbank.price', 'order.id', 'order.amount', 'entitlement.expiryDate', 'platform.name', 'platform.siteUrl', 'platform.supportEmail'],
    bodyBlocks: [
      HERO('Payment confirmed ✅'),
      { type: 'text', html: '<p>Thank you, <b>{{user.firstName}}</b>! Your order <b>{{order.id}}</b> for <b>{{qbank.name}}</b> ({{order.amount}}) went through successfully.</p>', align: 'left' },
      { type: 'qbankCard', name: '{{qbank.name}}', price: '{{qbank.price}}', url: '{{platform.siteUrl}}/qbanks', image: '' },
      { type: 'text', html: '<p>Your access is active now. If your purchase includes an expiry date, you’ll receive a reminder before it ends.</p>', align: 'left' },
      { type: 'button', label: 'Open my QBank →', url: '{{platform.siteUrl}}/dashboard', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Payment failed',
    slug: 'payment_failed',
    category: 'transactional',
    subject: 'We couldn’t process your payment — {{platform.name}}',
    preheader: 'Your QBank access needs attention.',
    senderName: '{{platform.name}} Billing',
    senderEmail: 'billing@medicology.com',
    audience: 'users with failed payment attempts',
    variables: ['user.firstName', 'qbank.name', 'order.id', 'order.amount', 'platform.name', 'platform.siteUrl', 'platform.supportEmail'],
    bodyBlocks: [
      HERO('Payment needs attention ⚠️'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>We couldn’t complete your payment of <b>{{order.amount}}</b> for <b>{{qbank.name}}</b> (order {{order.id}}).</p>', align: 'left' },
      { type: 'text', html: '<p>This can happen if your card was declined or the network dropped. No charges were made — your payment was <b>not</b> completed.</p>', align: 'left' },
      { type: 'button', label: 'Try again', url: '{{platform.siteUrl}}/qbanks', style: 'secondary', align: 'center' },
      { type: 'text', html: '<p>Questions about billing? <a href="mailto:{{platform.supportEmail}}">{{platform.supportEmail}}</a></p>', align: 'left' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Entitlement activated',
    slug: 'entitlement_activated',
    category: 'transactional',
    subject: '{{qbank.name}} is now unlocked 🎊',
    preheader: 'Your study access is active.',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'users granted QBank access',
    variables: ['user.firstName', 'qbank.name', 'entitlement.expiryDate', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('You’re in! 🎊'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>Your access to <b>{{qbank.name}}</b> is now active{{#if entitlement.expiryDate}}, valid until <b>{{entitlement.expiryDate}}</b>{{/if}}. Happy studying!</p>', align: 'left' },
      { type: 'button', label: 'Start a practice test', url: '{{platform.siteUrl}}/create-test', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Entitlement expiring soon',
    slug: 'entitlement_expiring',
    category: 'transactional',
    subject: 'Your {{qbank.name}} access expires soon ⏳',
    preheader: 'Keep your study streak going.',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'users whose QBank access is about to end',
    variables: ['user.firstName', 'qbank.name', 'entitlement.expiryDate', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('Access expiring soon ⏳'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>Your access to <b>{{qbank.name}}</b> ends on <b>{{entitlement.expiryDate}}</b>. Don’t let your progress stall — extend it now and keep your analytics, bookmarks and review history intact.</p>', align: 'left' },
      { type: 'button', label: 'Renew my access', url: '{{platform.siteUrl}}/subscription', style: 'primary', align: 'center' },
      { type: 'text', html: '<p>If you already renewed, you can ignore this reminder.</p>', align: 'left' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Entitlement expired',
    slug: 'entitlement_expired',
    category: 'transactional',
    subject: 'Your {{qbank.name}} access has ended',
    preheader: 'Re-activate anytime to pick up where you left off.',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'users whose QBank access ended',
    variables: ['user.firstName', 'qbank.name', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('Access expired'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>Your access to <b>{{qbank.name}}</b> has ended. Your analytics, bookmarks and notes are safely stored — reactivate whenever you’re ready to continue.</p>', align: 'left' },
      { type: 'button', label: 'Re-activate access', url: '{{platform.siteUrl}}/subscription', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'QBank coming soon',
    slug: 'qbank_coming_soon',
    category: 'transactional',
    subject: '{{qbank.name}} is coming to {{platform.name}} 🚀',
    preheader: 'Be first in line when it launches.',
    senderName: '{{platform.name}} Team',
    senderEmail: 'no-reply@medicology.com',
    audience: 'students on the QBank waitlist',
    variables: ['user.firstName', 'qbank.name', 'exam.name', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('Coming soon 🚀'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>Great news — <b>{{qbank.name}}</b> is launching on {{platform.name}} for <b>{{exam.name}}</b> candidates. You’re on the list, so you’ll be among the first to know.</p>', align: 'left' },
      { type: 'button', label: 'Set a reminder', url: '{{platform.siteUrl}}/qbanks', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Waitlist notification',
    slug: 'waitlist_notification',
    category: 'transactional',
    subject: 'It’s live — {{comingSoon.name}} is now available! 🎉',
    preheader: 'Your wait is over.',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'Notify-Me subscribers',
    variables: ['user.firstName', 'comingSoon.name', 'comingSoon.ctaUrl', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('It’s here! 🎉'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>You asked us to let you know — <b>{{comingSoon.name}}</b> is now available on {{platform.name}}. First in line, as promised.</p>', align: 'left' },
      { type: 'button', label: 'Check it out →', url: '{{comingSoon.ctaUrl}}', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Exam result',
    slug: 'exam_result',
    category: 'transactional',
    subject: 'Your {{exam.name}} result is ready 📊',
    preheader: 'See how you did and what to review next.',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'users who completed an exam',
    variables: ['user.firstName', 'exam.name', 'result.score', 'result.total', 'result.percentage', 'result.passed', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('Your result is ready 📊'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>You completed <b>{{exam.name}}</b>. Here’s your summary:</p>', align: 'left' },
      { type: 'resultSummary', score: '{{result.score}}', total: '{{result.total}}', percentage: '{{result.percentage}}', passed: true },
      { type: 'text', html: '<p>Head to your analytics to see topic-level accuracy and the exact questions to revise.</p>', align: 'left' },
      { type: 'button', label: 'View my analytics', url: '{{platform.siteUrl}}/analytics', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Announcement',
    slug: 'announcement',
    category: 'transactional',
    subject: '{{announcement.title}}',
    preheader: '{{announcement.subtitle}}',
    senderName: '{{platform.name}}',
    senderEmail: 'no-reply@medicology.com',
    audience: 'platform announcements sent by email',
    variables: ['user.firstName', 'announcement.title', 'announcement.subtitle', 'announcement.body', 'announcement.ctaLabel', 'announcement.ctaUrl', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('{{announcement.title}}'),
      { type: 'text', html: '{{announcement.body}}', align: 'left' },
      { type: 'button', label: '{{announcement.ctaLabel}}', url: '{{announcement.ctaUrl}}', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Account change',
    slug: 'account_change',
    category: 'transactional',
    subject: 'Your {{platform.name}} account was updated',
    preheader: 'A change was made to your account details.',
    senderName: '{{platform.name}} Security',
    senderEmail: 'security@medicology.com',
    audience: 'users whose profile was updated',
    variables: ['user.firstName', 'user.email', 'change.description', 'platform.name', 'platform.supportEmail'],
    bodyBlocks: [
      HERO('Account updated'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>A change was made to your account: <b>{{change.description}}</b></p><p>If this was you, no further action is needed. If it wasn’t, please secure your account immediately.</p>', align: 'left' },
      { type: 'button', label: 'Review my account', url: '{{platform.siteUrl}}/settings', style: 'secondary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Security alert',
    slug: 'security_alert',
    category: 'transactional',
    subject: 'New sign-in to your {{platform.name}} account 🔔',
    preheader: 'We noticed a new login from a different device.',
    senderName: '{{platform.name}} Security',
    senderEmail: 'security@medicology.com',
    audience: 'users with a new-device login',
    variables: ['user.firstName', 'login.device', 'login.location', 'login.time', 'platform.name', 'platform.supportEmail', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('New sign-in detected 🔔'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>A new sign-in to your account happened from <b>{{login.device}}</b> ({{login.location}}) at {{login.time}}.</p>', align: 'left' },
      { type: 'text', html: '<p>If this was you, great — nothing to do. If not, revoke the session and change your password right away.</p>', align: 'left' },
      { type: 'button', label: 'Manage my sessions', url: '{{platform.siteUrl}}/settings', style: 'secondary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Admin invitation',
    slug: 'admin_invitation',
    category: 'system',
    subject: 'You’ve been invited to {{platform.name}} Admin',
    preheader: 'Set up your admin account.',
    senderName: '{{platform.name}} Admin',
    senderEmail: 'admin@medicology.com',
    audience: 'new administrators',
    variables: ['user.firstName', 'invite.role', 'invite.acceptUrl', 'platform.name', 'platform.supportEmail'],
    bodyBlocks: [
      HERO('Admin invitation 🛡️'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>You’ve been invited to join <b>{{platform.name}}</b> as a <b>{{invite.role}}</b>. Click below to accept and set up your access.</p>', align: 'left' },
      { type: 'button', label: 'Accept invitation', url: '{{invite.acceptUrl}}', style: 'primary', align: 'center' },
      { type: 'text', html: '<p>This invitation link expires in 7 days. If you weren’t expecting this, contact {{platform.supportEmail}}.</p>', align: 'left' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'New QBank launch',
    slug: 'new_qbank_launch',
    category: 'marketing',
    subject: 'New on {{platform.name}}: {{qbank.name}} ✨',
    preheader: 'Fresh content for {{exam.name}} candidates.',
    senderName: '{{platform.name}} Team',
    senderEmail: 'no-reply@medicology.com',
    audience: 'marketing — all students',
    variables: ['user.firstName', 'qbank.name', 'qbank.price', 'exam.name', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('Something new ✨'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>We just launched <b>{{qbank.name}}</b> — hand-reviewed questions mapped to the <b>{{exam.name}}</b> curriculum, with detailed explanations on every answer.</p>', align: 'left' },
      { type: 'qbankCard', name: '{{qbank.name}}', price: '{{qbank.price}}', url: '{{platform.siteUrl}}/qbanks', image: '' },
      { type: 'button', label: 'Explore {{qbank.name}}', url: '{{platform.siteUrl}}/qbanks', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
  {
    name: 'Promotion',
    slug: 'promotion',
    category: 'marketing',
    subject: 'Limited-time offer on {{platform.name}} 🎁',
    preheader: 'Grab your discount before it ends.',
    senderName: '{{platform.name}}',
    senderEmail: 'offers@medicology.com',
    audience: 'marketing — offer audience',
    variables: ['user.firstName', 'offer.code', 'offer.discount', 'offer.expiry', 'platform.name', 'platform.siteUrl'],
    bodyBlocks: [
      HERO('A gift for you 🎁'),
      { type: 'text', html: '<p>Hi <b>{{user.firstName}}</b>,</p><p>Get <b>{{offer.discount}}</b> off any QBank with code <b>{{offer.code}}</b>. Valid until {{offer.expiry}} — no catch, just more time studying what matters.</p>', align: 'left' },
      { type: 'button', label: 'Claim my offer', url: '{{platform.siteUrl}}/qbanks', style: 'primary', align: 'center' },
      FOOTER,
      UNSUBSCRIBE,
    ],
  },
];

/** Idempotent: inserts the default library only when the table is empty. */
export async function seedEmailTemplates(force = false): Promise<number> {
  const existing = await db.select().from(emailTemplatesTable);
  if (!force && existing.length > 0) return 0;
  if (!force) {
    // Only seed when there are no templates at all.
  }
  let created = 0;
  for (const t of TEMPLATES) {
    if (!force) {
      const dup = existing.filter((e: any) => e.slug === t.slug);
      if (dup.length > 0) continue;
    }
    try {
      await db.insert(emailTemplatesTable).values({
        name: t.name,
        slug: t.slug,
        category: t.category,
        subject: t.subject,
        preheader: t.preheader,
        senderName: t.senderName,
        senderEmail: t.senderEmail,
        bodyBlocks: t.bodyBlocks,
        status: 'published',
        version: 1,
        versions: [],
        variables: t.variables,
        audience: t.audience,
        language: 'en',
        createdById: null,
        updatedById: null,
      });
      created++;
    } catch (err: any) {
      console.error(`Failed to seed email template "${t.slug}":`, err.message);
    }
  }
  return created;
}

export { TEMPLATES };
