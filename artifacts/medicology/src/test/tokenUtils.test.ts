import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isTokenExpired, decodeToken, getTokenExpirationTime } from "../lib/tokenUtils";

function makeJwt(payloadObj: object): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify(payloadObj));
  return `${header}.${payload}.fakesig`;
}

describe("tokenUtils", () => {
  const nowMs = 1700000000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("decodeToken", () => {
    it("decodes a valid JWT token payload correctly", () => {
      const payload = { id: 1, email: "test@example.com", isAdmin: false, role: "user", exp: 1700003600, iat: 1700000000 };
      const token = makeJwt(payload);
      expect(decodeToken(token)).toEqual(payload);
    });

    it("returns null for malformed tokens", () => {
      expect(decodeToken("invalid-token")).toBeNull();
      expect(decodeToken("part1.part2")).toBeNull();
      expect(decodeToken("")).toBeNull();
    });

    it("returns null if middle segment is not valid base64 JSON", () => {
      expect(decodeToken("a.not-json.c")).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("returns false for a future expiration date", () => {
      const token = makeJwt({ exp: (nowMs / 1000) + 100 });
      expect(isTokenExpired(token)).toBe(false);
    });

    it("returns true for a past expiration date", () => {
      const token = makeJwt({ exp: (nowMs / 1000) - 10 });
      expect(isTokenExpired(token)).toBe(true);
    });

    it("returns false when token exp equals current time (not strictly less than current time)", () => {
      const token = makeJwt({ exp: nowMs / 1000 });
      expect(isTokenExpired(token)).toBe(false);
    });

    it("returns true for invalid/malformed tokens", () => {
      expect(isTokenExpired("bad.token.here")).toBe(true);
      expect(isTokenExpired("")).toBe(true);
    });
  });

  describe("getTokenExpirationTime", () => {
    it("returns remaining milliseconds until expiration", () => {
      const token = makeJwt({ exp: (nowMs / 1000) + 60 });
      expect(getTokenExpirationTime(token)).toBe(60000);
    });

    it("returns 0 if token is already expired", () => {
      const token = makeJwt({ exp: (nowMs / 1000) - 10 });
      expect(getTokenExpirationTime(token)).toBe(0);
    });

    it("returns 0 for malformed token", () => {
      expect(getTokenExpirationTime("bad-token")).toBe(0);
    });
  });
});
