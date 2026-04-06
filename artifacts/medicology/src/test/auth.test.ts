import { describe, it, expect } from "vitest";
import { isTokenExpired } from "../lib/auth";

function makeJwt(expOffsetSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub: "1", exp }));
  return `${header}.${payload}.fakesig`;
}

describe("isTokenExpired", () => {
  it("returns false for a future token", () => {
    const token = makeJwt(3600);
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true for a past token", () => {
    const token = makeJwt(-60);
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for a malformed token", () => {
    expect(isTokenExpired("not.a.jwt")).toBe(true);
    expect(isTokenExpired("")).toBe(true);
  });
});
