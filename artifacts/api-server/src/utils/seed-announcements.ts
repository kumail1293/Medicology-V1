// ============================================================================
// Prebuilt announcement templates + active in-app announcements seeder.
//
// Seeds beautiful, reusable announcement templates (for admins to pick from
// when creating announcements) and a set of active general + personalized
// announcements (in-app only, delivered via /api/announcements/active).
// Idempotent: skipped when the tables already contain rows.
// ============================================================================

import { db } from '../db.js';
import { announcementsTable, announcementTemplatesTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';

// ---------------------------------------------------------------------------
// Prebuilt templates — beautiful, reusable skeletons for the announcement
// builder. Each one has rich HTML content with emojis, styled lists, and
// clear CTAs. Admins create an announcement "from template" to prefill.
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: 'Exam Countdown',
    category: 'exam_alert',
    type: 'exam_alert',
    title: '🔔 {examName} is {days} Days Away — You\'ve Got This!',
    content: `<p>Dear medic,</p>
<p>Your <strong>{examName}</strong> is just <strong>{days} days</strong> away — and you\'re closer than you think. This is the moment to consolidate what you know and sharpen the edges.</p>
<h3 style="margin-top:1rem">Quick Tips for the Final Stretch</h3>
<ul style="padding-left:1.25rem">
  <li><strong>Focus on high-yield topics</strong> — the ones that show up every year.</li>
  <li><strong>Do timed MCQs daily</strong> — exam rhythm matters as much as knowledge.</li>
  <li><strong>Review your wrong answers</strong> — every mistake is a free point next time.</li>
</ul>
<p>Medicology is with you every step of the way. You\'ve put in the work — now go show them what you\'ve learned.</p>`,
    buttonText: 'Start Focused Review →',
    buttonUrl: null,
    theme: 'warning',
    priority: 'high',
    targetRoles: 'all',
  },
  {
    name: 'New QBank Launch',
    category: 'qbank_launch',
    type: 'popup',
    title: '📚 New QBank: {qbankName} is Here!',
    content: `<p>Great news — our newest QBank is live and ready for you.</p>
<p><strong>{qbankName}</strong> brings you <strong>{questionCount} exam-style MCQs</strong> with detailed explanations, covering every major topic you need for your exam.</p>
<h3 style="margin-top:1rem">What\'s Inside</h3>
<ul style="padding-left:1.25rem">
  <li>✅ <strong>Exam-aligned questions</strong> — built from the latest paper patterns.</li>
  <li>✅ <strong>Detailed explanations</strong> — understand the "why" behind every answer.</li>
  <li>✅ <strong>Progress tracking</strong> — see your weak areas improve over time.</li>
  <li>✅ <strong>Timed mock tests</strong> — simulate real exam conditions.</li>
</ul>
<p>Ready to dive in? Your next breakthrough is one question away.</p>`,
    buttonText: 'Explore {qbankName} →',
    buttonUrl: null,
    theme: 'success',
    priority: 'high',
    targetRoles: 'all',
  },
  {
    name: 'Feature Spotlight',
    category: 'feature',
    type: 'toast',
    title: '✨ Meet {featureName} — Your New Study Superpower',
    content: `<p>We\'ve been working on something special, and it\'s finally here.</p>
<p><strong>{featureName}</strong> helps you <strong>{featureBenefit}</strong> — so you spend less time figuring out what to study and more time actually learning.</p>
<p>Look for it in your dashboard. We think you\'ll love it.</p>`,
    buttonText: 'Try It Now',
    buttonUrl: null,
    theme: 'primary',
    priority: 'normal',
    targetRoles: 'all',
  },
  {
    name: 'Maintenance Notice',
    category: 'maintenance',
    type: 'banner',
    title: '🛠️ Scheduled Maintenance on {date}',
    content: `<p>We\'ll be performing scheduled maintenance on <strong>{date}</strong> from <strong>{startTime} to {endTime}</strong> (PKT).</p>
<p>During this window, you may experience brief interruptions to <strong>{newFeatures}</strong>. All your data, progress, and entitlements are safe — we\'ll be back online as scheduled.</p>
<p>Thank you for your patience. Questions? Reach out to support@medicology.net.</p>`,
    buttonText: 'View Details',
    buttonUrl: null,
    theme: 'info',
    priority: 'normal',
    targetRoles: 'all',
  },
  {
    name: 'Promo Banner',
    category: 'promotion',
    type: 'banner',
    title: '🎉 {promoTitle} — {promoOffer}',
    content: `<p>Don\'t miss out — <strong>{promoOffer}</strong> on <strong>{promoTitle}</strong>.</p>
<p>This limited-time offer is available to all active Medicology users. Upgrade now and supercharge your exam prep with exclusive features, ad-free study sessions, and priority support.</p>
<p style="text-align:center;margin-top:1rem"><strong>Hurry — this offer expires on {expiryDate}.</strong></p>`,
    buttonText: 'Claim Offer →',
    buttonUrl: null,
    theme: 'primary',
    priority: 'high',
    targetRoles: 'all',
  },
];

// ---------------------------------------------------------------------------
// Active general announcements — visible to every in-app user (targetRoles
// covers "all" or specific roles). These are the "beautiful" live banners,
// popups, and toasts that make the app feel alive from first boot.
// ---------------------------------------------------------------------------

const GENERAL_ANNOUNCEMENTS = [
  {
    type: 'banner',
    title: 'Welcome back to Medicology 👋',
    content: `<p style="margin:0">Your study progress is waiting. Pick up where you left off — every question you answer today is a step closer to your exam.</p>`,
    buttonText: 'Go to Dashboard →',
    buttonUrl: '/dashboard',
    targetRoles: 'all',
    priority: 'normal',
    theme: 'info',
    dismissible: true,
    frequency: 'once',
    isActive: true,
  },
  {
    type: 'modal',
    title: '✨ What\'s New in Medicology',
    content: `<div style="display:flex;gap:12px;margin-bottom:14px">
  <div style="flex:1;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:12px;padding:14px;color:#fff">
    <div style="font-size:26px;margin-bottom:6px">📚</div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Smart Review</h3>
    <p style="font-size:12.5px;opacity:0.92;line-height:1.45;margin:0">Spaced repetition that adapts to your weak areas automatically.</p>
  </div>
  <div style="flex:1;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:12px;padding:14px;color:#fff">
    <div style="font-size:26px;margin-bottom:6px">🎯</div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Exam Mode</h3>
    <p style="font-size:12.5px;opacity:0.92;line-height:1.45;margin:0">Timed mocks that mirror real exam patterns and difficulty.</p>
  </div>
  <div style="flex:1;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:12px;padding:14px;color:#fff">
    <div style="font-size:26px;margin-bottom:6px">🤝</div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Study Buddies</h3>
    <p style="font-size:12.5px;opacity:0.92;line-height:1.45;margin:0">Compete and collaborate with friends on the same exam.</p>
  </div>
</div>
<p style="text-align:center;margin-top:6px"><strong>Three powerful ways to study — all in one place.</strong></p>
<p style="text-align:center;color:#9ca3af;font-size:13px;margin:0">Ready to experience the new Medicology?</p>`,
    buttonText: 'Explore Features →',
    buttonUrl: '/dashboard',
    targetRoles: 'all',
    priority: 'normal',
    theme: 'primary',
    dismissible: true,
    frequency: 'daily',
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Active personalized announcements — visible only to the targeted user IDs
// (targetUserIds). In-app only. These show the personalized path: e.g. a
// premium upgrade nudge aimed at specific users.
// ---------------------------------------------------------------------------

const PERSONALIZED_ANNOUNCEMENTS = [
  {
    type: 'popup',
    title: 'Medicology Premium — Designed for Your Success',
    content: `<p>Hi there,</p>
<p>We noticed you\'re serious about your medical exam preparation — and we want to match that energy.</p>
<p><strong>Medicology Premium</strong> gives you:</p>
<ul style="padding-left:1.25rem">
  <li><strong>✓ Unlimited access</strong> to all QBanks and question banks.</li>
  <li><strong>✓ Advanced analytics</strong> — see your performance by topic, system, and exam.</li>
  <li><strong>✓ Priority support</strong> — get answers when you need them.</li>
  <li><strong>✓ Early access</strong> to new features and content.</li>
</ul>
<p>Your dedication deserves the best tools. Let us help you get there.</p>`,
    buttonText: 'Unlock Premium →',
    buttonUrl: '/premium',
    targetUserIds: [1],
    priority: 'high',
    theme: 'success',
    dismissible: true,
    frequency: 'once',
    isActive: true,
  },
  {
    type: 'toast',
    title: '⏰ Your Daily Study Check-In',
    content: `<p><strong>You\'re on a roll!</strong> Keep your momentum going — just a few minutes of focused practice today keeps your progress streak alive.</p>
<p>Open Medicology and knock out 5 quick MCQs. Small steps, big results.</p>`,
    buttonText: 'Start Now →',
    buttonUrl: '/practice',
    targetUserIds: [1],
    priority: 'normal',
    theme: 'success',
    dismissible: true,
    frequency: 'every_visit',
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

export async function seedAnnouncements(): Promise<{
  templates: number;
  general: number;
  personalized: number;
}> {
  const now = new Date();
  let templates = 0;
  let general = 0;
  let personalized = 0;

  // --- Templates (skip if any already exist) ---
  try {
    const existing = await db.select().from(announcementTemplatesTable).limit(1);
    if (existing.length === 0) {
      for (const t of TEMPLATES) {
        await db.insert(announcementTemplatesTable).values({
          ...t,
          createdAt: now,
          updatedAt: now,
        });
        templates++;
      }
      console.log(`📢 Seeded ${templates} announcement templates`);
    }
  } catch (err: any) {
    console.warn('Announcement template seeding skipped:', err.message);
  }

  // --- General announcements (skip if any active ones exist) ---
  try {
    const existing = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.isActive, true))
      .limit(1);
    if (existing.length === 0) {
      for (const a of GENERAL_ANNOUNCEMENTS) {
        await db.insert(announcementsTable).values({
          ...a,
          createdAt: now,
          updatedAt: now,
        });
        general++;
      }
      console.log(`📢 Seeded ${general} general announcements`);
    }
  } catch (err: any) {
    console.warn('General announcement seeding skipped:', err.message);
  }

  // --- Personalized announcements (skip if any targeted ones exist) ---
  try {
    const existing = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.targetUserIds, JSON.stringify([1])))
      .limit(1);
    if (existing.length === 0) {
      for (const a of PERSONALIZED_ANNOUNCEMENTS) {
        await db.insert(announcementsTable).values({
          ...a,
          createdAt: now,
          updatedAt: now,
        });
        personalized++;
      }
      console.log(`📢 Seeded ${personalized} personalized announcements`);
    }
  } catch (err: any) {
    console.warn('Personalized announcement seeding skipped:', err.message);
  }

  return { templates, general, personalized };
}
