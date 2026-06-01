import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useProviderTryOnBatch } from '@/hooks/useProviderTryOnBatch';
import { ImageFile } from '@/types';

const t = (key: string) => key;
const img = (id: string): ImageFile => ({ base64: id, mimeType: 'image/png' });
const RESULT: ImageFile = { base64: 'OUT', mimeType: 'image/png' };

describe('useProviderTryOnBatch', () => {
    it('clears the marker when multi-person mode is turned off', () => {
        const { result } = renderHook(() => useProviderTryOnBatch(t));

        act(() => {
            result.current.setIsMultiPersonMode(true);
            result.current.setMarkerPosition({ x: 1, y: 2, relX: 0.1, relY: 0.2 });
        });
        expect(result.current.markerPosition).not.toBeNull();

        act(() => {
            result.current.setIsMultiPersonMode(false);
        });
        expect(result.current.markerPosition).toBeNull();
    });

    it('runs one job per subject and tracks completion', async () => {
        const { result } = renderHook(() => useProviderTryOnBatch(t));
        const runForSubject = vi.fn().mockResolvedValue([RESULT]);
        const subjects = [img('s1'), img('s2'), img('s3')];

        await act(async () => {
            await result.current.runBatch(subjects, runForSubject);
        });

        expect(runForSubject).toHaveBeenCalledTimes(3);
        await waitFor(() => {
            expect(result.current.batchCompletedCount).toBe(3);
            expect(result.current.batchItems.every((item) => item.status === 'completed')).toBe(true);
        });
    });

    it('marks failed jobs as error without stopping siblings', async () => {
        const { result } = renderHook(() => useProviderTryOnBatch(t));
        const runForSubject = vi
            .fn()
            .mockResolvedValueOnce([RESULT])
            .mockRejectedValueOnce(new Error('error.provider.requestFailed'));

        await act(async () => {
            await result.current.runBatch([img('s1'), img('s2')], runForSubject);
        });

        await waitFor(() => {
            expect(result.current.batchCompletedCount).toBe(1);
            expect(result.current.batchFailedCount).toBe(1);
        });
    });

    it('resets all extras state', () => {
        const { result } = renderHook(() => useProviderTryOnBatch(t));

        act(() => {
            result.current.setIsMultiPersonMode(true);
            result.current.setBatchSubjects([img('s1')]);
        });

        act(() => {
            result.current.resetExtras();
        });

        expect(result.current.isMultiPersonMode).toBe(false);
        expect(result.current.batchSubjects).toEqual([]);
        expect(result.current.batchActive).toBe(false);
    });
});
