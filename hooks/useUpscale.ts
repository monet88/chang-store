/**
 * useUpscale — Feature-local orchestration hook for the Upscale workspace.
 *
 * Phase 1 + Phase 2 runtime contract:
 * - Multi-image session array with stable IDs
 * - Active-image identity (newest upload becomes active)
 * - Quick Upscale / AI Studio mode coexistence
 * - Per-image Quick Upscale results, quality, and model settings
 * - Per-image AI Studio step state
 * - Loading, error (with auto-suggestion), and result lifecycle
 * - Confirmation dialog before re-upscale
 * - Result glow trigger for visual feedback
 *
 * Provider/model resolution and `upscaleImage` calls stay inside this hook.
 * Quick Upscale uses its own hardcoded Flash/Pro model, NOT the Settings model.
 * No global store is introduced — all state is feature-local.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Feature,
  ImageFile,
  UpscaleMode,
  UpscaleQuality,
  UpscaleQuickModel,
  UpscaleSessionImage,
  UpscaleStudioStep,
  UpscaleAnalysisReport,
  DEFAULT_UPSCALE_QUICK_MODEL,
} from '../types';
import { upscaleImage } from '../services/imageEditingService';
import { analyzeImage, generateUpscalePrompt } from '../services/upscaleAnalysisService';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';

// ============================================================================
// Error-to-suggestion mapping
// ============================================================================

const getErrorSuggestion = (
  rawError: unknown,
  t: (key: string) => string,
): string | null => {
  const msg = rawError instanceof Error ? rawError.message : '';
  if (msg.includes('safetyBlock')) return t('upscale.suggestion.trySwitchModel');
  if (msg.includes('noImageGenerated')) return t('upscale.suggestion.tryDifferentSettings');
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch'))
    return t('upscale.suggestion.checkConnectionRetry');
  return null;
};

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseUpscaleReturn {
  /** All session images, newest first */
  sessionImages: UpscaleSessionImage[];
  /** Currently active image ID */
  activeImageId: string | null;
  /** The resolved active session image (derived) */
  activeImage: UpscaleSessionImage | null;
  /** Current workspace mode */
  mode: UpscaleMode;
  /** Loading flag for the active Quick Upscale operation */
  isLoading: boolean;
  /** Human-readable loading message */
  loadingMessage: string;
  /** Current error (null = no error) */
  error: string | null;
  /** Actionable suggestion for current error */
  errorSuggestion: string | null;
  /** Whether the confirmation dialog should show */
  showReupscaleConfirm: boolean;
  /** Whether the output panel should glow */
  showResultGlow: boolean;

  // ---- AI Studio Analysis state ----
  /** Whether an analysis is currently running */
  isAnalyzing: boolean;
  /** Analysis-specific error (null = no error) */
  analysisError: string | null;

  // ---- Actions ----
  /** Add a new image to the session (auto-activates it) */
  addSessionImage: (image: ImageFile) => void;
  /** Remove an image from the session */
  removeSessionImage: (id: string) => void;
  /** Switch the active image without losing per-image state */
  setActiveImageId: (id: string) => void;
  /** Toggle between Quick Upscale and AI Studio */
  setMode: (mode: UpscaleMode) => void;
  /** Update quality selection for the active image */
  setActiveQuality: (quality: UpscaleQuality) => void;
  /** Update model selection for the active image */
  setActiveModel: (model: UpscaleQuickModel) => void;
  /** Request upscale — intercepts for confirmation if result exists */
  requestReupscale: () => void;
  /** Confirm the re-upscale after dialog */
  confirmReupscale: () => void;
  /** Cancel the re-upscale dialog */
  cancelReupscale: () => void;
  /** Run Quick Upscale on the active image */
  handleQuickUpscale: () => Promise<void>;
  /** Clear the current error */
  clearError: () => void;
  /** Navigate the active image's studio step */
  setActiveStudioStep: (step: UpscaleStudioStep) => void;
  /** Run AI Studio analysis on the active image */
  handleAnalyzeImage: () => Promise<void>;
  /** Clear analysis error */
  clearAnalysisError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUpscale(): UseUpscaleReturn {
  const { t } = useLanguage();
  const { getModelsForFeature, antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Upscale);

  // ---- Core state ----
  const [sessionImages, setSessionImages] = useState<UpscaleSessionImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [mode, setMode] = useState<UpscaleMode>('quick');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestion, setErrorSuggestion] = useState<string | null>(null);
  const [showReupscaleConfirm, setShowReupscaleConfirm] = useState(false);
  const [showResultGlow, setShowResultGlow] = useState(false);

  // ---- Analysis state ----
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Derived state ----
  const activeImage = sessionImages.find((img) => img.id === activeImageId) ?? null;

  // ---- Service config builder (mirrors existing pattern) ----
  const buildServiceConfig = useCallback(
    (onStatusUpdate: (msg: string) => void) => ({
      onStatusUpdate,
      antiApiBaseUrl,
      antiApiKey,
      localApiBaseUrl,
      localApiKey,
    }),
    [antiApiBaseUrl, antiApiKey, localApiBaseUrl, localApiKey],
  );

  // ---- Session management ----

  /** Add image — auto-activates. Newest upload becomes the active image. */
  const addSessionImage = useCallback((image: ImageFile) => {
    const id = crypto.randomUUID();
    const newEntry: UpscaleSessionImage = {
      id,
      original: image,
      quickResult: null,
      quickQuality: '2K',
      quickModel: DEFAULT_UPSCALE_QUICK_MODEL,
      studioStep: UpscaleStudioStep.Analyze,
      addedAt: Date.now(),
    };
    setSessionImages((prev) => [newEntry, ...prev]);
    setActiveImageId(id);
    setError(null);
    setErrorSuggestion(null);
  }, []);

  /** Remove image — if it was active, shift to the next available. */
  const removeSessionImage = useCallback(
    (id: string) => {
      setSessionImages((prev) => {
        const next = prev.filter((img) => img.id !== id);
        if (activeImageId === id) {
          setActiveImageId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [activeImageId],
  );

  // ---- Per-image state updates ----

  /** Helper to update a specific session image by ID */
  const updateSessionImage = useCallback(
    (id: string, patch: Partial<UpscaleSessionImage>) => {
      setSessionImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
      );
    },
    [],
  );

  /** Set quality for the active image */
  const setActiveQuality = useCallback(
    (quality: UpscaleQuality) => {
      if (activeImageId) {
        updateSessionImage(activeImageId, { quickQuality: quality });
      }
    },
    [activeImageId, updateSessionImage],
  );

  /** Set model for the active image */
  const setActiveModel = useCallback(
    (model: UpscaleQuickModel) => {
      if (activeImageId) {
        updateSessionImage(activeImageId, { quickModel: model });
      }
    },
    [activeImageId, updateSessionImage],
  );

  /** Navigate AI Studio step for the active image */
  const setActiveStudioStep = useCallback(
    (step: UpscaleStudioStep) => {
      if (activeImageId) {
        updateSessionImage(activeImageId, { studioStep: step });
      }
    },
    [activeImageId, updateSessionImage],
  );

  // ---- Quick Upscale action ----

  const handleQuickUpscale = useCallback(async () => {
    if (!activeImage) {
      setError(t('upscale.inputError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('upscale.generatingStatus'));
    setError(null);
    setErrorSuggestion(null);

    try {
      const result = await upscaleImage(
        activeImage.original,
        imageEditModel,
        buildServiceConfig(setLoadingMessage),
        activeImage.quickQuality,
        activeImage.quickModel,
      );
      updateSessionImage(activeImage.id, { quickResult: result });

      // Trigger glow animation
      setShowResultGlow(true);
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
      glowTimerRef.current = setTimeout(() => setShowResultGlow(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t));
      setErrorSuggestion(getErrorSuggestion(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [activeImage, imageEditModel, buildServiceConfig, updateSessionImage, t]);

  // ---- Re-upscale confirmation ----

  /** Request upscale — shows confirmation if result already exists */
  const requestReupscale = useCallback(() => {
    if (activeImage?.quickResult) {
      setShowReupscaleConfirm(true);
    } else {
      handleQuickUpscale();
    }
  }, [activeImage, handleQuickUpscale]);

  /** Confirm re-upscale — close dialog and run */
  const confirmReupscale = useCallback(() => {
    setShowReupscaleConfirm(false);
    handleQuickUpscale();
  }, [handleQuickUpscale]);

  /** Cancel re-upscale — close dialog without action */
  const cancelReupscale = useCallback(() => {
    setShowReupscaleConfirm(false);
  }, []);

  // ---- Error management ----

  const clearError = useCallback(() => {
    setError(null);
    setErrorSuggestion(null);
  }, []);

  const clearAnalysisError = useCallback(() => {
    setAnalysisError(null);
  }, []);

  // ---- AI Studio Analysis action ----

  const handleAnalyzeImage = useCallback(async () => {
    if (!activeImage) {
      setAnalysisError(t('upscale.analyzeNoImage'));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const report: UpscaleAnalysisReport = await analyzeImage(activeImage.original);
      const prompt = generateUpscalePrompt(report);

      updateSessionImage(activeImage.id, {
        analysisReport: report,
        studioPrompt: prompt,
      });
    } catch (err) {
      console.error('[useUpscale] Analysis failed:', err);
      setAnalysisError(getErrorMessage(err, t));
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeImage, updateSessionImage, t]);

  // ---- Public API ----

  return {
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
    isAnalyzing,
    analysisError,

    addSessionImage,
    removeSessionImage,
    setActiveImageId,
    setMode,
    setActiveQuality,
    setActiveModel,
    requestReupscale,
    confirmReupscale,
    cancelReupscale,
    handleQuickUpscale,
    clearError,
    setActiveStudioStep,
    handleAnalyzeImage,
    clearAnalysisError,
  };
}
