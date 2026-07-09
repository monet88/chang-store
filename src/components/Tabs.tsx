import React from 'react';
import { Feature, PROVIDER_SUPPORTED_FEATURES, StudioMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface TabsProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
  studioMode?: StudioMode;
}

const Tabs: React.FC<TabsProps> = ({ activeFeature, setActiveFeature, studioMode }) => {
  const { t } = useLanguage();

  const featureLabels: Record<Feature, string> = {
    [Feature.TryOn]: t('tabs.tryOn'),
    [Feature.Lookbook]: t('tabs.lookbook'),
    [Feature.ClothingTransfer]: t('tabs.clothingTransfer'),
    [Feature.PatternGenerator]: t('tabs.patternGenerator'),
    [Feature.AIEditor]: t('tabs.aiEditor'),
    [Feature.Background]: t('tabs.background'),
    [Feature.Pose]: t('tabs.pose'),
    [Feature.WatermarkRemover]: t('tabs.watermarkRemover'),
    [Feature.PhotoAlbum]: t('tabs.photoAlbum'),
  };

  const isProviderMode = studioMode === 'grok' || studioMode === 'gptImage';

  const groups = isProviderMode
    ? [
        {
          key: 'providerFeatures',
          title: t('studio.provider.featuresLabel'),
          description: t('studio.provider.featuresDescription'),
          items: PROVIDER_SUPPORTED_FEATURES.map((id) => ({ id, label: featureLabels[id] })),
        },
      ]
    : [
        {
          key: 'createLooks',
          title: t('navigation.createLooks.label'),
          description: t('navigation.createLooks.description'),
          items: [
            { id: Feature.TryOn, label: featureLabels[Feature.TryOn] },
            { id: Feature.Lookbook, label: featureLabels[Feature.Lookbook] },
            { id: Feature.ClothingTransfer, label: featureLabels[Feature.ClothingTransfer] },
            { id: Feature.PatternGenerator, label: featureLabels[Feature.PatternGenerator] },
          ],
        },
        {
          key: 'editImages',
          title: t('navigation.editImages.label'),
          description: t('navigation.editImages.description'),
          items: [
            { id: Feature.AIEditor, label: featureLabels[Feature.AIEditor] },
            { id: Feature.Background, label: featureLabels[Feature.Background] },
            { id: Feature.Pose, label: featureLabels[Feature.Pose] },
            { id: Feature.WatermarkRemover, label: featureLabels[Feature.WatermarkRemover] },
          ],
        },
        {
          key: 'outputStudio',
          title: t('navigation.outputStudio.label'),
          description: t('navigation.outputStudio.description'),
          items: [
            { id: Feature.PhotoAlbum, label: featureLabels[Feature.PhotoAlbum] },
          ],
        },
      ];

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="space-y-1 px-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {group.title}
            </p>
            <p className="sr-only">
              {group.description}
            </p>
          </div>

          <div className="space-y-1.5">
            {group.items.map((tab) => {
              const isActive = activeFeature === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeature(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full rounded-2xl border px-5 py-3.5 text-left text-[15px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    isActive
                      ? 'border-white/25 bg-white/[0.12] text-zinc-50'
                      : 'border-transparent bg-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-zinc-50'
                  }`}
                >
                  <span className="block font-medium tracking-[-0.01em]">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default Tabs;
