// ============================================================================
// Seeder: prebuilt announcement templates + active in-app announcements.
// ============================================================================

import { db } from '../db.js';
import { announcementsTable, announcementTemplatesTable } from '@workspace/db';
import { eq } from '../utils/drizzle.js';

// ---------------------------------------------------------------------------
// Templates — beautiful, reusable, cover all 7 schema categories.
// Admins pick from these when creating announcements.
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: 'Exam Countdown',
    category: 'exam_alert',
    type: 'exam_alert',
    title: '🔔 {examName} is {days} Days Away — You\'ve Got This!',
    content: `<div style="display:flex;gap:14px;margin-bottom:14px">
  <div style="flex:1;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:14px;padding:16px;color:#fff">
    <div style="font-size:32px;margin-bottom:6px">🔔</div>
    <div style="font-size:28px;font-weight:800;line-height:1.1">{days}</div>
    <div style="font-size:13px;opacity:0.92">days to go</div>
  </div>
  <div style="flex:2;background:#fff;border-radius:14px;padding:16px;color:#1f2937;border:1px solid #e5e7eb">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px">{examName}</div>
    <div style="font-size:12.5px;color:#6b7280;line-height:1.5">Your countdown starts now. Every day you prepare is a day closer.</div>
  </div>
</div>
<h3 style="margin-top:6px">Final Stretch Strategy</h3>
<ul style="padding-left:1.25rem;margin-bottom:12px">
  <li><strong>High-yield focus</strong> — target the topics that appear every year.</li>
  <li><strong>Timed practice daily</strong> — exam rhythm is a skill. Build it now.</li>
  <li><strong>Wrong-answer review</strong> — every mistake is a free point on exam day.</li>
</ul>
<p style="margin:0">Medicology is with you every step. You\'ve put in the work — now go show them.</p>`,
    buttonText: 'Start Focused Review →',
    buttonUrl: null,
    theme: 'warning',
    priority: 'high',
    targetRoles: 'all',
  },
  {
    name: 'QBank Launch — New Paper',
    category: 'qbank_launch',
    type: 'popup',
    title: '📚 New QBank: {qbankName} is Live!',
    content: `<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
  <span style="display:inline-flex;align-items:center;gap:5px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#166534">✅ {questionCount} exam-style MCQs</span>
  <span style="display:inline-flex;align-items:center;gap:5px;background:#dbeafe;border:1px solid #bfdbfe;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#1e40af">📝 Detailed explanations</span>
  <span style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#92400e">🎯 Progress tracking</span>
  <span style="display:inline-flex;align-items:center;gap:5px;background:#f3e8ff;border:1px solid #e9d5ff;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#6b21a8">⏱️ Timed mocks</span>
</div>
<p><strong>{qbankName}</strong> is built from the latest paper patterns and covers every major topic you need.</p>
<h3 style="margin-top:6px">What\'s Inside</h3>
<ul style="padding-left:1.25rem">
  <li><strong>Exam-aligned</strong> — built from the latest question patterns and marking schemes.</li>
  <li><strong>Explanations that teach</strong> — every answer comes with the "why", not just the "what".</li>
  <li><strong>See your weak spots</strong> — topic-by-topic analytics that show where to focus.</li>
  <li><strong>Exam-condition mocks</strong> — timed, full-length tests that feel real.</li>
</ul>
<p style="margin-top:10px">Your next breakthrough is one question away.</p>`,
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
    name: 'Maintenance Window',
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
    type: 'promotion',
    title: '🎉 {promoTitle} — {promoOffer}',
    content: `<div style="text-align:center;margin-bottom:12px">
  <div style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:999px;padding:6px 18px;font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">🔥 Limited Time Only</div>
  <p style="font-size:14px;color:#4b5563;margin:0">{promoOffer} on <strong>{promoTitle}</strong></p>
  <p style="font-size:12.5px;color:#9ca3af;margin:6px 0 0 0">Upgrade now and supercharge your exam prep with exclusive features, ad-free sessions, and priority support.</p>
</div>
<p style="text-align:center;margin:0"><strong>Offer expires {expiryDate}.</strong></p>`,
    buttonText: 'Claim Offer →',
    buttonUrl: null,
    theme: 'primary',
    priority: 'high',
    targetRoles: 'all',
  },
  {
    name: 'System Update — What Changed',
    category: 'system_notice',
    type: 'banner',
    title: '🔄 System Update — Here\'s What Changed',
    content: `<p>We\'ve shipped a system update. Here\'s a quick summary of what\'s new and what changed:</p>
<ul style="padding-left:1.25rem;margin-bottom:8px">
  <li><strong>{change1}</strong></li>
  <li><strong>{change2}</strong></li>
  <li><strong>{change3}</strong></li>
</ul>
<p>Everything else works as before. If something looks off, let us know at support@medicology.net.</p>`,
    buttonText: 'Read Release Notes',
    buttonUrl: null,
    theme: 'info',
    priority: 'normal',
    targetRoles: 'all',
  },
  {
    name: 'Policy Change Notice',
    category: 'system_notice',
    type: 'modal',
    title: '📋 Important: {policyTitle}',
    content: `<p>Hi there,</p>
<p>We\'re writing to let you know about an important change to <strong>{policyTitle}</strong>.</p>
<h3 style="margin-top:10px">What\'s Changing</h3>
<ul style="padding-left:1.25rem">
  <li>{changeDetail1}</li>
  <li>{changeDetail2}</li>
</ul>
<h3 style="margin-top:10px">What You Need to Do</h3>
<p style="margin:0">{actionRequired}</p>
<p style="margin-top:10px">If you have questions, our support team is here to help.</p>`,
    buttonText: 'Read Full Policy →',
    buttonUrl: null,
    theme: 'warning',
    priority: 'high',
    targetRoles: 'all',
  },
  {
    name: 'Custom Announcement',
    category: 'custom',
    type: 'banner',
    title: '{customTitle}',
    content: `<p>{customBody}</p>
<p>{customBody2}</p>`,
    buttonText: '{customCta}',
    buttonUrl: null,
    theme: 'primary',
    priority: 'normal',
    targetRoles: 'all',
  },
  {
    name: 'Achievement Celebration',
    category: 'custom',
    type: 'toast',
    title: '🏆 You Did It, {userName}!',
    content: `<p><strong>Congratulations!</strong> You just reached a major milestone: {achievement}.</p>
<p>That\'s real progress. Keep going — your next milestone is closer than you think.</p>`,
    buttonText: 'Keep Going →',
    buttonUrl: '/practice',
    theme: 'success',
    priority: 'normal',
    targetRoles: 'all',
  },
];

// ---------------------------------------------------------------------------
// Active general announcements — in-app, visible to all users.
// ---------------------------------------------------------------------------

const GENERAL_ANNOUNCEMENTS = [
  {
    type: 'banner',
    title: 'Welcome back to Medicology 👋',
    content: `<div style="display:flex;align-items:center;gap:12px">
  <div style="display:flex;align-items:center;gap:4px">
    <span style="font-size:18px">👋</span>
    <span style="font-weight:700;color:#1f2937">Welcome back</span>
  </div>
  <div style="flex:1;height:2px;background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 50%,transparent 100%);border-radius:999px"></div>
</div>
<p style="margin:6px 0 0 0">Your study progress is waiting. Pick up where you left off — every question you answer today is a step closer to your exam.</p>`,
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
    content: `<div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
  <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:14px;padding:16px;color:#fff">
    <div style="font-size:30px;margin-bottom:8px">📚</div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Smart Review</h3>
    <p style="font-size:12.5px;opacity:0.92;line-height:1.5;margin:0">Spaced repetition that adapts to your weak areas automatically.</p>
  </div>
  <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:14px;padding:16px;color:#fff">
    <div style="font-size:30px;margin-bottom:8px">🎯</div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Exam Mode</h3>
    <p style="font-size:12.5px;opacity:0.92;line-height:1.5;margin:0">Timed mocks that mirror real exam patterns and difficulty.</p>
  </div>
  <div style="flex:1;min-width:140px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:14px;padding:16px;color:#fff">
    <div style="font-size:30px;margin-bottom:8px">🤝</div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Study Buddies</h3>
    <p style="font-size:12.5px;opacity:0.92;line-height:1.5;margin:0">Compete and collaborate with friends on the same exam.</p>
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
// Active personalized announcements — in-app, targeted by user IDs.
// ---------------------------------------------------------------------------

const PERSONALIZED_ANNOUNCEMENTS = [
  {
    type: 'popup',
    title: 'Medicology Premium — Unlocked for You',
    content: `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
  <span style="display:inline-flex;align-items:center;gap:5px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#166534">✅ Unlimited QBanks</span>
  <span style="display:inline-flex;align-items:center;gap:5px;background:#dbeafe;border:1px solid #bfdbfe;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#1e40af">📊 Advanced analytics</span>
  <span style="display:inline-flex;align-items:center;gap:5px;background:#f3e8ff;border:1px solid #e9d5ff;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;color:#6b21a8">🎧 Priority support</span>
</div>
<p>We noticed you\'re serious about your exam prep — and we want to match that energy. Medicology Premium gives you everything you need to go from studying to passing.</p>
<h3 style="margin-top:8px">What\'s Included</h3>
<ul style="padding-left:1.25rem">
  <li><strong>Unlimited access</strong> to all QBanks and question banks across every exam.</li>
  <li><strong>Advanced analytics</strong> — topic-by-topic performance, weak-area detection, and progress trends.</li>
  <li><strong>Priority support</strong> — get answers fast, when you need them most.</li>
  <li><strong>Early access</strong> to every new feature and content drop, before anyone else.</li>
</ul>
<p style="margin-top:10px">Your dedication deserves the best tools. Let us help you get there.</p>`,
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
    title: '⏰ {streak} Day Streak — Keep It Going!',
    content: `<p><strong>You\'re on a roll, {userName}!</strong> A {streak}-day study streak is no small thing — it means consistency, and consistency is what passes exams.</p>
<p>Just a few minutes of focused practice today keeps the streak alive. Open Medicology and knock out 5 quick MCQs. Small steps, big results.</p>`,
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
// Seeder function — idempotent, skips if rows already exist.
// ---------------------------------------------------------------------------

export async function seedAnnouncements() {
  const now = new Date();
  let t = 0, g = 0, p = 0;

  try {
    const has = await db.select().from(announcementTemplatesTable).limit(1);
    if (!has.length) {
      for (const tmpl of TEMPLATES) {
        await db.insert(announcementTemplatesTable).values({ ...tmpl, createdAt: now, updatedAt: now });
        t++;
      }
      console.log(`📢 Seeded ${t} announcement templates`);
    }
  } catch (e) { console.warn('Template seeding skipped:', (e as any).message); }

  try {
    const has = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.isActive, true)).limit(1);
    if (!has.length) {
      for (const a of GENERAL_ANNOUNCEMENTS) {
        await db.insert(announcementsTable).values({ ...a, createdAt: now, updatedAt: now });
        g++;
      }
      console.log(`📢 Seeded ${g} general announcements`);
    }
  } catch (e) { console.warn('General seeding skipped:', (e as any).message); }

  try {
    const has = await db.select().from(announcementsTable)
      .where(eq(announcementsTable.targetUserIds, JSON.stringify([1]))).limit(1);
    if (!has.length) {
      for (const a of PERSONALIZED_ANNOUNCEMENTS) {
        await db.insert(announcementsTable).values({ ...a, createdAt: now, updatedAt: now });
        p++;
      }
      console.log(`📢 Seeded ${p} personalized announcements`);
    }
  } catch (e) { console.warn('Personalized seeding skipped:', (e as any).message); }

  return { templates: t, general: g, personalized: p };
}
