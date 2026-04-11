import React, { useState, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import { Feature, ImageFile } from './types';
import { ImageGalleryProvider } from './contexts/ImageGalleryContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ApiProvider } from './contexts/ApiProviderContext';
import { ImageViewerProvider } from './contexts/ImageViewerContext';
import { GoogleDriveProvider } from './contexts/GoogleDriveContext';
import { ToastProvider } from './components/Toast';
import Spinner from './components/Spinner';
import MobileMenuButton from './components/MobileMenuButton';
import MobileOverlay from './components/MobileOverlay';
import UtilityDock from './components/UtilityDock';

const VirtualTryOn = lazy(() => import('./components/VirtualTryOn'));
const LookbookGenerator = lazy(() => import('./components/LookbookGenerator'));
const BackgroundReplacer = lazy(() => import('./components/BackgroundReplacer'));
const PoseChanger = lazy(() => import('./components/PoseChanger'));
const PhotoAlbumCreator = lazy(() => import('./components/PhotoAlbumCreator').then(m => ({ default: m.PhotoAlbumCreator })));
const OutfitAnalysis = lazy(() => import('./components/OutfitAnalysis'));
const Relight = lazy(() => import('./components/Relight'));
const Upscale = lazy(() => import('./components/Upscale'));
const ImageEditor = lazy(() => import('./components/ImageEditor').then(m => ({ default: m.ImageEditor })));
const AIEditor = lazy(() => import('./components/AIEditor'));
const WatermarkRemover = lazy(() => import('./components/WatermarkRemover'));
const ClothingTransfer = lazy(() => import('./components/ClothingTransfer'));
const PatternGenerator = lazy(() => import('./components/PatternGenerator'));

const GalleryModal = lazy(() => import('./components/modals/GalleryModal'));
const PromptLibraryModal = lazy(() => import('./components/modals/PromptLibraryModal'));
const PoseLibraryModal = lazy(() => import('./components/modals/PoseLibraryModal'));
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));

const FeatureLoadingFallback: React.FC = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center">
    <Spinner />
  </div>
);

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [activeFeature, setActiveFeature] = useState<Feature>(Feature.TryOn);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<ImageFile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transferPayload, setTransferPayload] = useState<{ feature: Feature; image: ImageFile } | null>(null);

  const [isPoseLibraryOpen, setIsPoseLibraryOpen] = useState(false);
  const [poseConfirmCallback, setPoseConfirmCallback] = useState<{ fn: (poses: string[]) => void } | null>(null);
  const [initialSelectedPoses, setInitialSelectedPoses] = useState<string[]>([]);

  const handleOpenEditor = useCallback((image: ImageFile) => {
    setImageToEdit(image);
    setActiveFeature(Feature.ImageEditor);
    setIsGalleryOpen(false);
  }, []);

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
  const handleCloseEditor = useCallback(() => {
    setActiveFeature(Feature.TryOn);
    setImageToEdit(null);
  }, []);

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

  const featureMeta: Record<Feature, { label: string; group: string; description: string }> = {
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
    [Feature.PatternGenerator]: {
      label: t('tabs.patternGenerator'),
      group: t('navigation.createLooks.label'),
      description: t('workspace.flows.patternGenerator'),
    },
    [Feature.AIEditor]: {
      label: t('tabs.aiEditor'),
      group: t('navigation.editImages.label'),
      description: t('workspace.flows.aiEditor'),
    },
    [Feature.Background]: {
      label: t('tabs.background'),
      group: t('navigation.editImages.label'),
      description: t('workspace.flows.background'),
    },
    [Feature.Pose]: {
      label: t('tabs.pose'),
      group: t('navigation.editImages.label'),
      description: t('workspace.flows.pose'),
    },
    [Feature.Relight]: {
      label: t('tabs.relight'),
      group: t('navigation.editImages.label'),
      description: t('workspace.flows.relight'),
    },
    [Feature.WatermarkRemover]: {
      label: t('tabs.watermarkRemover'),
      group: t('navigation.editImages.label'),
      description: t('workspace.flows.watermarkRemover'),
    },
    [Feature.ImageEditor]: {
      label: t('tabs.imageEditor'),
      group: t('navigation.editImages.label'),
      description: t('workspace.flows.imageEditor'),
    },
    [Feature.PhotoAlbum]: {
      label: t('tabs.photoAlbum'),
      group: t('navigation.outputStudio.label'),
      description: t('workspace.flows.photoAlbum'),
    },
    [Feature.Upscale]: {
      label: t('tabs.upscale'),
      group: t('navigation.outputStudio.label'),
      description: t('workspace.flows.upscale'),
    },
    [Feature.OutfitAnalysis]: {
      label: t('tabs.outfitAnalysis'),
      group: t('navigation.analyze.label'),
      description: t('workspace.flows.outfitAnalysis'),
    },
  };

  const currentFeatureMeta = featureMeta[activeFeature] ?? featureMeta[Feature.TryOn];

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case Feature.TryOn:
        return <VirtualTryOn key="try-on" />;
      case Feature.Lookbook:
        return <LookbookGenerator key="lookbook" onSendToFeature={handleSendToFeature} />;
      case Feature.Background:
        return <BackgroundReplacer key="background" />;
      case Feature.Pose:
        return <PoseChanger key="pose" onOpenPoseLibrary={handleOpenPoseLibrary} />;
      case Feature.PhotoAlbum:
        return (
          <PhotoAlbumCreator
            key="photo-album"
            transferredImage={transferPayload?.feature === Feature.PhotoAlbum ? transferPayload.image : undefined}
            onTransferConsumed={clearTransferPayload}
          />
        );
      case Feature.OutfitAnalysis:
        return <OutfitAnalysis key="outfit-analysis" />;
      case Feature.Relight:
        return <Relight key="relight" />;
      case Feature.Upscale:
        return <Upscale key="upscale" />;
      case Feature.AIEditor:
        return <AIEditor key="ai-editor" />;
      case Feature.WatermarkRemover:
        return <WatermarkRemover key="watermark-remover" />;
      case Feature.ClothingTransfer:
        return <ClothingTransfer key="clothing-transfer" onSendToFeature={handleSendToFeature} />;
      case Feature.PatternGenerator:
        return <PatternGenerator key="pattern-generator" />;
      case Feature.ImageEditor:
        return null;
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

                <div className="hidden flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 lg:flex">
                  <span className="rounded-full border border-white/10 px-3 py-1.5">
                    {t('workspace.panels.controlRail')}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1.5">
                    {t('workspace.panels.resultStage')}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1.5">
                    {t('navigation.mediaFirstLabel')}
                  </span>
                </div>
              </section>

              <section className="min-h-[60vh]">
                <Suspense fallback={<FeatureLoadingFallback />}>
                  {renderActiveFeature()}
                </Suspense>
              </section>
            </div>
          </main>

          <footer className="px-4 pb-6 text-center text-xs text-zinc-500 lg:px-10">
            <p>Powered by Gemini. All images are generated by AI.</p>
          </footer>
        </div>

        <UtilityDock
          onOpenGallery={handleOpenGallery}
          onOpenPromptLibrary={handleOpenPromptLibrary}
          onOpenSettings={handleOpenSettings}
        />

        <Suspense fallback={null}>
          {isGalleryOpen && <GalleryModal onClose={handleCloseGallery} onEditImage={handleOpenEditor} />}
          {isPromptLibraryOpen && <PromptLibraryModal isOpen={isPromptLibraryOpen} onClose={handleClosePromptLibrary} />}
          {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />}
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

        {activeFeature === Feature.ImageEditor && (
          <ImageEditor
            onClose={handleCloseEditor}
            initialImage={imageToEdit}
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
          <GoogleDriveProvider>
            <ImageGalleryProvider>
              <ImageViewerProvider>
                <AppContent />
              </ImageViewerProvider>
            </ImageGalleryProvider>
          </GoogleDriveProvider>
        </ApiProvider>
      </ToastProvider>
    </LanguageProvider>
  );
};

export default App;
