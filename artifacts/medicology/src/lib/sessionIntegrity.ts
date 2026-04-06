function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function hashAnswers(answers: Record<string, unknown>): string {
  return djb2(JSON.stringify(answers)).toString(36);
}

const CHECKSUM_KEY = "_medi_si";

export function storeChecksum(answers: Record<string, unknown>) {
  try {
    sessionStorage.setItem(CHECKSUM_KEY, hashAnswers(answers));
  } catch {}
}

export function verifyChecksum(answers: Record<string, unknown>): boolean {
  try {
    const stored = sessionStorage.getItem(CHECKSUM_KEY);
    if (!stored) return true;
    return stored === hashAnswers(answers);
  } catch { return true; }
}

export function clearChecksum() {
  try { sessionStorage.removeItem(CHECKSUM_KEY); } catch {}
}

export function createSessionToken(sessionId: string): string {
  const payload = `${sessionId}:${Date.now()}:${navigator.userAgent.slice(0, 20)}`;
  return btoa(payload);
}
