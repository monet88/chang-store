import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { ProviderWorkflowConfig } from './providerWorkflows';

interface ProviderSourceFieldsProps {
    workflow: ProviderWorkflowConfig;
    idPrefix: string;
    backgroundPrompt: string;
    setBackgroundPrompt: (value: string) => void;
    extraInstructions: string;
    setExtraInstructions: (value: string) => void;
}

const fieldClass =
    'rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none';

/**
 * Dedicated background + extra-instruction text fields for provider studios.
 *
 * Per-source-item type/note now live on `ProviderSourceItemGrid` cards (Phase 3);
 * this component only renders the workflow's optional free-text fields.
 */
const ProviderSourceFields: React.FC<ProviderSourceFieldsProps> = ({
    workflow,
    idPrefix,
    backgroundPrompt,
    setBackgroundPrompt,
    extraInstructions,
    setExtraInstructions,
}) => {
    const { t } = useLanguage();

    if (!workflow.hasBackgroundField && !workflow.hasExtraInstructionsField) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
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
