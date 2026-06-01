import { ProviderApiError } from './ProviderApiError';

/**
 * Wrap `fetch` so raw network failures (e.g. `TypeError: Failed to fetch`,
 * DNS/connection errors) surface as a typed {@link ProviderApiError} carrying
 * the `error.provider.networkError` i18n key.
 *
 * Aborts are preserved: an `AbortError` is rethrown unchanged so callers and
 * `withRetry` can detect cancellation.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(input, init);
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw err;
        }
        if (err instanceof ProviderApiError) {
            throw err;
        }
        // Network-level failure (no HTTP status available).
        throw new ProviderApiError('error.provider.networkError', 0, 'network_error');
    }
}
