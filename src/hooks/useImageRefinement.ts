import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { ImageFile } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { createImageChatSession, ImageChatSession } from '../services/imageEditingService';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

export interface UseImageRefinementParams {
  /** Model used to open a refine chat session. */
  imageEditModel: string;
  /** The feature hook's error setter (refine errors surface through the same channel). */
  setError: (message: string | null) => void;
  /** i18n translate for error messages. */
  t: TranslateFn;
}

export interface UseImageRefinementReturn {
  /** Per-slot refining flag, keyed by the feature's own slot key. */
  isRefining: Record<string, boolean>;
  /** Per-slot draft prompt text, keyed the same as `isRefining`. */
  refinePrompts: Record<string, string>;
  setRefinePrompts: Dispatch<SetStateAction<Record<string, string>>>;
  /** Drop every chat session + refine state (call before a fresh generation). */
  resetSessions: () => void;
  /** Drop chat sessions whose key starts with `${prefix}:` (per-item regenerate). */
  clearSessionsForPrefix: (prefix: string) => void;
  /**
   * Run an iterative refinement for one slot. Owns the session get-or-create,
   * the busy flag, prompt clearing on success, and error surfacing. The caller
   * supplies `applyResult` to commit the refined image into its own result
   * state (and, if it wants, mirror it into the gallery).
   */
  runRefine: (
    key: string,
    prompt: string,
    image: ImageFile,
    applyResult: (refined: ImageFile) => void,
  ) => Promise<void>;
}

/**
 * Deep module for the client-side iterative-refine lifecycle shared by the
 * Gemini feature hooks (Try-On, Clothing Transfer, Background Replacer).
 *
 * Before, each hook re-declared `chatSessionsRef` + `isRefining` + `refinePrompts`
 * and repeated the identical get-or-create-session / toggle-busy / clear-prompt /
 * catch-error dance. That state now lives here behind a small interface; the
 * feature hook only derives its slot key and commits the result. Session
 * creation is guarded (a failure surfaces as an error instead of an unhandled
 * rejection) uniformly across callers.
 */
export const useImageRefinement = ({
  imageEditModel,
  setError,
  t,
}: UseImageRefinementParams): UseImageRefinementReturn => {
  const chatSessionsRef = useRef<Record<string, ImageChatSession>>({});
  const [refinePrompts, setRefinePrompts] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState<Record<string, boolean>>({});

  // A chat session bakes in the model it was created with, so cached sessions
  // must be dropped when the model changes; otherwise later refinements keep
  // running through the previous model. Draft prompts / busy flags are left
  // intact — they are per-slot UI state, not tied to the model.
  useEffect(() => {
    chatSessionsRef.current = {};
  }, [imageEditModel]);

  const resetSessions = useCallback(() => {
    chatSessionsRef.current = {};
    setRefinePrompts({});
    setIsRefining({});
  }, []);

  const clearSessionsForPrefix = useCallback((prefix: string) => {
    Object.keys(chatSessionsRef.current).forEach((key) => {
      if (key.startsWith(`${prefix}:`)) {
        delete chatSessionsRef.current[key];
      }
    });
  }, []);

  const runRefine = useCallback(
    async (
      key: string,
      prompt: string,
      image: ImageFile,
      applyResult: (refined: ImageFile) => void,
    ) => {
      if (!prompt.trim()) return;

      if (!chatSessionsRef.current[key]) {
        try {
          chatSessionsRef.current[key] = createImageChatSession(imageEditModel, {
            onStatusUpdate: () => {},
          });
        } catch (sessionErr) {
          setError(getErrorMessage(sessionErr, t));
          return;
        }
      }
      const session = chatSessionsRef.current[key];

      setIsRefining((prev) => ({ ...prev, [key]: true }));
      setError(null);

      try {
        const refined = await session.sendRefinement(prompt, image);
        applyResult(refined);
        setRefinePrompts((prev) => ({ ...prev, [key]: '' }));
      } catch (err) {
        setError(getErrorMessage(err, t));
      } finally {
        setIsRefining((prev) => ({ ...prev, [key]: false }));
      }
    },
    [imageEditModel, setError, t],
  );

  return {
    isRefining,
    refinePrompts,
    setRefinePrompts,
    resetSessions,
    clearSessionsForPrefix,
    runRefine,
  };
};
