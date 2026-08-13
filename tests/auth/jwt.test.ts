import { describe, expect, test } from "bun:test";
import { signToken, verifyToken } from "../../server/auth/jwt";

describe("jwt helpers", () => {
  test("signs and verifies a round trip", () => {
    const token = signToken({ userId: 7, role: "ADMIN" });
    const payload = verifyToken(token);
    expect(payload.userId).toBe(7);
    expect(payload.role).toBe("ADMIN");
  });

  test("rejects a tampered token", () => {
    const token = signToken({ userId: 1, role: "CONTRIBUTOR" });
    // flip the last char so the signature no longer matches:
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(() => verifyToken(tampered)).toThrow();
  });
});
