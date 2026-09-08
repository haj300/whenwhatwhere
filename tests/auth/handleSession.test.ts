import { describe, expect, test } from "bun:test";
import { signHandleToken, verifyHandleToken } from "../../server/auth/handleSession";
import { signToken, verifyToken } from "../../server/auth/jwt";

describe("handle session helpers", () => {
  test("signs and verifies a round trip", () => {
    const token = signHandleToken({ handleId: 7, username: "katja" });
    const payload = verifyHandleToken(token);
    expect(payload.handleId).toBe(7);
    expect(payload.username).toBe("katja");
  });

  test("rejects a tampered token", () => {
    const token = signHandleToken({ handleId: 1, username: "x" });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(() => verifyHandleToken(tampered)).toThrow();
  });

  test("a real login token never verifies as a handle session", () => {
    const userToken = signToken({ userId: 1, role: "ADMIN" });
    expect(() => verifyHandleToken(userToken)).toThrow();
  });

  test("a handle session token never verifies as a real login", () => {
    const handleToken = signHandleToken({ handleId: 1, username: "x" });
    expect(() => verifyToken(handleToken)).toThrow();
  });
});
