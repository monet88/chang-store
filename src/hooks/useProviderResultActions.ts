import { useCallback, useState } from 'react';
import { ImageFile, UpscaleQuality } from '../types';
import { getErrorMessage } from '../utils/imageUtils';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Provider-specific operations the shared result-actions hook orchestrates.
 * Each returns a single ImageFile (the provider hook picks the first result)
 * and must honour the passed abort signal.
 */
export interface ProviderResultActionConfig {
    results: ImageFile[];
    setResults: (results: ImageFile[]) => void;
    /** Abort signal accessor (reads the studio's active controller). */
    getSignal: () => AbortSignal | undefined;
    /** Refine: edit `source` with a preservation-wrapped instruction. */
    editOne: (source: ImageFile, instruction: string, signal?: AbortSignal) => Promise<ImageFile>;
    /** Upscale: produce a higher-res variant of `source`. */
    upscaleOne: (source: ImageFile, quality: UpscaleQuality, signal?: AbortSignal) => Promise<ImageFile>;
    /** Regenerate: re-run the original request for one slot. */
    regenerateOne: (signal?: AbortSignal) => Promise<ImageFile>;
    t: TranslateFn;
}

export interface UseProviderResultActionsReturn {
    /** Index of the tile currently running an action, or null. */
    busyIndex: number | null;
    /** Error from the most recent action (i18n key / message). */
    actionError: string | null;
    clearActionError: () => void;
    refine: (index: number, instruction: string) => Promise<void>;
    upscale: (index: number, quality: UpscaleQuality) => Promise<void>;
    regenerate: (index: number) => Promise<void>;
}

/**
 * Shared per-tile result actions (refine / upscale / regenerate-single) for
 * provider studios. Logic lives here so both provider hooks stay thin; the
 * provider-specific service calls are injected via config. Each action replaces
 * exactly one result slot and never touches the others.
 */
export const useProviderResultActions = (
    config: ProviderResultActionConfig,
): UseProviderResultActionsReturn => {
    const { results, setResults, getSignal, editOne, upscaleOne, regenerateOne, t } = config;

    const [busyIndex, setBusyIndex] = useState<number | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const replaceSlot = useCallback(
        (index: number, image: ImageFile) => {
            setResults(results.map((current, i) => (i === index ? image : current)));
        },
        [results, setResults],
    );

    /** Shared runner: guards concurrent actions, handles abort + errors. */
    const runAction = useCallback(
        async (index: number, produce: (signal?: AbortSignal) => Promise<ImageFile>) => {
            if (busyIndex !== null) return;
            if (index < 0 || index >= results.length) return;

            setBusyIndex(index);
            setActionError(null);
            try {
                const next = await produce(getSignal());
                if (next) {
                    replaceSlot(index, next);
                } else {
                    setActionError(getErrorMessage(new Error('error.provider.response.noImages'), t));
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return; // Silent on studio switch / unmount.
                }
                setActionError(getErrorMessage(err, t));
            } finally {
                setBusyIndex(null);
            }
        },
        [busyIndex, results.length, getSignal, replaceSlot, t],
    );

    const refine = useCallback(
        (index: number, instruction: string) => {
            if (!instruction.trim()) return Promise.resolve();
            return runAction(index, (signal) => editOne(results[index], instruction, signal));
        },
        [runAction, editOne, results],
    );

    const upscale = useCallback(
        (index: number, quality: UpscaleQuality) =>
            runAction(index, (signal) => upscaleOne(results[index], quality, signal)),
        [runAction, upscaleOne, results],
    );

    const regenerate = useCallback(
        (index: number) => runAction(index, (signal) => regenerateOne(signal)),
        [runAction, regenerateOne],
    );

    return {
        busyIndex,
        actionError,
        clearActionError: () => setActionError(null),
        refine,
        upscale,
        regenerate,
    };
};
