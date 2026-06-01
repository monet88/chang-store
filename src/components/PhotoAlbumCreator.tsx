import React from 'react';
import { Feature, ImageFile } from '../types';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay, ProgressBar } from './Spinner';
import HoverableImage from './HoverableImage';
import { ReloadIcon } from './Icons';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { usePhotoAlbum } from '../hooks/usePhotoAlbum';

interface PhotoAlbumCreatorProps {
  transferredImage?: ImageFile;
  onTransferConsumed?: () => void;
}

export const PhotoAlbumCreator: React.FC<PhotoAlbumCreatorProps> = ({ transferredImage, onTransferConsumed }) => {
  const {
    t,
    imageEditModel,
    mode,
    setMode,
    originalPhoto,
    setOriginalPhoto,
    faceImage,
    setFaceImage,
    outfitImage,
    setOutfitImage,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    frame,
    setFrame,
    background,
    setBackground,
    selectedPoses,
    setSelectedPoses,
    additionalNotes,
    setAdditionalNotes,
    hairStyle,
    setHairStyle,
    skinTone,
    setSkinTone,
    generatedImages,
    isLoading,
    regeneratingStates,
    error,
    generationStatus,
    generationProgress,
    POSE_LABELS,
    POSES,
    FRAMES,
    BACKGROUND_LABELS,
    HAIR_STYLES,
    SKIN_TONES,
    handleStartOver,
    handleGenerate,
    handleRegenerateSingle,
    clearError,
  } = usePhotoAlbum({ transferredImage, onTransferConsumed });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* Left Column: Inputs */}
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h3 className="text-xl md:text-2xl font-bold mb-1">{t('photoAlbum.title')}</h3>
          <p className="text-zinc-400">{t('photoAlbum.description')}</p>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg mb-4">
            <button onClick={() => setMode('fullModel')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md border transition-colors duration-200 ${mode === 'fullModel' ? 'border-white/60 bg-zinc-100 text-zinc-950' : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-100'}`}>{t('photoAlbum.mode.fullModel')}</button>
            <button onClick={() => setMode('faceAndOutfit')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md border transition-colors duration-200 ${mode === 'faceAndOutfit' ? 'border-white/60 bg-zinc-100 text-zinc-950' : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-100'}`}>{t('photoAlbum.mode.faceAndOutfit')}</button>
          </div>

          {mode === 'fullModel' ? (
            <div className="max-w-[50%] mx-auto">
              <ImageUploader image={originalPhoto} onImageUpload={setOriginalPhoto} title={t('photoAlbum.originalPhoto')} id="pa-original" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <ImageUploader image={faceImage} onImageUpload={setFaceImage} title={t('photoAlbum.faceImage')} id="pa-face" />
              <ImageUploader image={outfitImage} onImageUpload={setOutfitImage} title={t('photoAlbum.outfitImage')} id="pa-outfit" />
            </div>
          )}
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
          <h3 className="text-base md:text-lg font-semibold text-center text-zinc-100">{t('photoAlbum.addons')}</h3>

          <ImageOptionsPanel
            aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
            resolution={resolution} setResolution={setResolution}
            model={imageEditModel}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.chooseHair')}</label>
              <select value={hairStyle} onChange={e => setHairStyle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                {Object.entries(HAIR_STYLES).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Skin Tone</label>
              <select value={skinTone} onChange={e => setSkinTone(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                {Object.entries(SKIN_TONES).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.chooseFrame')}</label>
              <select value={frame} onChange={e => setFrame(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                {Object.entries(FRAMES).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.chooseBackground')}</label>
              <select value={background} onChange={e => setBackground(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm">
                {Object.entries(BACKGROUND_LABELS).map(([key, value]) => <option key={key} value={key}>{String(value)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.additionalNotes')}</label>
            <input type="text" value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder={t('photoAlbum.additionalNotesPlaceholder')} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm" />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <label className="block text-sm font-medium text-zinc-300 mb-2">{t('photoAlbum.choosePoses')}</label>
          <div className="flex justify-between items-center mb-2">
            <button onClick={() => setSelectedPoses(POSES)} className="text-xs text-zinc-200 hover:text-white hover:underline">{t('photoAlbum.selectAll')}</button>
            <button onClick={() => setSelectedPoses([])} className="text-xs text-zinc-400 hover:underline">{t('photoAlbum.clearSelection')}</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            {POSES.map(poseId => (
              <label key={poseId} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={selectedPoses.includes(poseId)} onChange={() => setSelectedPoses(prev => prev.includes(poseId) ? prev.filter(p => p !== poseId) : [...prev, poseId])} className="w-4 h-4 rounded accent-zinc-200 bg-zinc-700 border-zinc-600 focus:ring-white/30" />
                <span className="text-sm text-zinc-300">{POSE_LABELS[poseId] || poseId}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-2">{selectedPoses.length} selected</p>
        </div>

        <div className="text-center">
          <button onClick={handleGenerate} disabled={isLoading} className="workspace-button workspace-button-primary px-8 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <Spinner /> : t('photoAlbum.generateButton', { count: selectedPoses.length })}
          </button>
        </div>
      </div>
      {/* Right Column: Output */}
      <div>
        <div className={`relative w-full min-h-[50vh] lg:min-h-0 lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col ${generatedImages.length === 0 && !isLoading && !error ? 'items-center justify-center' : ''}`}>
          {/* Header with Start Over button */}
          {generatedImages.length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-zinc-300">{t('photoAlbum.outputTitle')}</h3>
              <button onClick={handleStartOver} className="flex items-center gap-1.5 text-xs bg-zinc-700/80 text-zinc-200 font-medium py-1.5 px-3 rounded-lg hover:bg-zinc-700 transition-colors">
                <ReloadIcon className="w-3.5 h-3.5" />
                <span>{t('photoAlbum.startOver')}</span>
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 text-center py-8">
              <Spinner />
              <p className="text-zinc-400 text-sm">{generationStatus}</p>
              <ProgressBar progress={generationProgress.progress} total={generationProgress.total} />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="mb-4">
              <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={clearError} />
            </div>
          )}

          {/* Generated images grid - 2 columns */}
          {generatedImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {generatedImages.map((image, index) => (
                <div key={index}>
                  <HoverableImage
                    image={image}
                    altText={POSE_LABELS[image.pose] || image.pose}
                    downloadPrefix={Feature.PhotoAlbum}
                    onRegenerate={() => handleRegenerateSingle(image.pose)}
                    isGenerating={isLoading || regeneratingStates[image.pose]}
                  />
                  <p className="text-xs text-zinc-400 mt-1.5 text-center truncate" title={POSE_LABELS[image.pose] || image.pose}>{POSE_LABELS[image.pose] || image.pose}</p>
                </div>
              ))}
            </div>
          )}

          {/* Placeholder when no images */}
          {generatedImages.length === 0 && !isLoading && !error && (
            <ResultPlaceholder description={t('photoAlbum.outputPanelDescription')} />
          )}
        </div>
      </div>
    </div>
  );
};
