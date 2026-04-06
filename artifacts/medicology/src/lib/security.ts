export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

export function sanitizeInput(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/`/g, "&#x60;")
    .replace(/\//g, "&#x2F;")
    .slice(0, 5000);
}

export function sanitizeQuery(str: string): string {
  return str
    .replace(/[<>"'`;(){}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

export function isValidPakistaniPhone(phone: string): boolean {
  return /^03[0-9]{9}$/.test(phone);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 254;
}

export function isStrongPassword(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p);
}

const _buckets: Record<string, { count: number; resetAt: number }> = {};
export function clientRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  if (!_buckets[key] || now > _buckets[key].resetAt) {
    _buckets[key] = { count: 1, resetAt: now + 60_000 };
    return true;
  }
  if (_buckets[key].count >= maxPerMinute) return false;
  _buckets[key].count++;
  return true;
}
