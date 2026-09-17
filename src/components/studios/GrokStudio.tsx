import React from 'react';
import { Feature, StudioMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGrokStudio } from '../../hooks/useGrokStudio';
import ProviderStudioShell from './provider-studio/ProviderStudioShell';
import ProviderProfileSelector from './provider-studio/ProviderProfileSelector';
import { ModelOptionGroups } from '../ModelOptionGroups';
import { getProviderWorkflow } from './provider-studio/providerWorkflows';

interface GrokStudioProps {
  activeFeature: Feature;
  studioMode: StudioMode;
}

/**
 * Grok provider studio. Thin wrapper: resolves the Grok hook, builds the
 * Grok-specific options block (model / aspect / resolution / n), and renders
 * the shared `ProviderStudioShell`.
 */
const GrokStudio: React.FC<GrokStudioProps> = ({ activeFeature, studioMode }) => {
  const { t } = useLanguage();
  const studio = useGrokStudio(activeFeature, studioMode);
  const workflow = getProviderWorkflow(activeFeature);

  const optionsSlot = (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 sm:grid-cols-2">
      <ProviderProfileSelector driver="grok-images" />

      <div className="flex flex-col gap-2">
        <label htmlFor="grok-model" className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.modelLabel')}
        </label>
        <select
          id="grok-model"
          value={studio.model}
          onChange={(e) => studio.setModel(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
        >
          <ModelOptionGroups options={studio.modelOptions} />
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="grok-aspect" className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.aspectRatioLabel')}
        </label>
        <select
          id="grok-aspect"
          value={studio.aspectRatio}
          onChange={(e) => studio.setAspectRatio(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
        >
          {studio.aspectRatioOptions.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="grok-resolution" className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.resolutionLabel')}
        </label>
        <select
          id="grok-resolution"
          value={studio.resolution}
          onChange={(e) => studio.setResolution(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
        >
          {studio.resolutionOptions.map((res) => (
            <option key={res} value={res}>
              {res.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="grok-n" className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.outputCountLabel', { count: studio.n })}
        </label>
        <input
          id="grok-n"
          type="range"
          min={studio.minOutputs}
          max={studio.maxOutputs}
          step={1}
          value={studio.n}
          onChange={(e) => studio.setN(Number(e.target.value))}
          className="w-full accent-white"
        />
      </div>
    </div>
  );

  return (
    <ProviderStudioShell
      studio={studio}
      workflow={workflow}
      activeFeature={activeFeature}
      providerLabelKey="studio.switch.grok"
      idPrefix="grok"
      optionsSlot={optionsSlot}
    />
  );
};

export default GrokStudio;
