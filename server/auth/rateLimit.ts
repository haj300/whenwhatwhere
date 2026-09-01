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
    // Atomic check-and-increment. Runs entirely synchronously (no await),
    // so N concurrent handlers in one event-loop tick each observe the
    // incremented count from the prior caller — closing the TOCTOU gap that
    // a separate check()/recordFailure() pair leaves open across awaits.
    // Returns false when the window's limit is already reached.
    consume(key: string, now: number = Date.now()): boolean {
      const e = attempts.get(key);
      if (!e || now - e.firstAttempt > windowMs) {
        attempts.set(key, { count: 1, firstAttempt: now });
        return true;
      }
      if (e.count >= max) return false;
      e.count += 1;
      return true;
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

// Per-source-IP ceiling: stops cross-account credential stuffing where an
// attacker cycles email addresses (each of which gets its own loginLimiter
// counter) from a single IP. More generous than the per-email limit so
// legitimate users behind a shared/NAT'd IP are not blocked prematurely.
export const loginIpLimiter = createRateLimiter({ max: 30, windowMs: 5 * 60 * 1000 });
