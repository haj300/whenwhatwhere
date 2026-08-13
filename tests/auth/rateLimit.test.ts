import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "../../server/auth/rateLimit";

describe("createRateLimiter", () => {
  test("allows up to max failures then blocks", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    const key = "a@b.com:1.2.3.4";
    for (let i = 0; i < 3; i++) {
      expect(rl.check(key, 0)).toBe(true);
      rl.recordFailure(key, 0);
    }
    expect(rl.check(key, 0)).toBe(false);
  });

  test("resets after the window elapses", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 1000 });
    const key = "a@b.com:1.2.3.4";
    rl.recordFailure(key, 0);
    rl.recordFailure(key, 0);
    expect(rl.check(key, 500)).toBe(false);
    expect(rl.check(key, 2000)).toBe(true);
  });

  test("reset() clears attempts immediately", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    const key = "a@b.com:1.2.3.4";
    rl.recordFailure(key, 0);
    expect(rl.check(key, 0)).toBe(false);
    rl.reset(key);
    expect(rl.check(key, 0)).toBe(true);
  });
});
