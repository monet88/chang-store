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
    [Feature.IdentityTransfer]: t('tabs.identityTransfer'),
  };

  const isProviderMode = studioMode === 'gptImage';

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
            { id: Feature.IdentityTransfer, label: featureLabels[Feature.IdentityTransfer] },
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
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} className="space-y-1.5">
          <div className="px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {group.title}
            </p>
            <p className="sr-only">
              {group.description}
            </p>
          </div>

          <div className="space-y-0.5">
            {group.items.map((tab) => {
              const isActive = activeFeature === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeature(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                    isActive
                      ? 'border-white/20 bg-white/[0.1] font-semibold text-zinc-50'
                      : 'border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <span className="block tracking-[-0.01em]">{tab.label}</span>
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
