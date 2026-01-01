


import React, { useState, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import { Feature, ImageFile } from './types';
import { ImageGalleryProvider } from './contexts/ImageGalleryContext';
import GalleryButton from './components/GalleryButton';
import { LanguageProvider } from './contexts/LanguageContext';
import { ApiProvider } from './contexts/ApiProviderContext';
import { ImageViewerProvider } from './contexts/ImageViewerContext';
import Spinner from './components/Spinner';

// --- Lazy-loaded feature components for code splitting ---
// These components are loaded on-demand to reduce initial bundle size
const VirtualTryOn = lazy(() => import('./components/VirtualTryOn'));
const LookbookGenerator = lazy(() => import('./components/LookbookGenerator').then(m => ({ default: m.LookbookGenerator })));
const BackgroundReplacer = lazy(() => import('./components/BackgroundReplacer'));
const PoseChanger = lazy(() => import('./components/PoseChanger'));
const SwapFace = lazy(() => import('./components/SwapFace'));
const PhotoAlbumCreator = lazy(() => import('./components/PhotoAlbumCreator').then(m => ({ default: m.PhotoAlbumCreator })));
const OutfitAnalysis = lazy(() => import('./components/OutfitAnalysis'));
const Relight = lazy(() => import('./components/Relight'));
const Upscale = lazy(() => import('./components/Upscale'));
const ImageEditor = lazy(() => import('./components/ImageEditor').then(m => ({ default: m.ImageEditor })));
const VideoGenerator = lazy(() => import('./components/VideoGenerator').then(m => ({ default: m.VideoGenerator })));
const VideoContinuity = lazy(() => import('./components/VideoContinuity'));
const Inpainting = lazy(() => import('./components/Inpainting'));
const GRWMVideoGenerator = lazy(() => import('./components/GRWMVideoGenerator').then(m => ({ default: m.GRWMVideoGenerator })));

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

  /** Renders the active feature component based on current selection */
  const renderActiveFeature = () => {
    switch (activeFeature) {
      case Feature.TryOn:
        return <VirtualTryOn />;
      case Feature.Lookbook:
        return <LookbookGenerator />;
      case Feature.Background:
        return <BackgroundReplacer />;
      case Feature.Pose:
        return <PoseChanger onOpenPoseLibrary={handleOpenPoseLibrary} />;
      case Feature.SwapFace:
        return <SwapFace />;
      case Feature.PhotoAlbum:
        return <PhotoAlbumCreator />;
      case Feature.OutfitAnalysis:
        return <OutfitAnalysis />;
      case Feature.Relight:
        return <Relight />;
      case Feature.Upscale:
        return <Upscale />;
      case Feature.Video:
        return <VideoGenerator />;
      case Feature.VideoContinuity:
        return <VideoContinuity />;
      case Feature.GRWMVideo:
        return <GRWMVideoGenerator />;
      case Feature.Inpainting:
        return <Inpainting />;
      case Feature.ImageEditor:
        return null; // ImageEditor is rendered separately as a modal
      default:
        return <VirtualTryOn />;
    }
  };

  return (
    <>
      <div className="flex h-screen bg-transparent overflow-hidden">
        <Header activeFeature={activeFeature} setActiveFeature={setActiveFeature} onOpenSettings={handleOpenSettings} />
        <div className="flex-1 flex flex-col ml-72 h-screen overflow-hidden">
          <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">
            <div className="relative bg-slate-900/70 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl shadow-2xl shadow-black/20 border border-slate-800 h-full overflow-y-auto">
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
      <ApiProvider>
        <ImageGalleryProvider>
          <ImageViewerProvider>
            <AppContent />
          </ImageViewerProvider>
        </ImageGalleryProvider>
      </ApiProvider>
    </LanguageProvider>
  );
};

export default App;