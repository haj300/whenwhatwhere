import { describe, expect, test } from "bun:test";
import { generateToken, hashToken } from "../../server/auth/tokens";

describe("Generate invite token", () => {
  test("generateToken returns 64 hex chars", () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generateToken is unique per call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  test("hashToken returns 64 hex chars", () => {
    const token = generateToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("hashToken is deterministic", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  test("hashToken differs from input", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    // assert that the hash is not a substring of the token
    expect(token.includes(hash)).toBe(false);
  });
});
