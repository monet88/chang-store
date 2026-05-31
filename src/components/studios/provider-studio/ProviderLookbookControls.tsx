import React from 'react';
import { ImageFile } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { LookbookFormState } from '../../../utils/lookbookPromptBuilder';
import {
    LookbookStyle,
    GarmentType,
    MannequinBackgroundStyleKey,
} from '../../LookbookGenerator.prompts';
import ImageUploader from '../../ImageUploader';

interface ProviderLookbookControlsProps {
    state: LookbookFormState;
    onChange: (updates: Partial<LookbookFormState>) => void;
    fabricImage: ImageFile | null;
    setFabricImage: (image: ImageFile | null) => void;
    idPrefix: string;
}

const fieldClass =
    'rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none';
const choiceWrap = 'flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/30 p-2';
const choice = (active: boolean): string =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
    }`;

const GARMENT_STYLES: LookbookStyle[] = ['hanger', 'flat lay', 'minimalist showroom', 'folded', 'product shot'];

/**
 * Provider Lookbook control surface (Phase 6): style / garment / mannequin /
 * fabric / negative — the same inputs as Gemini Lookbook, driving the shared
 * `lookbookPromptBuilder`. Presentational; state lives in the studio hook.
 */
const ProviderLookbookControls: React.FC<ProviderLookbookControlsProps> = ({
    state,
    onChange,
    fabricImage,
    setFabricImage,
    idPrefix,
}) => {
    const { t } = useLanguage();

    const styles: { key: LookbookStyle; label: string }[] = [
        { key: 'flat lay', label: t('lookbook.styleFlatLay') },
        { key: 'mannequin', label: t('lookbook.styleMannequin') },
        { key: 'hanger', label: t('lookbook.styleHanger') },
        { key: 'folded', label: t('lookbook.styleFolded') },
        { key: 'studio background', label: t('lookbook.styleStudioBackground') },
        { key: 'minimalist showroom', label: t('lookbook.styleMinimalistShowroom') },
        { key: 'product shot', label: t('lookbook.styleProductShot') },
    ];

    const garmentTypes: { key: GarmentType; label: string }[] = [
        { key: 'one-piece', label: t('lookbook.garmentTypeOnePiece') },
        { key: 'two-piece', label: t('lookbook.garmentTypeTwoPiece') },
        { key: 'three-piece', label: t('lookbook.garmentTypeThreePiece') },
    ];

    const mannequinStyles = Object.keys(
        t('lookbook.mannequinBackgroundStyles', { returnObjects: true }),
    ) as MannequinBackgroundStyleKey[];

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
            {/* Style picker */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-zinc-300">{t('lookbook.styleLabel')}</p>
                <div className={choiceWrap}>
                    {styles.map((style) => (
                        <button
                            key={style.key}
                            type="button"
                            onClick={() => {
                                const updates: Partial<LookbookFormState> = { lookbookStyle: style.key };
                                if (style.key === 'product shot') {
                                    updates.productShotSubType = state.garmentType === 'one-piece' ? 'ghost-mannequin' : 'clean-flat-lay';
                                }
                                onChange(updates);
                            }}
                            className={choice(state.lookbookStyle === style.key)}
                        >
                            {style.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Garment type (style-dependent) */}
            {GARMENT_STYLES.includes(state.lookbookStyle) && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-zinc-300">{t('lookbook.garmentTypeLabel')}</p>
                    <div className={choiceWrap}>
                        {garmentTypes.map((type) => (
                            <button
                                key={type.key}
                                type="button"
                                onClick={() => onChange({ garmentType: type.key })}
                                className={choice(state.garmentType === type.key)}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Mannequin background (mannequin style only) */}
            {state.lookbookStyle === 'mannequin' && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-zinc-300">{t('lookbook.mannequinBackgroundStyleLabel')}</p>
                    <select
                        value={state.mannequinBackgroundStyle}
                        onChange={(e) => onChange({ mannequinBackgroundStyle: e.target.value as MannequinBackgroundStyleKey })}
                        className={fieldClass}
                    >
                        {mannequinStyles.map((key) => (
                            <option key={key} value={key}>
                                {t(`lookbook.mannequinBackgroundStyles.${key}`)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Fabric texture image + description */}
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <div className="compact-uploader">
                    <ImageUploader
                        image={fabricImage}
                        id={`${idPrefix}-fabric-texture`}
                        title={t('lookbook.fabricTextureUploadTitle')}
                        onImageUpload={setFabricImage}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor={`${idPrefix}-fabric-prompt`} className="text-sm font-medium text-zinc-300">
                        {t('lookbook.fabricTexturePromptLabel')}
                    </label>
                    <textarea
                        id={`${idPrefix}-fabric-prompt`}
                        value={state.fabricTexturePrompt}
                        onChange={(e) => onChange({ fabricTexturePrompt: e.target.value })}
                        rows={3}
                        placeholder={t('lookbook.fabricTexturePromptPlaceholder')}
                        className={fieldClass}
                    />
                </div>
            </div>

            {/* Negative prompt */}
            <div className="flex flex-col gap-2">
                <label htmlFor={`${idPrefix}-negative`} className="text-sm font-medium text-zinc-300">
                    {t('common.negativePromptLabel')}
                </label>
                <textarea
                    id={`${idPrefix}-negative`}
                    value={state.negativePrompt}
                    onChange={(e) => onChange({ negativePrompt: e.target.value })}
                    rows={2}
                    placeholder={t('lookbook.negativePromptPlaceholder')}
                    className={fieldClass}
                />
            </div>
        </div>
    );
};

export default ProviderLookbookControls;
