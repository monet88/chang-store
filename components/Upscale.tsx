/**
 * Upscale — Thin workspace coordinator.
 *
 * Wires the `useUpscale` hook into a two-column layout with:
 * - Left: Mode switch, session image rail, Quick Upscale/AI Studio panels
 * - Right: Shared sticky output panel with confirmation dialog overlay
 *
 * All business logic lives in the hook; child components are focused UI modules.
 */

import React, { useCallback } from 'react';
import { useUpscale } from '../hooks/useUpscale';
import { ImageFile, UpscaleStudioStep, DEFAULT_UPSCALE_QUICK_MODEL } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

import UpscaleModeSwitch from './upscale/UpscaleModeSwitch';
import UpscaleSessionImageRail from './upscale/UpscaleSessionImageRail';
import UpscaleQuickPanel from './upscale/UpscaleQuickPanel';
import UpscaleStudioStepShell from './upscale/UpscaleStudioStepShell';
import UpscaleOutputPanel from './upscale/UpscaleOutputPanel';

const Upscale: React.FC = () => {
  const { t } = useLanguage();
  const {
    sessionImages,
    activeImageId,
    activeImage,
    mode,
    isLoading,
    loadingMessage,
    error,
    errorSuggestion,
    showReupscaleConfirm,
    showResultGlow,
    addSessionImage,
    removeSessionImage,
    setActiveImageId,
    setMode,
    setActiveQuality,
    setActiveModel,
    requestReupscale,
    confirmReupscale,
    cancelReupscale,
    clearError,
    setActiveStudioStep,
  } = useUpscale();

  /** Convert File → ImageFile and add to session */
  const handleFileUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const image: ImageFile = { base64, mimeType: file.type };
        addSessionImage(image);
      };
      reader.readAsDataURL(file);
    },
    [addSessionImage],
  );

  /** Direct ImageFile upload (from ImageUploader component) */
  const handleImageUpload = useCallback(
    (image: ImageFile) => {
      addSessionImage(image);
    },
    [addSessionImage],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-stretch overflow-x-hidden pb-12">
      {/* Left column — controls */}
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-1">{t('upscale.title')}</h2>
          <p className="text-zinc-400">{t('upscale.description')}</p>
        </div>

        {/* Mode switch */}
        <UpscaleModeSwitch mode={mode} onSwitch={setMode} disabled={isLoading} />

        {/* Session image rail — visible when ≥1 image uploaded */}
        {sessionImages.length > 0 && (
          <UpscaleSessionImageRail
            images={sessionImages}
            activeId={activeImageId}
            onSelect={setActiveImageId}
            onUpload={handleFileUpload}
            onRemove={removeSessionImage}
          />
        )}

        {/* Mode-specific panel */}
        {mode === 'quick' ? (
          <UpscaleQuickPanel
            activeOriginal={activeImage?.original ?? null}
            hasResult={!!activeImage?.quickResult}
            quality={activeImage?.quickQuality ?? '2K'}
            model={activeImage?.quickModel ?? DEFAULT_UPSCALE_QUICK_MODEL}
            onQualityChange={setActiveQuality}
            onModelChange={setActiveModel}
            onRequestUpscale={requestReupscale}
            onImageUpload={handleImageUpload}
            isLoading={isLoading}
          />
        ) : (
          <UpscaleStudioStepShell
            currentStep={activeImage?.studioStep ?? UpscaleStudioStep.Analyze}
            onStepChange={setActiveStudioStep}
            hasActiveImage={!!activeImage}
          />
        )}
      </div>

      {/* Right column — sticky output panel */}
      <div className="lg:sticky lg:top-8 h-full relative">
        <UpscaleOutputPanel
          original={activeImage?.original ?? null}
          result={activeImage?.quickResult ?? null}
          quality={activeImage?.quickQuality}
          model={activeImage?.quickModel}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          error={error}
          errorSuggestion={errorSuggestion}
          showGlow={showResultGlow}
          onClearError={clearError}
        />

        {/* Re-upscale confirmation dialog — overlay on output panel */}
        {showReupscaleConfirm && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center justify-center p-6">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm text-center shadow-2xl">
              <h4 className="text-lg font-semibold text-white mb-2">
                {t('upscale.confirmReupscale.title')}
              </h4>
              <p className="text-sm text-zinc-400 mb-5">
                {t('upscale.confirmReupscale.message')}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelReupscale}
                  className="px-5 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors font-medium"
                >
                  {t('upscale.confirmReupscale.cancel')}
                </button>
                <button
                  onClick={confirmReupscale}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold hover:opacity-90 transition-opacity"
                >
                  {t('upscale.confirmReupscale.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upscale;
