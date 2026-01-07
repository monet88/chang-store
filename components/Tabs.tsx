import React from 'react';
import { Feature } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface TabsProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeFeature, setActiveFeature }) => {
  const { t } = useLanguage();

  const TABS_CONFIG = [
    { id: Feature.TryOn, label: t('tabs.tryOn') },
    { id: Feature.Lookbook, label: t('tabs.lookbook') },
    { id: Feature.Background, label: t('tabs.background') },
    { id: Feature.Pose, label: t('tabs.pose') },
    { id: Feature.PhotoAlbum, label: t('tabs.photoAlbum') },
    { id: Feature.OutfitAnalysis, label: t('tabs.outfitAnalysis') },
    { id: Feature.Relight, label: t('tabs.relight') },
    { id: Feature.Upscale, label: t('tabs.upscale') },
    { id: Feature.Video, label: t('tabs.videoAI') },
    { id: Feature.GRWMVideo, label: t('tabs.grwmVideo') },
    { id: Feature.WatermarkRemover, label: t('tabs.watermarkRemover') },
    { id: Feature.ImageEditor, label: t('tabs.imageEditor') },
    { id: Feature.AIEditor, label: t('tabs.aiEditor') },
  ];

  return (
    <div className="flex flex-col space-y-1">
      {TABS_CONFIG.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveFeature(tab.id)}
          className={`w-full text-left px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-amber-500 whitespace-nowrap ${activeFeature === tab.id
              ? 'bg-amber-600 text-white'
              : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
