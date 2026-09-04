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
