import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProviderResultActions } from '@/hooks/useProviderResultActions';
import { ImageFile } from '@/types';

const A: ImageFile = { base64: 'AAA', mimeType: 'image/png' };
const B: ImageFile = { base64: 'BBB', mimeType: 'image/png' };
const EDITED: ImageFile = { base64: 'EDIT', mimeType: 'image/png' };
const t = (key: string) => key;

const makeConfig = (results: ImageFile[], setResults = vi.fn()) => ({
    results,
    setResults,
    getSignal: () => undefined,
    editOne: vi.fn().mockResolvedValue(EDITED),
    upscaleOne: vi.fn().mockResolvedValue(EDITED),
    regenerateOne: vi.fn().mockResolvedValue(EDITED),
    t,
});

describe('useProviderResultActions', () => {
    beforeEach(() => vi.clearAllMocks());

    it('refine replaces only the targeted slot', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A, B], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(1, 'add a hat');
        });

        expect(config.editOne).toHaveBeenCalledWith(B, 'add a hat', undefined);
        expect(setResults).toHaveBeenCalledWith([A, EDITED]);
    });

    it('refine is a no-op for an empty instruction', async () => {
        const config = makeConfig([A]);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.refine(0, '   ');
        });

        expect(config.editOne).not.toHaveBeenCalled();
    });

    it('upscale calls upscaleOne with the chosen quality', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.upscale(0, '4K');
        });

        expect(config.upscaleOne).toHaveBeenCalledWith(A, '4K', undefined);
        expect(setResults).toHaveBeenCalledWith([EDITED]);
    });

    it('regenerate replaces the slot via regenerateOne', async () => {
        const setResults = vi.fn();
        const config = makeConfig([A, B], setResults);
        const { result } = renderHook(() => useProviderResultActions(config));

        await act(async () => {
            await result.current.regenerate(0);
        });

        expect(config.regenerateOne).toHaveBeenCalledTimes(1);
        expect(setResults).toHaveBeenCalledWith([EDITED, B]);
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
