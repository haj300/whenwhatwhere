import { describe, expect, test } from "bun:test";
import type { Context } from "koa";
import { getCommentIdentity } from "../../server/middleware/commentIdentity";
import { signToken } from "../../server/auth/jwt";
import { signHandleToken } from "../../server/auth/handleSession";

function fakeCtx(cookies: Record<string, string>): Context {
  return { cookies: { get: (name: string) => cookies[name] } } as unknown as Context;
}

describe("getCommentIdentity", () => {
  test("returns a user identity from a valid token cookie", () => {
    const token = signToken({ userId: 5, role: "CONTRIBUTOR" });
    expect(getCommentIdentity(fakeCtx({ token }))).toEqual({
      kind: "user",
      userId: 5,
      role: "CONTRIBUTOR",
    });
  });

  test("returns a handle identity from a valid handleToken cookie", () => {
    const handleToken = signHandleToken({ handleId: 3, username: "katja" });
    expect(getCommentIdentity(fakeCtx({ handleToken }))).toEqual({
      kind: "handle",
      handleId: 3,
      username: "katja",
    });
  });

  test("prefers a real user session over a handle cookie if both are present", () => {
    const token = signToken({ userId: 5, role: "CONTRIBUTOR" });
    const handleToken = signHandleToken({ handleId: 3, username: "katja" });
    expect(getCommentIdentity(fakeCtx({ token, handleToken })).kind).toBe("user");
  });

  test("falls back to anonymous with no cookies", () => {
    expect(getCommentIdentity(fakeCtx({}))).toEqual({ kind: "anonymous" });
  });

  test("falls back to anonymous with an invalid token", () => {
    expect(getCommentIdentity(fakeCtx({ token: "garbage" }))).toEqual({ kind: "anonymous" });
  });
});
