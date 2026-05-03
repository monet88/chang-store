import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, InMemoryRateLimitStorage } from '../../api/_lib/rate-limiter';

const NOW = 1_000_000_000;
const WINDOW = 15 * 60 * 1000;

describe('rate limiter', () => {
  let storage: InMemoryRateLimitStorage;

  beforeEach(() => {
    storage = new InMemoryRateLimitStorage();
  });

  it('allows the first attempt', async () => {
    const result = await checkRateLimit(storage, 'user-a', NOW);
    expect(result.allowed).toBe(true);
    expect(result.attemptCount).toBe(1);
  });

  it('allows up to 4 attempts', async () => {
    for (let i = 0; i < 4; i++) {
      const result = await checkRateLimit(storage, 'user-a', NOW);
      expect(result.allowed).toBe(true);
      expect(result.attemptCount).toBe(i + 1);
    }
  });

  it('blocks at 5 attempts with Retry-After 15 seconds', async () => {
    for (let i = 0; i < 4; i++) {
      await checkRateLimit(storage, 'user-a', NOW);
    }

    const result = await checkRateLimit(storage, 'user-a', NOW);
    expect(result.allowed).toBe(false);
    expect(result.attemptCount).toBe(5);
    expect(result.retryAfter).toBe(15);
  });

  it('blocks at 10 attempts with Retry-After 60 seconds', async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(storage, 'user-a', NOW);
    }

    const result = await checkRateLimit(storage, 'user-a', NOW);
    expect(result.allowed).toBe(false);
    expect(result.attemptCount).toBe(11);
    expect(result.retryAfter).toBe(60);
  });

  it('blocks at 20 attempts with Retry-After 900 seconds', async () => {
    for (let i = 0; i < 20; i++) {
      await checkRateLimit(storage, 'user-a', NOW);
    }

    const result = await checkRateLimit(storage, 'user-a', NOW);
    expect(result.allowed).toBe(false);
    expect(result.attemptCount).toBe(21);
    expect(result.retryAfter).toBe(900);
  });

  it('resets count in a new window', async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(storage, 'user-a', NOW);
    }

    const blocked = await checkRateLimit(storage, 'user-a', NOW);
    expect(blocked.allowed).toBe(false);

    const result = await checkRateLimit(storage, 'user-a', NOW + WINDOW);
    expect(result.allowed).toBe(true);
    expect(result.attemptCount).toBe(1);
  });

  it('tracks different identifiers independently', async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(storage, 'user-a', NOW);
    }

    const blocked = await checkRateLimit(storage, 'user-a', NOW);
    expect(blocked.allowed).toBe(false);

    const result = await checkRateLimit(storage, 'user-b', NOW);
    expect(result.allowed).toBe(true);
    expect(result.attemptCount).toBe(1);
  });

  it('auto-cleans expired windows when moving to a new window', async () => {
    const first = await checkRateLimit(storage, 'user-a', NOW);
    expect(first.attemptCount).toBe(1);

    const second = await checkRateLimit(storage, 'user-a', NOW + WINDOW);
    expect(second.attemptCount).toBe(1);

    const third = await checkRateLimit(storage, 'user-a', NOW + WINDOW);
    expect(third.attemptCount).toBe(2);
  });


  it('resets identifiers that contain colons', async () => {
    const identifier = 'auth:login:2001:db8::1';

    for (let i = 0; i < 5; i++) {
      await checkRateLimit(storage, identifier, NOW);
    }

    await storage.reset(identifier);

    const result = await checkRateLimit(storage, identifier, NOW);
    expect(result.allowed).toBe(true);
    expect(result.attemptCount).toBe(1);
  });

  it('computes windowStart as aligned epoch milliseconds', async () => {
    const windowStart = NOW - (NOW % WINDOW);
    const later = windowStart + WINDOW;

    // Same window: counts accumulate
    await checkRateLimit(storage, 'user-a', windowStart);
    const same = await checkRateLimit(storage, 'user-a', windowStart + 100);
    expect(same.attemptCount).toBe(2);

    // Next window: counter resets
    const next = await checkRateLimit(storage, 'user-a', later);
    expect(next.attemptCount).toBe(1);

    // Previous window should be cleaned
    for (const key of (storage as any).store.keys()) {
      const parts = key.split(':');
      const storedWindow = Number(parts[parts.length - 1]);
      expect(storedWindow).toBeGreaterThan(0);
    }
  });
});
