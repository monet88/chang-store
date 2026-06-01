import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProviderResultActions } from '@/hooks/useProviderResultActions';
import { ImageFile } from '@/types';

const A: ImageFile = { base64: 'AAA', mimeType: 'image/png' };
const B: ImageFile = { base64: 'BBB', mimeType: 'image/png' };
const EDITED: ImageFile = { base64: 'EDIT', mimeType: 'image/png' };
const t = (key: string) => key;

const makeConfig = (results: ImageFile[], setResults = vi.fn(), isBusy = false) => ({
    results,
    setResults,
    getSignal: () => undefined,
    isBusy,
    editOne: vi.fn().mockResolvedValue(EDITED),
    upscaleOne: vi.fn().mockResolvedValue(EDITED),
    regenerateOne: vi.fn().mockResolvedValue(EDITED),
    t,
});

/**
 * setResults is now called with a functional updater (prev) => next. Resolve
 * the most recent updater against the given previous state to assert the result.
 */
const resolveLatest = (setResults: ReturnType<typeof vi.fn>, prev: ImageFile[]): ImageFile[] => {
    const updater = setResults.mock.calls.at(-1)![0] as (p: ImageFile[]) => ImageFile[];
    return updater(prev);
};

describe('useProviderResultActions', () => {
    beforeEach(() => vi.clearAllMocks());

    it('refine replaces only the targeted slot (functional update)', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A, B], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(1, 'add a hat');
        });

        expect(config.editOne).toHaveBeenCalledWith(B, 'add a hat', undefined);
        // Resolve the functional updater against the latest state.
        expect(resolveLatest(setResults, [A, B])).toEqual([A, EDITED]);
    });

    it('functional update merges onto the LATEST state, not the start snapshot', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A, B], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(0, 'tweak');
        });

        // Simulate that slot 1 changed while the async action was in flight.
        const C: ImageFile = { base64: 'CCC', mimeType: 'image/png' };
        expect(resolveLatest(setResults, [A, C])).toEqual([EDITED, C]);
    });

    it('refine is a no-op for an empty instruction', async () => {
        const config = makeConfig([A]);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(0, '   ');
        });

        expect(config.editOne).not.toHaveBeenCalled();
    });

    it('blocks actions while a full generate is running (isBusy)', async () => {
        const config = makeConfig([A], vi.fn(), true);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(0, 'tweak');
            await result.current.upscale(0, '2K');
            await result.current.regenerate(0);
        });

        expect(config.editOne).not.toHaveBeenCalled();
        expect(config.upscaleOne).not.toHaveBeenCalled();
        expect(config.regenerateOne).not.toHaveBeenCalled();
    });

    it('upscale calls upscaleOne with the chosen quality', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.upscale(0, '4K');
        });

        expect(config.upscaleOne).toHaveBeenCalledWith(A, '4K', undefined);
        expect(resolveLatest(setResults, [A])).toEqual([EDITED]);
    });

    it('regenerate replaces the slot via regenerateOne', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A, B], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.regenerate(0);
        });

        expect(config.regenerateOne).toHaveBeenCalledTimes(1);
        expect(resolveLatest(setResults, [A, B])).toEqual([EDITED, B]);
    });

    it('surfaces action errors via getErrorMessage', async () => {
        const config = makeConfig([A]);
        config.editOne.mockRejectedValue(new Error('error.provider.requestFailed'));
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(0, 'tweak');
        });

        await waitFor(() => {
            expect(result.current.actionError).toBe('error.provider.requestFailed');
        });
    });

    it('stays silent on abort errors', async () => {
        const config = makeConfig([A]);
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        config.upscaleOne.mockRejectedValue(abortError);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.upscale(0, '2K');
        });

        expect(result.current.actionError).toBeNull();
    });
});
