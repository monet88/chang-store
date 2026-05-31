import React, { useCallback } from 'react';
import { ImageFile, MarkerPosition, VirtualTryOnBatchItem } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import MultiImageUploader from '../../MultiImageUploader';
import ProviderResultsGrid from './ProviderResultsGrid';

interface ProviderTryOnExtrasProps {
    idPrefix: string;
    /** First uploaded image (subject #1) — the marker target. */
    subjectImage: ImageFile | null;
    maxReferenceImages: number;
    // Multi-person
    isMultiPersonMode: boolean;
    setIsMultiPersonMode: (value: boolean) => void;
    markerPosition: MarkerPosition | null;
    setMarkerPosition: (marker: MarkerPosition | null) => void;
    clearMarker: () => void;
    // Batch
    batchSubjects: ImageFile[];
    setBatchSubjects: (images: ImageFile[]) => void;
    batchItems: VirtualTryOnBatchItem[];
    batchCompletedCount: number;
    batchFailedCount: number;
}

const toggleButtonClass = (active: boolean): string =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${active ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
    }`;

/**
 * Provider Try-On multi-person targeting + batch subjects. Mirrors the Gemini
 * Try-On marker interaction (click to place a red dot) and exposes a batch
 * subject uploader with per-subject result grouping. Presentational — all state
 * lives in the studio hook.
 */
const ProviderTryOnExtras: React.FC<ProviderTryOnExtrasProps> = ({
    idPrefix,
    subjectImage,
    maxReferenceImages,
    isMultiPersonMode,
    setIsMultiPersonMode,
    markerPosition,
    setMarkerPosition,
    clearMarker,
    batchSubjects,
    setBatchSubjects,
    batchItems,
    batchCompletedCount,
    batchFailedCount,
}) => {
    const { t } = useLanguage();

    const handleMarkerClick = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setMarkerPosition({ x, y, relX: x / rect.width, relY: y / rect.height });
        },
        [setMarkerPosition],
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Multi-person targeting */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-300">{t('studio.workflows.multiPerson.label')}</p>
                    <div className="flex gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                        <button type="button" onClick={() => setIsMultiPersonMode(false)} className={toggleButtonClass(!isMultiPersonMode)}>
                            {t('studio.workflows.multiPerson.off')}
                        </button>
                        <button type="button" onClick={() => setIsMultiPersonMode(true)} className={toggleButtonClass(isMultiPersonMode)}>
                            {t('studio.workflows.multiPerson.on')}
                        </button>
                    </div>
                </div>

                {isMultiPersonMode && (
                    <>
                        <p className="text-xs text-zinc-500">{t('studio.workflows.multiPerson.hint')}</p>
                        {subjectImage && (
                            <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                <img
                                    src={`data:${subjectImage.mimeType};base64,${subjectImage.base64}`}
                                    alt={t('studio.workflows.multiPerson.markerAria')}
                                    className="max-h-80 w-full cursor-crosshair object-contain"
                                    onClick={handleMarkerClick}
                                />
                                {markerPosition && (
                                    <div
                                        className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500"
                                        style={{ left: `${markerPosition.relX * 100}%`, top: `${markerPosition.relY * 100}%` }}
                                        aria-label={t('studio.workflows.multiPerson.markerAria')}
                                    />
                                )}
                            </div>
                        )}
                        {markerPosition && (
                            <button
                                type="button"
                                onClick={clearMarker}
                                className="self-start rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                            >
                                {t('studio.workflows.multiPerson.clearMarker')}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Batch subjects */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                <p className="text-sm font-medium text-zinc-300">{t('studio.workflows.batch.label')}</p>
                <p className="text-xs text-zinc-500">{t('studio.workflows.batch.hint')}</p>
                <MultiImageUploader
                    images={batchSubjects}
                    onImagesUpload={setBatchSubjects}
                    title={t('studio.workflows.batch.upload')}
                    id={`${idPrefix}-batch-subjects`}
                    maxImages={maxReferenceImages}
                />

                {batchItems.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-zinc-400">
                            {t('studio.workflows.batch.progress', {
                                completed: batchCompletedCount,
                                total: batchItems.length,
                                failed: batchFailedCount,
                            })}
                        </p>
                        {batchItems.map((item, index) => (
                            <div key={item.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
                                <p className="mb-2 text-xs font-medium text-zinc-300">
                                    {t('studio.workflows.batch.subjectLabel', { index: index + 1 })}
                                    {' · '}
                                    {t(`studio.workflows.batch.status.${item.status}`)}
                                </p>
                                {item.status === 'error' && item.error && (
                                    <p className="text-xs text-red-400">{item.error}</p>
                                )}
                                {item.results.length > 0 && (
                                    <ProviderResultsGrid results={item.results} downloadPrefix={`${idPrefix}-subject-${index + 1}`} />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProviderTryOnExtras;
