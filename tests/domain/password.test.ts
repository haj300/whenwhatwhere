import { describe, expect, test } from "bun:test";
import { validatePassword } from "../../server/domain/password";

describe("validatePassword", () => {
  test("accepts a strong password of sufficient length", () => {
    expect(validatePassword("a-decent-passphrase")).toBeNull();
  });

  test("rejects a password shorter than 12 characters", () => {
    expect(validatePassword("short1")).not.toBeNull(); // only min-length can fire
  });

  test("rejects a password longer than 128 characters", () => {
    expect(validatePassword("a".repeat(129))).not.toBeNull(); // only max-length can fire
  });

  test("rejects a common password regardless of case", () => {
    // 12 chars (valid length) → the only reason it's rejected is the blocklist
    expect(validatePassword("Password1234")).not.toBeNull();
  });
});