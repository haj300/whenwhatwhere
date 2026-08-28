import { describe, expect, test } from "bun:test";
import { validateUsername } from "../../server/domain/username";

describe("validateUsername", () => {
  test("accepts a plain alphanumeric name", () => {
    expect(validateUsername("katja")).toBeNull();
  });

  test("accepts spaces, dots, underscores and hyphens", () => {
    expect(validateUsername("Katja L.")).toBeNull();
    expect(validateUsername("katja_l")).toBeNull();
    expect(validateUsername("katja-l")).toBeNull();
  });

  test("trims surrounding whitespace before validating", () => {
    expect(validateUsername("  katja  ")).toBeNull();
  });

  test("rejects a name shorter than 3 characters", () => {
    expect(validateUsername("ka")).not.toBeNull();
  });

  test("rejects a name longer than 20 characters", () => {
    expect(validateUsername("a".repeat(21))).not.toBeNull();
  });

  test("rejects a name that is only whitespace", () => {
    expect(validateUsername("     ")).not.toBeNull();
  });

  test("rejects disallowed characters", () => {
    expect(validateUsername("katja@l")).not.toBeNull();
    expect(validateUsername("<script>")).not.toBeNull();
  });
});
