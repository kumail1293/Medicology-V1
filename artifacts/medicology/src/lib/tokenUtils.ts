/**
 * Shared token utilities to prevent duplication
 * Used by both auth.tsx and api.ts
 */

export interface TokenPayload {
  id: number;
  email: string;
  isAdmin: boolean;
  role: string;
  exp: number;
  iat: number;
}

/**
 * Check if JWT token is expired
 * @param token JWT token string
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as TokenPayload;
    return payload.exp * 1000 < Date.now();
  } catch {
    // If token can't be decoded, consider it expired
    return true;
  }
}

/**
 * Decode JWT token to get payload (without verification)
 * @param token JWT token string
 * @returns Token payload or null if invalid
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return JSON.parse(atob(token.split(".")[1])) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Get time remaining until token expires (in milliseconds)
 * @param token JWT token string
 * @returns Milliseconds until expiration, or 0 if expired
 */
export function getTokenExpirationTime(token: string): number {
  const payload = decodeToken(token);
  if (!payload) return 0;
  const expirationMs = payload.exp * 1000;
  const now = Date.now();
  return Math.max(0, expirationMs - now);
}
