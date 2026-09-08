import { describe, expect, test } from "bun:test";
import { validateNewComment } from "../../server/domain/comments";
import { canDeleteComment } from "../../server/domain/permissions";

describe("validateNewComment", () => {
  test("accepts a normal comment and trims it", () => {
    const r = validateNewComment({ body: "  see you there  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.comment.body).toBe("see you there");
  });

  test("rejects a non-object body", () => {
    expect(validateNewComment(null).ok).toBe(false);
    expect(validateNewComment([]).ok).toBe(false);
    expect(validateNewComment("hi").ok).toBe(false);
  });

  test("rejects empty or whitespace-only body", () => {
    expect(validateNewComment({ body: "" }).ok).toBe(false);
    expect(validateNewComment({ body: "   " }).ok).toBe(false);
    expect(validateNewComment({}).ok).toBe(false);
  });

  test("rejects a body over 1000 characters", () => {
    expect(validateNewComment({ body: "a".repeat(1001) }).ok).toBe(false);
  });
});

describe("validateNewComment — name/reserve/password", () => {
  test("defaults name to null and reserve to false when omitted", () => {
    const r = validateNewComment({ body: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.comment.name).toBeNull();
      expect(r.comment.reserve).toBe(false);
      expect(r.comment.password).toBeNull();
    }
  });

  test("accepts a plain anonymous name up to 20 characters", () => {
    const r = validateNewComment({ body: "hi", name: "  Katja  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.comment.name).toBe("Katja");
  });

  test("rejects a plain anonymous name over 20 characters", () => {
    expect(validateNewComment({ body: "hi", name: "a".repeat(21) }).ok).toBe(false);
  });

  test("reserve requires a valid username", () => {
    const r = validateNewComment({ body: "hi", reserve: true, name: "ab", password: "a-decent-passphrase" });
    expect(r.ok).toBe(false);
  });

  test("reserve requires a valid password", () => {
    const r = validateNewComment({ body: "hi", reserve: true, name: "katja", password: "short" });
    expect(r.ok).toBe(false);
  });

  test("reserve requires both name and password to be present", () => {
    expect(validateNewComment({ body: "hi", reserve: true, password: "a-decent-passphrase" }).ok).toBe(false);
    expect(validateNewComment({ body: "hi", reserve: true, name: "katja" }).ok).toBe(false);
  });

  test("accepts a valid reserve request", () => {
    const r = validateNewComment({
      body: "hi",
      reserve: true,
      name: "katja",
      password: "a-decent-passphrase",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.comment.name).toBe("katja");
      expect(r.comment.reserve).toBe(true);
      expect(r.comment.password).toBe("a-decent-passphrase");
    }
  });
});

describe("canDeleteComment", () => {
  const comment = { authorId: 7 };
  test("author can delete", () => {
    expect(canDeleteComment({ userId: 7, role: "CONTRIBUTOR" }, comment)).toBe(true);
  });
  test("admin can delete anyone's", () => {
    expect(canDeleteComment({ userId: 99, role: "ADMIN" }, comment)).toBe(true);
  });
  test("other contributor cannot delete", () => {
    expect(canDeleteComment({ userId: 8, role: "CONTRIBUTOR" }, comment)).toBe(false);
  });
});
