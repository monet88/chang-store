import { describe, it, expect, vi } from 'vitest';
import { withRetry, defaultRetryOn } from '@/services/providers/shared/withRetry';
import { ProviderApiError } from '@/services/providers/shared/ProviderApiError';

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 3, delay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a 429 ProviderApiError then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderApiError('rate limited', 429))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { retries: 3, delay: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable error (e.g. 400)', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderApiError('bad request', 400));
    await expect(withRetry(fn, { retries: 3, delay: 1 })).rejects.toBeInstanceOf(ProviderApiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderApiError('still down', 503));
    await expect(withRetry(fn, { retries: 2, delay: 1 })).rejects.toThrow('still down');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('aborts immediately when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue('never');

    await expect(withRetry(fn, { retries: 3, delay: 1, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops retrying when aborted between attempts', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new ProviderApiError('rate limited', 429));

    const promise = withRetry(fn, { retries: 5, delay: 50, signal: controller.signal });
    // Abort while the backoff sleep is pending.
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  describe('defaultRetryOn', () => {
    it('returns true for 429 and 503 ProviderApiError', () => {
      expect(defaultRetryOn(new ProviderApiError('x', 429))).toBe(true);
      expect(defaultRetryOn(new ProviderApiError('x', 503))).toBe(true);
    });

    it('returns true for auth_unavailable code', () => {
      expect(defaultRetryOn(new ProviderApiError('x', 500, 'auth_unavailable'))).toBe(true);
      expect(defaultRetryOn(new Error('auth_unavailable: try later'))).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(defaultRetryOn(new ProviderApiError('x', 400))).toBe(false);
      expect(defaultRetryOn(new Error('boom'))).toBe(false);
    });
  });
});
