import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import { GlobalModelSelector } from './components/GlobalModelSelector';
import { Feature, ImageFile } from './types';
import { ImageGalleryProvider } from './contexts/ImageGalleryContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ApiProvider, useApi } from './contexts/ApiProviderContext';
import { ImageViewerProvider } from './contexts/ImageViewerContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import AuthGate from './components/AuthGate';
import Spinner from './components/Spinner';
import MobileMenuButton from './components/MobileMenuButton';
import MobileOverlay from './components/MobileOverlay';
import UtilityDock from './components/UtilityDock';
import JobStatusBadge from './components/JobStatusBadge';
import JobHistoryView from './components/JobHistoryView';
import { useJobPoll } from './hooks/useJobPoll';
import { useModelSelection } from './hooks/useModelSelection';

const VirtualTryOn = lazy(() => import('./components/VirtualTryOn'));
const LookbookGenerator = lazy(() => import('./components/LookbookGenerator'));
const BackgroundReplacer = lazy(() => import('./components/BackgroundReplacer'));
const PoseChanger = lazy(() => import('./components/PoseChanger'));
const PhotoAlbumCreator = lazy(() => import('./components/PhotoAlbumCreator').then(m => ({ default: m.PhotoAlbumCreator })));
const AIEditor = lazy(() => import('./components/AIEditor'));
const WatermarkRemover = lazy(() => import('./components/WatermarkRemover'));
const ClothingTransfer = lazy(() => import('./components/ClothingTransfer'));
const PatternGenerator = lazy(() => import('./components/PatternGenerator'));

const GalleryModal = lazy(() => import('./components/modals/GalleryModal'));
const PromptLibraryModal = lazy(() => import('./components/modals/PromptLibraryModal'));
const PoseLibraryModal = lazy(() => import('./components/modals/PoseLibraryModal'));
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
import { saveSessionState, getSessionState } from './utils/storage';

const FeatureLoadingFallback: React.FC = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center">
    <Spinner />
  </div>
);

const MIGRATED_FEATURES: Feature[] = [
  Feature.TryOn,
  Feature.Lookbook,
  Feature.ClothingTransfer,
  Feature.PhotoAlbum,
];

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const {
    imageEditModel,
    setImageEditModel,
    imageGenerateModel,
    setImageGenerateModel,
    textGenerateModel,
    setTextGenerateModel,
  } = useApi();
  
  const [activeFeature, setActiveFeature] = useState<Feature>(() => {
    const savedFeature = getSessionState<string>('activeFeature', Feature.TryOn);
    return Object.values(Feature).includes(savedFeature as Feature)
      ? (savedFeature as Feature)
      : Feature.TryOn;
  });
  
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transferPayload, setTransferPayload] = useState<{ feature: Feature; image: ImageFile } | null>(null);

  const [isPoseLibraryOpen, setIsPoseLibraryOpen] = useState(false);
  const [poseConfirmCallback, setPoseConfirmCallback] = useState<{ fn: (poses: string[]) => void } | null>(null);
  const [initialSelectedPoses, setInitialSelectedPoses] = useState<string[]>([]);
  const [isJobHistoryOpen, setIsJobHistoryOpen] = useState(false);

  const { job, isPolling } = useJobPoll();

  useEffect(() => {
    saveSessionState('activeFeature', activeFeature);
  }, [activeFeature]);

  const handleOpenPoseLibrary = useCallback((onConfirm: (poses: string[]) => void, initialPoses: string[]) => {
    setPoseConfirmCallback({ fn: onConfirm });
    setInitialSelectedPoses(initialPoses);
    setIsPoseLibraryOpen(true);
  }, []);

  const handlePoseLibraryConfirm = useCallback((poses: string[]) => {
    poseConfirmCallback?.fn(poses);
    setIsPoseLibraryOpen(false);
  }, [poseConfirmCallback]);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleOpenGallery = useCallback(() => setIsGalleryOpen(true), []);
  const handleCloseGallery = useCallback(() => setIsGalleryOpen(false), []);
  const handleOpenPromptLibrary = useCallback(() => setIsPromptLibraryOpen(true), []);
  const handleClosePromptLibrary = useCallback(() => setIsPromptLibraryOpen(false), []);
  const handleClosePoseLibrary = useCallback(() => setIsPoseLibraryOpen(false), []);
  const handleOpenJobHistory = useCallback(() => setIsJobHistoryOpen(true), []);
  const handleCloseJobHistory = useCallback(() => setIsJobHistoryOpen(false), []);
  const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const handleSendToFeature = useCallback((feature: Feature, image: ImageFile) => {
    setTransferPayload({ feature, image });
    setActiveFeature(feature);
    setIsSidebarOpen(false);
  }, []);

  const clearTransferPayload = useCallback(() => setTransferPayload(null), []);

  const handleSetActiveFeature = useCallback((feature: Feature) => {
    setActiveFeature(feature);
    setIsSidebarOpen(false);
  }, []);

  const featureMeta: Partial<Record<Feature, { label: string; group: string; description: string }>> = {
    [Feature.TryOn]: {
      label: t('tabs.tryOn'),
      group: t('navigation.createLooks.label'),
      description: t('workspace.flows.tryOn'),
    },
    [Feature.Lookbook]: {
      label: t('tabs.lookbook'),
      group: t('navigation.createLooks.label'),
      description: t('workspace.flows.lookbook'),
    },
    [Feature.ClothingTransfer]: {
      label: t('tabs.clothingTransfer'),
      group: t('navigation.createLooks.label'),
      description: t('workspace.flows.clothingTransfer'),
    },
    // TODO: Enable when migrated to job pipeline
    // [Feature.PatternGenerator]: {
    //   label: t('tabs.patternGenerator'),
    //   group: t('navigation.createLooks.label'),
    //   description: t('workspace.flows.patternGenerator'),
    // },
    // TODO: Enable when migrated to job pipeline
    // [Feature.AIEditor]: {
    //   label: t('tabs.aiEditor'),
    //   group: t('navigation.editImages.label'),
    //   description: t('workspace.flows.aiEditor'),
    // },
    // TODO: Enable when migrated to job pipeline
    // [Feature.Background]: {
    //   label: t('tabs.background'),
    //   group: t('navigation.editImages.label'),
    //   description: t('workspace.flows.background'),
    // },
    // TODO: Enable when migrated to job pipeline
    // [Feature.Pose]: {
    //   label: t('tabs.pose'),
    //   group: t('navigation.editImages.label'),
    //   description: t('workspace.flows.pose'),
    // },
    // TODO: Enable when migrated to job pipeline
    // [Feature.WatermarkRemover]: {
    //   label: t('tabs.watermarkRemover'),
    //   group: t('navigation.editImages.label'),
    //   description: t('workspace.flows.watermarkRemover'),
    // },
    [Feature.PhotoAlbum]: {
      label: t('tabs.photoAlbum'),
      group: t('navigation.outputStudio.label'),
      description: t('workspace.flows.photoAlbum'),
    },
  };

  const currentFeatureMeta = featureMeta[activeFeature] ?? featureMeta[Feature.TryOn];
  const {
    activeModelSelectionScope,
    textGenerationOptions,
    getSelectedModelBySelectionType,
    getModelSetterBySelectionType,
  } = useModelSelection({
    activeFeature,
    imageEditModel,
    imageGenerateModel,
    textGenerateModel,
    setImageEditModel,
    setImageGenerateModel,
    setTextGenerateModel,
  });

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case Feature.TryOn:
        return <VirtualTryOn key="try-on" />;
      case Feature.Lookbook:
        return <LookbookGenerator key="lookbook" onSendToFeature={handleSendToFeature} />;
      case Feature.PhotoAlbum:
        return (
          <PhotoAlbumCreator
            key="photo-album"
            transferredImage={transferPayload?.feature === Feature.PhotoAlbum ? transferPayload.image : undefined}
            onTransferConsumed={clearTransferPayload}
          />
        );
      case Feature.ClothingTransfer:
        return <ClothingTransfer key="clothing-transfer" onSendToFeature={handleSendToFeature} />;
      // TODO: Enable when migrated to job pipeline
      // case Feature.Background:
      //   return <BackgroundReplacer key="background" />;
      // TODO: Enable when migrated to job pipeline
      // case Feature.Pose:
      //   return <PoseChanger key="pose" onOpenPoseLibrary={handleOpenPoseLibrary} />;
      // TODO: Enable when migrated to job pipeline
      // case Feature.AIEditor:
      //   return <AIEditor key="ai-editor" />;
      // TODO: Enable when migrated to job pipeline
      // case Feature.WatermarkRemover:
      //   return <WatermarkRemover key="watermark-remover" />;
      // TODO: Enable when migrated to job pipeline
      // case Feature.PatternGenerator:
      //   return <PatternGenerator key="pattern-generator" />;
      default:
        return <VirtualTryOn key="try-on" />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-transparent text-zinc-100">
        <Header
          activeFeature={activeFeature}
          setActiveFeature={handleSetActiveFeature}
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
        />
        <MobileMenuButton onClick={handleToggleSidebar} />
        <MobileOverlay isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

        <div className="min-h-screen lg:pl-[22rem]">
          <main className="px-4 pb-8 pt-20 sm:px-6 lg:px-10 lg:pt-10 xl:px-12">
            <div className="mx-auto flex max-w-[1760px] flex-col gap-8">
              <section className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    {currentFeatureMeta.group}
                  </p>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-medium tracking-[-0.045em] text-zinc-50 sm:text-5xl">
                      {currentFeatureMeta.label}
                    </h2>
                    <p className="max-w-4xl text-base leading-7 text-zinc-300 sm:text-lg">
                      {currentFeatureMeta.description}
                    </p>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:max-w-2xl sm:items-end">
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                    {activeModelSelectionScope && (
                      <div className="w-full sm:w-64 shrink-0">
                        <GlobalModelSelector
                          ariaLabel={t(activeModelSelectionScope.labelKey)}
                          label={t(activeModelSelectionScope.labelKey)}
                          selectedModel={getSelectedModelBySelectionType(activeModelSelectionScope.selectionType)}
                          options={activeModelSelectionScope.options}
                          onChange={getModelSetterBySelectionType(activeModelSelectionScope.selectionType)}
                        />
                      </div>
                    )}

                    <div className="w-full sm:w-64 shrink-0">
                      <GlobalModelSelector
                        ariaLabel={t('settingsModal.fields.textGeneration')}
                        label={t('settingsModal.fields.textGeneration')}
                        selectedModel={textGenerateModel}
                        options={textGenerationOptions}
                        onChange={setTextGenerateModel}
                      />
                    </div>
                  </div>

                </div>
              </section>

              <section className="min-h-[60vh]">
                <Suspense fallback={<FeatureLoadingFallback />}>
                  {renderActiveFeature()}
                </Suspense>
              </section>
            </div>
          </main>

        </div>

        <UtilityDock
          onOpenGallery={handleOpenGallery}
          onOpenPromptLibrary={handleOpenPromptLibrary}
          onOpenSettings={handleOpenSettings}
          onOpenJobHistory={handleOpenJobHistory}
        />

        <JobStatusBadge
          job={job}
          isPolling={isPolling}
        />

        <Suspense fallback={null}>
          {isGalleryOpen && <GalleryModal onClose={handleCloseGallery} />}
          {isPromptLibraryOpen && <PromptLibraryModal isOpen={isPromptLibraryOpen} onClose={handleClosePromptLibrary} />}
          {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />}
          {isJobHistoryOpen && <JobHistoryView onClose={handleCloseJobHistory} />}
        </Suspense>
      </div>

      <Suspense fallback={null}>
        {isPoseLibraryOpen && (
          <PoseLibraryModal
            isOpen={isPoseLibraryOpen}
            onClose={handleClosePoseLibrary}
            onConfirm={handlePoseLibraryConfirm}
            initialSelectedPoses={initialSelectedPoses}
          />
        )}
      </Suspense>
    </>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ToastProvider>
        <ApiProvider>
          <AuthProvider>
            <ImageGalleryProvider>
              <ImageViewerProvider>
                <AuthGate>
                  <AppContent />
                </AuthGate>
              </ImageViewerProvider>
            </ImageGalleryProvider>
          </AuthProvider>
        </ApiProvider>
      </ToastProvider>
    </LanguageProvider>
  );
};

export default App;
