import { useCallback, useMemo, useRef, useState } from 'react';
import { ImageFile, MarkerPosition, VirtualTryOnBatchItem } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { runBoundedWorkers } from '../utils/run-bounded-workers';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/** Conservative concurrency cap so batch bursts don't trip provider rate limits. */
export const PROVIDER_BATCH_MAX_CONCURRENCY = 3;

/** Generate results for one subject image (provider-specific, injected at call time). */
export type RunForSubject = (subject: ImageFile, signal?: AbortSignal) => Promise<ImageFile[]>;

export interface UseProviderTryOnBatchReturn {
    // Multi-person targeting (operates on the single subject image).
    isMultiPersonMode: boolean;
    setIsMultiPersonMode: (value: boolean) => void;
    markerPosition: MarkerPosition | null;
    setMarkerPosition: (marker: MarkerPosition | null) => void;
    clearMarker: () => void;
    // Batch subjects (each run with the same source set + settings).
    batchSubjects: ImageFile[];
    setBatchSubjects: (images: ImageFile[]) => void;
    batchItems: VirtualTryOnBatchItem[];
    isBatchRunning: boolean;
    /** True when the user added extra subjects → batch path is active. */
    batchActive: boolean;
    batchCompletedCount: number;
    batchFailedCount: number;
    /** Run one job per subject with bounded concurrency, tracking per-job status. */
    runBatch: (subjects: ImageFile[], runForSubject: RunForSubject, signal?: AbortSignal) => Promise<void>;
    /** Clear all multi-person + batch state (call on active-feature change). */
    resetExtras: () => void;
    t: TranslateFn;
}

const makeItem = (subjectImage: ImageFile, index: number): VirtualTryOnBatchItem => ({
    id: `provider-vto-${index}`,
    subjectImage,
    status: 'pending',
    results: [],
});

/**
 * Shared multi-person + batch state for provider Try-On. Provider-agnostic:
 * the actual service call is injected via `runForSubject` so both provider
 * hooks reuse this orchestration (DRY). Multi-person compositing happens inside
 * the injected callback (the provider knows its own image layout).
 */
export const useProviderTryOnBatch = (t: TranslateFn): UseProviderTryOnBatchReturn => {
    const [isMultiPersonMode, setIsMultiPersonModeState] = useState(false);
    const [markerPosition, setMarkerPosition] = useState<MarkerPosition | null>(null);
    const [batchSubjects, setBatchSubjects] = useState<ImageFile[]>([]);
    const [batchItems, setBatchItems] = useState<VirtualTryOnBatchItem[]>([]);
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    const itemsRef = useRef<VirtualTryOnBatchItem[]>([]);

    const setIsMultiPersonMode = useCallback((value: boolean) => {
        setIsMultiPersonModeState(value);
        if (!value) setMarkerPosition(null);
    }, []);

    const clearMarker = useCallback(() => setMarkerPosition(null), []);

    const updateItem = useCallback((id: string, patch: Partial<VirtualTryOnBatchItem>) => {
        setBatchItems((prev) => {
            const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
            itemsRef.current = next;
            return next;
        });
    }, []);

    const runBatch = useCallback(
        async (subjects: ImageFile[], runForSubject: RunForSubject, signal?: AbortSignal) => {
            if (subjects.length === 0 || isBatchRunning) return;

            const initial = subjects.map(makeItem);
            itemsRef.current = initial;
            setBatchItems(initial);
            setIsBatchRunning(true);

            const jobs = initial.map((item) => ({ id: item.id, subjectImage: item.subjectImage }));
            const concurrency = Math.min(PROVIDER_BATCH_MAX_CONCURRENCY, jobs.length);

            try {
                await runBoundedWorkers(jobs, concurrency, async (job) => {
                    updateItem(job.id, { status: 'processing', results: [], error: undefined });
                    try {
                        const results = await runForSubject(job.subjectImage, signal);
                        updateItem(job.id, { status: 'completed', results, error: undefined });
                    } catch (err) {
                        if (err instanceof Error && err.name === 'AbortError') {
                            updateItem(job.id, { status: 'pending', results: [] });
                            return;
                        }
                        updateItem(job.id, { status: 'error', results: [], error: getErrorMessage(err, t) });
                    }
                });
            } finally {
                setIsBatchRunning(false);
            }
        },
        [isBatchRunning, updateItem, t],
    );

    const resetExtras = useCallback(() => {
        setIsMultiPersonModeState(false);
        setMarkerPosition(null);
        setBatchSubjects([]);
        setBatchItems([]);
        itemsRef.current = [];
    }, []);

    const batchCompletedCount = useMemo(
        () => batchItems.filter((item) => item.status === 'completed').length,
        [batchItems],
    );
    const batchFailedCount = useMemo(
        () => batchItems.filter((item) => item.status === 'error').length,
        [batchItems],
    );

    return {
        isMultiPersonMode,
        setIsMultiPersonMode,
        markerPosition,
        setMarkerPosition,
        clearMarker,
        batchSubjects,
        setBatchSubjects,
        batchItems,
        isBatchRunning,
        batchActive: batchSubjects.length > 0,
        batchCompletedCount,
        batchFailedCount,
        runBatch,
        resetExtras,
        t,
    };
};
