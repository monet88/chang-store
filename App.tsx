


import React, { useState, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import { Feature, ImageFile } from './types';
import { ImageGalleryProvider } from './contexts/ImageGalleryContext';
import GalleryButton from './components/GalleryButton';
import { LanguageProvider } from './contexts/LanguageContext';
import { ApiProvider } from './contexts/ApiProviderContext';
import { ImageViewerProvider } from './contexts/ImageViewerContext';
import { GoogleDriveProvider } from './contexts/GoogleDriveContext';
import { ToastProvider } from './components/Toast';
import Spinner from './components/Spinner';
import MobileMenuButton from './components/MobileMenuButton';
import MobileOverlay from './components/MobileOverlay';

// --- Lazy-loaded feature components for code splitting ---
// These components are loaded on-demand to reduce initial bundle size
const VirtualTryOn = lazy(() => import('./components/VirtualTryOn'));
const LookbookGenerator = lazy(() => import('./components/LookbookGenerator').then(m => ({ default: m.LookbookGenerator })));
const BackgroundReplacer = lazy(() => import('./components/BackgroundReplacer'));
const PoseChanger = lazy(() => import('./components/PoseChanger'));
const PhotoAlbumCreator = lazy(() => import('./components/PhotoAlbumCreator').then(m => ({ default: m.PhotoAlbumCreator })));
const OutfitAnalysis = lazy(() => import('./components/OutfitAnalysis'));
const Relight = lazy(() => import('./components/Relight'));
const Upscale = lazy(() => import('./components/Upscale'));
const ImageEditor = lazy(() => import('./components/ImageEditor').then(m => ({ default: m.ImageEditor })));
const AIEditor = lazy(() => import('./components/AIEditor'));
const WatermarkRemover = lazy(() => import('./components/WatermarkRemover'));

// --- Lazy-loaded modal components ---
const GalleryModal = lazy(() => import('./components/modals/GalleryModal'));
const PoseLibraryModal = lazy(() => import('./components/modals/PoseLibraryModal'));
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));

/** Loading fallback component for lazy-loaded features */
const FeatureLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <Spinner />
  </div>
);

const AppContent: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>(Feature.TryOn);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<ImageFile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isPoseLibraryOpen, setIsPoseLibraryOpen] = useState(false);
  const [poseConfirmCallback, setPoseConfirmCallback] = useState<{ fn: (poses: string[]) => void } | null>(null);
  const [initialSelectedPoses, setInitialSelectedPoses] = useState<string[]>([]);

  // --- Memoized callbacks to prevent unnecessary re-renders ---
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
  const handleClosePoseLibrary = useCallback(() => setIsPoseLibraryOpen(false), []);
  const handleCloseEditor = useCallback(() => {
    setActiveFeature(Feature.TryOn);
    setImageToEdit(null);
  }, []);

  const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);

  // Auto-close sidebar when feature is selected on mobile
  const handleSetActiveFeature = useCallback((feature: Feature) => {
    setActiveFeature(feature);
    setIsSidebarOpen(false);
  }, []);

  /** Renders the active feature component based on current selection */
  const renderActiveFeature = () => {
    switch (activeFeature) {
      case Feature.TryOn:
        return <VirtualTryOn key="try-on" />;
      case Feature.Lookbook:
        return <LookbookGenerator key="lookbook" />;
      case Feature.Background:
        return <BackgroundReplacer key="background" />;
      case Feature.Pose:
        return <PoseChanger key="pose" onOpenPoseLibrary={handleOpenPoseLibrary} />;
      case Feature.PhotoAlbum:
        return <PhotoAlbumCreator key="photo-album" />;
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
      case Feature.ImageEditor:
        return null; // ImageEditor is rendered separately as a modal
      default:
        return <VirtualTryOn key="try-on" />;
    }
  };

  return (
    <>
      <div className="flex w-full min-h-screen bg-transparent">
        <Header
          activeFeature={activeFeature}
          setActiveFeature={handleSetActiveFeature}
          onOpenSettings={handleOpenSettings}
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
        />
        <MobileMenuButton onClick={handleToggleSidebar} />
        <MobileOverlay isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
        <div className="flex-1 flex flex-col ml-0 lg:ml-96 min-h-screen">
          <main className="flex-1 w-full max-w-[1920px] mx-auto px-1 sm:px-4 lg:px-8 py-2 sm:py-4">
            <div className="relative min-h-full overflow-x-hidden">
              <Suspense fallback={<FeatureLoadingFallback />}>
                {renderActiveFeature()}
              </Suspense>
            </div>
          </main>
          <footer className="text-center py-2 text-slate-500 text-xs flex-shrink-0">
            <p>Powered by Gemini. All images are generated by AI.</p>
          </footer>
        </div>

        <GalleryButton onClick={handleOpenGallery} />

        {/* Lazy-loaded modals wrapped in Suspense */}
        <Suspense fallback={null}>
          {isGalleryOpen && <GalleryModal onClose={handleCloseGallery} onEditImage={handleOpenEditor} />}
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