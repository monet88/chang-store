export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  attemptCount: number;
}

export interface RateLimitStorage {
  increment(key: string, windowStart: number): Promise<number>;
  reset(key: string): Promise<void>;
}

function makeCompositeKey(key: string, windowStart: number): string {
  return `${key}:${windowStart}`;
}

export class InMemoryRateLimitStorage implements RateLimitStorage {
  private store = new Map<string, number>();

  async increment(key: string, windowStart: number): Promise<number> {
    const compositeKey = makeCompositeKey(key, windowStart);
    const current = this.store.get(compositeKey) ?? 0;
    const next = current + 1;
    this.store.set(compositeKey, next);
    return next;
  }

  async reset(key: string): Promise<void> {
    for (const compositeKey of this.store.keys()) {
      const separatorIndex = compositeKey.lastIndexOf(':');
      const storedKey = separatorIndex === -1 ? compositeKey : compositeKey.slice(0, separatorIndex);
      if (storedKey === key) {
        this.store.delete(compositeKey);
      }
    }
  }

  cleanExpiredWindows(currentWindowStart: number): void {
    for (const compositeKey of this.store.keys()) {
      const parts = compositeKey.split(':');
      const windowStart = Number(parts[parts.length - 1]);
      if (windowStart < currentWindowStart) {
        this.store.delete(compositeKey);
      }
    }
  }
}

export function createRateLimitHeaders(retryAfter: number): Record<string, string> {
  return { 'Retry-After': String(retryAfter) };
}

function getWindowStart(now: number): number {
  return Math.floor(now / RATE_LIMIT_WINDOW_MS);
}

function getRetryAfter(attemptCount: number): number {
  if (attemptCount <= 4) return 0;
  if (attemptCount <= 9) return 15;
  if (attemptCount <= 19) return 60;
  return 900;
}

export async function checkRateLimit(
  storage: RateLimitStorage,
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = getWindowStart(now);

  if (storage instanceof InMemoryRateLimitStorage) {
    storage.cleanExpiredWindows(windowStart);
  }

  const attemptCount = await storage.increment(identifier, windowStart);

  if (attemptCount <= 4) {
    return { allowed: true, attemptCount };
  }

  const retryAfter = getRetryAfter(attemptCount);
  return { allowed: false, retryAfter, attemptCount };
}

export interface RateLimiter {
  storage: RateLimitStorage;
  check: (identifier: string) => Promise<RateLimitResult>;
}

export default function createRateLimiter(): RateLimiter {
  const storage = new InMemoryRateLimitStorage();
  return {
    storage,
    check: (identifier: string) => checkRateLimit(storage, identifier),
  };
}
