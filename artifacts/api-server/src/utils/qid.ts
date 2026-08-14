import { questionsTable } from '@workspace/db';

const QID_PREFIX = 'QID-MED';
const QID_WIDTH = 9; // zero-padded numeric portion

/**
 * Validate a user-supplied QID. Format: QID-MED-<9 digits>.
 */
export function isValidQid(value: string): boolean {
  return new RegExp(`^${QID_PREFIX}-\\d{${QID_WIDTH}}$`).test(value);
}

/**
 * Generate the next globally unique QID, e.g. "QID-MED-000001245".
 *
 * Uses the highest existing numeric suffix so it works on both PostgreSQL and
 * the in-memory mock DB. Sequential and immutable: a QID never changes even if
 * the question moves topics or QBanks.
 */
export async function generateQid(db: any): Promise<string> {
  const rows = await db.select({ qid: questionsTable.qid }).from(questionsTable);
  const suffix = rows
    .map((r: any) => r.qid)
    .filter((q: string | null | undefined): q is string => !!q)
    .map((q: string) => Number(q.replace(`${QID_PREFIX}-`, '')))
    .filter((n: number) => Number.isFinite(n))
    .reduce((max: number, n: number) => Math.max(max, n), 0);

  const next = suffix + 1;
  return `${QID_PREFIX}-${String(next).padStart(QID_WIDTH, '0')}`;
}
