type Entry = { count: number; firstAttempt: number };

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const attempts = new Map<string, Entry>();
  return {
    check(key: string, now: number = Date.now()): boolean {
      const e = attempts.get(key);
      if (!e) return true;
      if (now - e.firstAttempt > windowMs) {
        attempts.delete(key);
        return true;
      }
      return e.count < max;
    },
    recordFailure(key: string, now: number = Date.now()): void {
      const e = attempts.get(key);
      if (!e || now - e.firstAttempt > windowMs) {
        attempts.set(key, { count: 1, firstAttempt: now });
        return;
      }
      e.count += 1;
    },
    reset(key: string): void {
      attempts.delete(key);
    },
  };
}

export const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
