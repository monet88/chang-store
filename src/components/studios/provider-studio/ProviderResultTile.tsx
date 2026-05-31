import React, { useCallback, useState } from 'react';
import { ImageFile, UPSCALE_QUALITIES, UpscaleQuality } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DownloadIcon, FullscreenIcon } from '../../Icons';
import Spinner from '../../Spinner';

interface ProviderResultTileProps {
    image: ImageFile;
    index: number;
    busy: boolean;
    /** Whether per-tile post-generation actions are available. */
    hasActions: boolean;
    onView: (image: ImageFile) => void;
    onDownload: (image: ImageFile, index: number) => void;
    onRefine: (index: number, instruction: string) => void;
    onUpscale: (index: number, quality: UpscaleQuality) => void;
    onRegenerate: (index: number) => void;
}

const actionButtonClass =
    'rounded-lg border border-white/10 bg-zinc-900/70 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * One provider result with view/download plus the Phase 4 post-generation
 * tools: refine (iterative edit), upscale (2K/4K), and regenerate-single. The
 * refine input is local tile state; all work is delegated to the hook actions.
 */
const ProviderResultTile: React.FC<ProviderResultTileProps> = ({
    image,
    index,
    busy,
    hasActions,
    onView,
    onDownload,
    onRefine,
    onUpscale,
    onRegenerate,
}) => {
    const { t } = useLanguage();
    const [refineText, setRefineText] = useState('');

    const submitRefine = useCallback(() => {
        if (!refineText.trim() || busy) return;
        onRefine(index, refineText);
        setRefineText('');
    }, [refineText, busy, onRefine, index]);

    const src = `data:${image.mimeType};base64,${image.base64}`;

    return (
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50">
            <div className="relative">
                <img
                    src={src}
                    alt={t('studio.provider.results.alt', { index: index + 1 })}
                    className="aspect-[4/5] w-full cursor-pointer object-cover"
                    onClick={() => onView(image)}
                />
                {busy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Spinner />
                    </div>
                )}
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-2 bg-black/40 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                        type="button"
                        onClick={() => onView(image)}
                        className="pointer-events-auto rounded-full bg-zinc-900/70 p-2 text-white transition-colors hover:bg-zinc-800"
                        aria-label={t('studio.provider.results.view')}
                    >
                        <FullscreenIcon className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDownload(image, index)}
                        className="pointer-events-auto rounded-full bg-white p-2 text-black transition-colors hover:bg-zinc-200"
                        aria-label={t('studio.provider.results.download')}
                    >
                        <DownloadIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {hasActions && (
                <div className="flex flex-col gap-2 border-t border-white/10 p-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={refineText}
                            onChange={(e) => setRefineText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submitRefine();
                            }}
                            disabled={busy}
                            placeholder={t('studio.provider.actions.refinePlaceholder')}
                            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-zinc-100 focus:border-white/30 focus:outline-none disabled:opacity-40"
                            aria-label={t('studio.provider.actions.refineLabel', { index: index + 1 })}
                        />
                        <button type="button" onClick={submitRefine} disabled={busy || !refineText.trim()} className={actionButtonClass}>
                            {t('studio.provider.actions.refine')}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onRegenerate(index)} disabled={busy} className={actionButtonClass}>
                            {t('studio.provider.actions.regenerate')}
                        </button>
                        {UPSCALE_QUALITIES.map((quality) => (
                            <button
                                key={quality}
                                type="button"
                                onClick={() => onUpscale(index, quality)}
                                disabled={busy}
                                className={actionButtonClass}
                            >
                                {t('studio.provider.actions.upscale', { quality })}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderResultTile;
