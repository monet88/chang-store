import React from 'react';
import { Feature } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface TabsProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeFeature, setActiveFeature }) => {
  const { t } = useLanguage();

  const groups = [
    {
      key: 'createLooks',
      title: t('navigation.createLooks.label'),
      description: t('navigation.createLooks.description'),
      items: [
        { id: Feature.TryOn, label: t('tabs.tryOn') },
        { id: Feature.Lookbook, label: t('tabs.lookbook') },
        { id: Feature.ClothingTransfer, label: t('tabs.clothingTransfer') },
        { id: Feature.PatternGenerator, label: t('tabs.patternGenerator') },
      ],
    },
    {
      key: 'editImages',
      title: t('navigation.editImages.label'),
      description: t('navigation.editImages.description'),
      items: [
        { id: Feature.AIEditor, label: t('tabs.aiEditor') },
        { id: Feature.Background, label: t('tabs.background') },
        { id: Feature.Pose, label: t('tabs.pose') },
        { id: Feature.Relight, label: t('tabs.relight') },
        { id: Feature.WatermarkRemover, label: t('tabs.watermarkRemover') },
        { id: Feature.ImageEditor, label: t('tabs.imageEditor') },
      ],
    },
    {
      key: 'outputStudio',
      title: t('navigation.outputStudio.label'),
      description: t('navigation.outputStudio.description'),
      items: [
        { id: Feature.PhotoAlbum, label: t('tabs.photoAlbum') },
        { id: Feature.Upscale, label: t('tabs.upscale') },
      ],
    },
    {
      key: 'analyze',
      title: t('navigation.analyze.label'),
      description: t('navigation.analyze.description'),
      items: [
        { id: Feature.OutfitAnalysis, label: t('tabs.outfitAnalysis') },
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
                  className={`w-full rounded-2xl border px-5 py-3.5 text-left text-[15px] transition-colors duration-200 ${
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
