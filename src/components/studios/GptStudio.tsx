import React from 'react';
import { Feature, ImageFile } from '../../types';
import { useImageEngine } from '../../contexts/ImageEngineContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlobalModelSelector } from '../GlobalModelSelector';
import VirtualTryOn from '../VirtualTryOn';
import GptLookbookGenerator from './GptLookbookGenerator';
import GptClothingTransfer from './GptClothingTransfer';
import GptAIEditor from './GptAIEditor';
import GptIdentityTransfer from './GptIdentityTransfer';

interface GptStudioProps {
  activeFeature: Feature;
  onSendToFeature: (feature: Feature, image: ImageFile) => void;
}

/**
 * The GPT Image studio. Virtual Try-On uses the shared Feature view and resolves
 * GPT-owned controls from the active image engine; the remaining feature views
 * are still provider-specific until their own migration tickets land.
 */
const GptStudio: React.FC<GptStudioProps> = ({ activeFeature, onSendToFeature }) => {
  const { t } = useLanguage();
  const { model, modelOptions, setModel, noSelectableModel } = useImageEngine();

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case Feature.TryOn:
        return <VirtualTryOn key="gpt-try-on" />;
      case Feature.Lookbook:
        return <GptLookbookGenerator key="gpt-lookbook" onSendToFeature={onSendToFeature} />;
      case Feature.ClothingTransfer:
        return <GptClothingTransfer key="gpt-clothing-transfer" onSendToFeature={onSendToFeature} />;
      case Feature.AIEditor:
        return <GptAIEditor key="gpt-ai-editor" />;
      case Feature.IdentityTransfer:
        return <GptIdentityTransfer key="gpt-identity-transfer" />;
      default:
        return <VirtualTryOn key="gpt-try-on" />;
    }
  };

  return (
    <div className="mx-auto flex max-w-[1760px] flex-col gap-8">
      <section className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          {t('studio.provider.featuresLabel')}
        </p>

        {modelOptions && setModel ? (
          <div className="w-full shrink-0 sm:w-64">
            <GlobalModelSelector
              ariaLabel={t('studio.workflows.modelLabel')}
              label={t('studio.workflows.modelLabel')}
              selectedModel={model}
              options={modelOptions}
              onChange={setModel}
            />
          </div>
        ) : null}
      </section>

      {noSelectableModel && (
        <p className="text-sm leading-6 text-amber-300" role="status">
          {t('studio.profile.none')} — {t('studio.profile.notChecked')}
        </p>
      )}

      {renderActiveFeature()}
    </div>
  );
};

export default GptStudio;
