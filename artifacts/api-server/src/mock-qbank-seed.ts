// QBank seed data for the in-memory mock database (dev mode).
// QBanks are products scoped to the taxonomy (exam → program → academic year)
// and carry their own status/price — mirroring how production data will be
// administered. No products are hard-coded in API routes.

export interface SeedQbank {
  id: number;
  slug: string;
  name: string;
  description: string;
  countryId: number | null;
  examSystemId: number | null;
  examId: number | null;
  programId: number | null;
  academicYearId: number | null;
  status: 'planned' | 'coming_soon' | 'beta' | 'available' | 'paused' | 'archived';
  price: number;
  currency: string;
  durationDays: number;
  accessType: string;
  sortOrder: number;
  active: boolean;
}

const PKR = 'PKR';

export const SEED_QBANKS: SeedQbank[] = [
  // UHS MBBS — available years (content seeded) + coming-soon BDS years
  { id: 1, slug: 'uhs-mbbs-1st-year', name: 'UHS MBBS 1st Year', description: 'Complete UHS MBBS 1st year question bank — Anatomy, Physiology, Biochemistry.', countryId: 1, examSystemId: 1, examId: 1, programId: 1, academicYearId: 1, status: 'available', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 1, active: true },
  { id: 2, slug: 'uhs-mbbs-2nd-year', name: 'UHS MBBS 2nd Year', description: 'Complete UHS MBBS 2nd year question bank.', countryId: 1, examSystemId: 1, examId: 1, programId: 1, academicYearId: 2, status: 'available', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 2, active: true },
  { id: 3, slug: 'uhs-mbbs-3rd-year', name: 'UHS MBBS 3rd Year', description: 'Complete UHS MBBS 3rd year question bank.', countryId: 1, examSystemId: 1, examId: 1, programId: 1, academicYearId: 3, status: 'available', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 3, active: true },
  { id: 4, slug: 'uhs-mbbs-4th-year', name: 'UHS MBBS 4th Year', description: 'Complete UHS MBBS 4th year question bank — Medicine, Surgery, ENT, Ophthalmology, Community Medicine.', countryId: 1, examSystemId: 1, examId: 1, programId: 1, academicYearId: 4, status: 'available', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 4, active: true },
  { id: 5, slug: 'uhs-mbbs-final-year', name: 'UHS MBBS Final Year', description: 'Complete UHS MBBS Final year question bank.', countryId: 1, examSystemId: 1, examId: 1, programId: 1, academicYearId: 5, status: 'available', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 5, active: true },
  { id: 6, slug: 'uhs-bds-1st-year', name: 'UHS BDS 1st Year', description: 'UHS BDS 1st year question bank — coming soon.', countryId: 1, examSystemId: 1, examId: 1, programId: 2, academicYearId: 6, status: 'coming_soon', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 6, active: true },
  { id: 7, slug: 'uhs-bds-2nd-year', name: 'UHS BDS 2nd Year', description: 'UHS BDS 2nd year question bank — coming soon.', countryId: 1, examSystemId: 1, examId: 1, programId: 2, academicYearId: 7, status: 'coming_soon', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 7, active: true },
  { id: 8, slug: 'uhs-bds-3rd-year', name: 'UHS BDS 3rd Year', description: 'UHS BDS 3rd year question bank — coming soon.', countryId: 1, examSystemId: 1, examId: 1, programId: 2, academicYearId: 8, status: 'coming_soon', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 8, active: true },
  { id: 9, slug: 'uhs-bds-4th-year', name: 'UHS BDS 4th Year', description: 'UHS BDS 4th year question bank — coming soon.', countryId: 1, examSystemId: 1, examId: 1, programId: 2, academicYearId: 9, status: 'coming_soon', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 9, active: true },
  // Other Pakistan universities
  { id: 10, slug: 'kmu-mbbs', name: 'KMU MBBS', description: 'Khyber Medical University MBBS question bank — coming soon.', countryId: 1, examSystemId: 1, examId: 2, programId: 3, academicYearId: null, status: 'coming_soon', price: 999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 10, active: true },
  // Professional exams
  { id: 11, slug: 'fcps-part1', name: 'FCPS Part I', description: 'FCPS Part I basic sciences question bank.', countryId: 1, examSystemId: 2, examId: 9, programId: 4, academicYearId: null, status: 'available', price: 1499, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 11, active: true },
  // International
  { id: 12, slug: 'usmle-step1', name: 'USMLE Step 1', description: 'USMLE Step 1 question bank — coming soon.', countryId: 3, examSystemId: 3, examId: 13, programId: 6, academicYearId: null, status: 'available', price: 1999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 12, active: true },
  { id: 13, slug: 'usmle-step2ck', name: 'USMLE Step 2 CK', description: 'USMLE Step 2 CK question bank — coming soon.', countryId: 3, examSystemId: 3, examId: 13, programId: 7, academicYearId: null, status: 'available', price: 1999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 13, active: true },
  { id: 14, slug: 'plab1', name: 'PLAB 1', description: 'PLAB 1 question bank — coming soon.', countryId: 2, examSystemId: 3, examId: 14, programId: 8, academicYearId: null, status: 'coming_soon', price: 1999, currency: PKR, durationDays: 365, accessType: 'subscription', sortOrder: 14, active: true },
];

/** Map seeded questions to QBanks by their legacy tag fields (dev convenience). */
export function buildQbankQuestionMapping(questions: Array<{ id: number; universityTag?: string | null; examType?: string | null; qbankType?: string | null }>): Array<{ qbankId: number; questionId: number }> {
  const slugFor = (q: { universityTag?: string | null; examType?: string | null; qbankType?: string | null }): string | null => {
    if (q.universityTag === 'UHS') {
      const year = (q.examType ?? '').match(/MBBS (\w+ Year)/)?.[1];
      if (year) return `uhs-mbbs-${year.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (q.examType === 'FCPS Part 1') return 'fcps-part1';
    if (q.examType === 'USMLE Step 1') return 'usmle-step1';
    if (q.examType === 'USMLE Step 2 CK') return 'usmle-step2ck';
    return null;
  };

  const bySlug = new Map(SEED_QBANKS.map((q) => [q.slug, q.id]));
  const out: Array<{ qbankId: number; questionId: number }> = [];
  for (const question of questions) {
    const slug = slugFor(question);
    const qbankId = slug ? bySlug.get(slug) : undefined;
    if (qbankId !== undefined) {
      out.push({ qbankId, questionId: question.id });
    }
  }
  return out;
}
