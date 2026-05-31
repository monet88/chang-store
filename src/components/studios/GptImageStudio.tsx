import React from 'react';
import { Feature, StudioMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGptImageStudio } from '../../hooks/useGptImageStudio';
import ProviderStudioShell from './provider-studio/ProviderStudioShell';
import { getProviderWorkflow } from './provider-studio/providerWorkflows';

interface GptImageStudioProps {
  activeFeature: Feature;
  studioMode: StudioMode;
}

/**
 * GPT Image provider studio. Thin wrapper: resolves the GPT hook, builds the
 * GPT-specific options block (quality / size), and renders the shared
 * `ProviderStudioShell` with the ~60-90s slow-response warning enabled.
 */
const GptImageStudio: React.FC<GptImageStudioProps> = ({ activeFeature, studioMode }) => {
  const { t } = useLanguage();
  const studio = useGptImageStudio(activeFeature, studioMode);
  const workflow = getProviderWorkflow(activeFeature);

  const optionsSlot = (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="gpt-quality" className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.qualityLabel')}
        </label>
        <select
          id="gpt-quality"
          value={studio.quality}
          onChange={(e) => studio.setQuality(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
        >
          {studio.qualityOptions.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="gpt-size" className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.sizeLabel')}
        </label>
        <select
          id="gpt-size"
          value={studio.size}
          onChange={(e) => studio.setSize(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
        >
          {studio.sizeOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <ProviderStudioShell
      studio={studio}
      workflow={workflow}
      activeFeature={activeFeature}
      providerLabelKey="studio.switch.gptImage"
      idPrefix="gpt-image"
      optionsSlot={optionsSlot}
      showSlowWarning
    />
  );
};

export default GptImageStudio;
