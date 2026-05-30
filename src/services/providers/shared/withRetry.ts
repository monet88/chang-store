import { ProviderApiError } from './ProviderApiError';

export interface WithRetryOptions {
  /** Max retry attempts after the initial call (default 3). */
  retries?: number;
  /** Base delay in ms used for exponential backoff (default 1000). */
  delay?: number;
  /** Predicate deciding whether an error is retryable. */
  retryOn?: (err: unknown) => boolean;
  /** Abort signal; when aborted, retry stops immediately. */
  signal?: AbortSignal;
}

/** Default retryable conditions: 429/503 ProviderApiError or auth_unavailable. */
export const defaultRetryOn = (err: unknown): boolean => {
  if (err instanceof ProviderApiError) {
    if (err.status === 429 || err.status === 503) {
      return true;
    }
    if (err.code === 'auth_unavailable') {
      return true;
    }
  }
  if (err instanceof Error && /auth_unavailable/i.test(err.message)) {
    return true;
  }
  return false;
};

class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Run `fn` with bounded retries using exponential backoff and jitter.
 *
 * Backoff for attempt N (0-indexed): `delay * 2^N + random(0, delay / 2)`.
 * Respects `AbortSignal` — throws immediately when aborted between attempts.
 */
export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const { retries = 3, delay = 1000, retryOn = defaultRetryOn, signal } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) {
      throw new AbortError();
    }

    try {
      return await fn(signal);
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === retries;
      if (isLastAttempt || !retryOn(err)) {
        throw err;
      }

      const backoff = delay * 2 ** attempt + Math.random() * (delay / 2);
      await sleep(backoff, signal);
    }
  }

  throw lastError;
}
