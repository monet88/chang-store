import React from 'react';
import type { ImageFile } from '../../types';
import { Feature } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import VirtualTryOn from '../VirtualTryOn';
import ClothingTransfer from '../ClothingTransfer';
import IdentityTransfer from '../IdentityTransfer';
import AIEditor from '../AIEditor';
import LocalQwenStatusBanner from './LocalQwenStatusBanner';

interface LocalQwenStudioProps {
  activeFeature: Feature;
  onSendToFeature: (feature: Feature, image: ImageFile) => void;
  onOpenSettings?: () => void;
}

/**
 * The Local Qwen studio (Desktop only). Supports Virtual Try-On,
 * Clothing Transfer, Identity Transfer, and AI Editor running locally
 * via ComfyUI.
 */
const LocalQwenStudio: React.FC<LocalQwenStudioProps> = ({ activeFeature, onSendToFeature, onOpenSettings }) => {
  const { t } = useLanguage();

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case Feature.TryOn:
        return <VirtualTryOn key="qwen-try-on" />;
      case Feature.ClothingTransfer:
        return <ClothingTransfer key="qwen-clothing-transfer" onSendToFeature={onSendToFeature} />;
      case Feature.IdentityTransfer:
        return <IdentityTransfer key="qwen-identity-transfer" />;
      case Feature.AIEditor:
        return <AIEditor key="qwen-ai-editor" />;
      default:
        return <VirtualTryOn key="qwen-try-on" />;
    }
  };

  return (
    <div className="mx-auto flex max-w-[1760px] flex-col gap-8">
      <section className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {t('studio.switch.localQwen')}
          </p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-2xl">
            {t('studio.localQwen.featuresLabel')}
          </h2>
        </div>
      </section>

      <LocalQwenStatusBanner onOpenSettings={onOpenSettings} />

      {renderActiveFeature()}
    </div>
  );
};

export default LocalQwenStudio;
