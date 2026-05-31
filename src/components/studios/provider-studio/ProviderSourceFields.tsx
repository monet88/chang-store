import React from 'react';
import { ImageFile, VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES, VirtualTryOnSourceItemType } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { MAX_SOURCE_PROMPT_LENGTH } from '../../../hooks/useProviderStudioFields';
import { ProviderWorkflowConfig } from './providerWorkflows';

interface ProviderSourceFieldsProps {
    workflow: ProviderWorkflowConfig;
    images: ImageFile[];
    idPrefix: string;
    sourceItemTypes: VirtualTryOnSourceItemType[];
    setSourceItemType: (index: number, type: VirtualTryOnSourceItemType) => void;
    sourceItemNotes: string[];
    setSourceItemNote: (index: number, note: string) => void;
    backgroundPrompt: string;
    setBackgroundPrompt: (value: string) => void;
    extraInstructions: string;
    setExtraInstructions: (value: string) => void;
}

const fieldClass =
    'rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none';

/**
 * Phase 3 input parity fields for provider studios: per-source-item type/note,
 * a dedicated background field, and a dedicated extra-instructions field.
 *
 * The FIRST uploaded image is the subject/concept; source items are images[1..].
 * Source arrays are indexed by source position (0 = images[1]). Visibility is
 * driven by the workflow config flags so unrelated features render nothing.
 */
const ProviderSourceFields: React.FC<ProviderSourceFieldsProps> = ({
    workflow,
    images,
    idPrefix,
    sourceItemTypes,
    setSourceItemType,
    sourceItemNotes,
    setSourceItemNote,
    backgroundPrompt,
    setBackgroundPrompt,
    extraInstructions,
    setExtraInstructions,
}) => {
    const { t } = useLanguage();

    // Source items are every image after the subject/concept (image[0]).
    const sourceImages = images.slice(1);
    const showTypes = Boolean(workflow.hasSourceItemTypes);
    const showNotes = Boolean(workflow.hasSourceItemNotes);
    const showSourceControls = (showTypes || showNotes) && sourceImages.length > 0;

    if (!showTypes && !showNotes && !workflow.hasBackgroundField && !workflow.hasExtraInstructionsField) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
            {showSourceControls && (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                    <p className="text-sm font-medium text-zinc-300">
                        {t('studio.workflows.sourceItems.label')}
                    </p>
                    <p className="text-xs text-zinc-500">{t('studio.workflows.sourceItems.hint')}</p>
                    {sourceImages.map((image, index) => {
                        const preview = `data:${image.mimeType};base64,${image.base64}`;
                        return (
                            <div
                                key={`${idPrefix}-source-${index}`}
                                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-2"
                            >
                                <img
                                    src={preview}
                                    alt={`${t('studio.workflows.sourceItems.itemLabel', { index: index + 1 })}`}
                                    className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                                />
                                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                                    {showTypes && (
                                        <select
                                            aria-label={t('studio.workflows.sourceItems.typeLabel', { index: index + 1 })}
                                            value={sourceItemTypes[index] ?? 'clothing'}
                                            onChange={(e) => setSourceItemType(index, e.target.value as VirtualTryOnSourceItemType)}
                                            className={`${fieldClass} sm:w-36`}
                                        >
                                            {VIRTUAL_TRY_ON_SOURCE_ITEM_TYPES.map((type) => (
                                                <option key={type} value={type}>
                                                    {t(`studio.workflows.sourceItems.types.${type}`)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {showNotes && (
                                        <input
                                            type="text"
                                            maxLength={MAX_SOURCE_PROMPT_LENGTH}
                                            aria-label={t('studio.workflows.sourceItems.noteLabel', { index: index + 1 })}
                                            value={sourceItemNotes[index] ?? ''}
                                            onChange={(e) => setSourceItemNote(index, e.target.value)}
                                            placeholder={t('studio.workflows.sourceItems.notePlaceholder')}
                                            className={`${fieldClass} flex-1`}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {workflow.hasBackgroundField && (
                <div className="flex flex-col gap-2">
                    <label htmlFor={`${idPrefix}-background`} className="text-sm font-medium text-zinc-300">
                        {t('studio.workflows.backgroundField.label')}
                    </label>
                    <textarea
                        id={`${idPrefix}-background`}
                        value={backgroundPrompt}
                        onChange={(e) => setBackgroundPrompt(e.target.value)}
                        rows={2}
                        placeholder={t('studio.workflows.backgroundField.placeholder')}
                        className={fieldClass}
                    />
                </div>
            )}

            {workflow.hasExtraInstructionsField && (
                <div className="flex flex-col gap-2">
                    <label htmlFor={`${idPrefix}-extra`} className="text-sm font-medium text-zinc-300">
                        {t('studio.workflows.extraInstructions.label')}
                    </label>
                    <textarea
                        id={`${idPrefix}-extra`}
                        value={extraInstructions}
                        onChange={(e) => setExtraInstructions(e.target.value)}
                        rows={2}
                        placeholder={t('studio.workflows.extraInstructions.placeholder')}
                        className={fieldClass}
                    />
                </div>
            )}
        </div>
    );
};

export default ProviderSourceFields;
