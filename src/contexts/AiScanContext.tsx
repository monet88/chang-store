import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ImageFile } from '../types';
import { analyzeOutfitBlueprint } from '../services/textService';

/**
 * AI Scan (issue #162): an optional analytical pre-pass that deconstructs the
 * source garments into a textile blueprint before synthesis.
 *
 * One provider owns both halves of the layer: the persisted ON/OFF preference
 * and the blueprint of the source set being worked on. Feature hooks read the
 * blueprint at generation time, the feature's `AiScanPanel` renders it. Only one
 * feature is mounted at a time, so a single blueprint slot is enough — `scan`
 * clears it whenever the sources change.
 */

const AI_SCAN_ENABLED_KEY = 'ai_scan_enabled';

/** Source images analyzed per scan; beyond this the report repeats itself. */
const AI_SCAN_MAX_SOURCES = 4;

/**
 * Model standard for the analytical pass (issue #162): one vision model for
 * every studio, so scan latency and token cost stay predictable.
 */
export const AI_SCAN_MODEL = 'gemini-3.8-flash';

/** Analyzer seam: the real service by default, injected in tests. */
export type AiScanAnalyzer = (image: ImageFile, model?: string) => Promise<string>;

export interface AiScanContextValue {
  /** Persisted ON/OFF preference. Defaults to ON: the layer is the quality path. */
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  /** Blueprint of the most recent scan, or null while none is ready. */
  blueprint: string | null;
  isAnalyzing: boolean;
  /** Raw analyzer failure message. Generation never blocks on it. */
  error: string | null;
  /**
   * Deconstruct `images`. Resolves to the blueprint, or to null when the scan
   * is disabled, has no usable source, or fails — callers then keep the base
   * prompt. Repeated calls for the same source set reuse the one analysis.
   */
  scan: (images: ImageFile[]) => Promise<string | null>;
}

const INACTIVE_AI_SCAN: AiScanContextValue = {
  enabled: false,
  setEnabled: () => {},
  blueprint: null,
  isAnalyzing: false,
  error: null,
  scan: async () => null,
};

const AiScanContext = createContext<AiScanContextValue | null>(null);

/**
 * AI Scan is an optional layer: a feature rendered without the provider keeps
 * generating from its base prompt and never waits on analysis.
 */
export const useAiScan = (): AiScanContextValue => useContext(AiScanContext) ?? INACTIVE_AI_SCAN;

const readEnabledPreference = (): boolean => {
  if (typeof localStorage === 'undefined') return true;
  try {
    const saved = localStorage.getItem(AI_SCAN_ENABLED_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
};

const isUsableImage = (image: ImageFile | null | undefined): image is ImageFile =>
  Boolean(image?.base64 && image?.mimeType);

/**
 * The scan source set of ONE generation: the feature's own images first, then
 * the shared reference images (the subject / model the issue asks to
 * deconstruct too).
 *
 * One slot of `AI_SCAN_MAX_SOURCES` is reserved for a shared reference, so a
 * full item list can never crowd the subject out of the analysis it appears in.
 * Callers on both sides of the layer — the panel's pre-scan and the generation
 * call — must pass the SAME ImageFile objects: object identity is the cache key.
 */
export const aiScanSourceSet = (
  items: Array<ImageFile | null>,
  shared: Array<ImageFile | null> = [],
): ImageFile[] => {
  const sharedSources = shared.filter(isUsableImage).slice(0, 1);
  const itemSlots = AI_SCAN_MAX_SOURCES - sharedSources.length;
  return [...items.filter(isUsableImage).slice(0, itemSlots), ...sharedSources];
};

const sameSourceSet = (a: ImageFile[], b: ImageFile[]): boolean =>
  a.length === b.length && a.every((image, index) => image === b[index]);

/** Label each report so the model can tell which image a section came from. */
const joinReports = (reports: string[]): string =>
  reports.length === 1 ? reports[0] : reports.map((report, index) => `SOURCE IMAGE ${index + 1}:\n${report}`).join('\n\n');

export interface AiScanProviderProps {
  children: React.ReactNode;
  /** Analyzer override; defaults to the Gemini blueprint service. */
  analyze?: AiScanAnalyzer;
  /** Preference override; defaults to the persisted value (ON when unset). */
  initialEnabled?: boolean;
}

export const AiScanProvider: React.FC<AiScanProviderProps> = ({
  children,
  analyze = analyzeOutfitBlueprint,
  initialEnabled,
}) => {
  const [enabled, setEnabledState] = useState<boolean>(() => initialEnabled ?? readEnabledPreference());
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The last analyzed source set and its promise, so a panel that pre-scans and
  // a generation call that awaits share one analysis instead of two.
  const lastSources = useRef<ImageFile[] | null>(null);
  const lastScan = useRef<Promise<string | null> | null>(null);
  // Only the newest scan owns the visible state: an older analysis that lands
  // after the user swapped the images must not label the new set.
  const scanIdRef = useRef(0);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(AI_SCAN_ENABLED_KEY, String(value));
    } catch (err) {
      console.warn('[AiScan] Failed to persist preference:', err);
    }
  }, []);

  const scan = useCallback(
    (images: ImageFile[]): Promise<string | null> => {
      if (!enabled) return Promise.resolve(null);

      const sources = images.filter(isUsableImage).slice(0, AI_SCAN_MAX_SOURCES);
      if (sources.length === 0) {
        // No sources, no blueprint: a cleared feature must not keep showing the
        // deconstruction of the images the user just removed.
        scanIdRef.current += 1;
        lastSources.current = null;
        lastScan.current = null;
        setBlueprint(null);
        setIsAnalyzing(false);
        setError(null);
        return Promise.resolve(null);
      }

      if (lastSources.current && sameSourceSet(lastSources.current, sources) && lastScan.current) {
        return lastScan.current;
      }

      const scanId = (scanIdRef.current += 1);
      const isCurrent = () => scanIdRef.current === scanId;

      lastSources.current = sources;
      setIsAnalyzing(true);
      setError(null);
      setBlueprint(null);

      const run = Promise.allSettled(sources.map((image) => analyze(image, AI_SCAN_MODEL)))
        .then((settled) => {
          const reports = settled
            .filter((entry): entry is PromiseFulfilledResult<string> => entry.status === 'fulfilled')
            .map((entry) => entry.value)
            .filter((report) => Boolean(report?.trim()));

          if (reports.length === 0) {
            const firstReason = settled.find((entry) => entry.status === 'rejected') as
              | PromiseRejectedResult
              | undefined;
            throw firstReason?.reason ?? new Error('error.api.noTextDescription');
          }

          const combined = joinReports(reports);
          if (isCurrent()) setBlueprint(combined);
          return combined;
        })
        .catch((err: unknown) => {
          // Graceful fallback: a failed or cancelled scan never blocks
          // generation, it only drops the layer. Not cached, so the next
          // toggle or source change retries.
          console.warn('[AiScan] Analysis skipped/failed:', err);
          if (isCurrent()) {
            lastSources.current = null;
            lastScan.current = null;
            setError(err instanceof Error ? err.message : String(err));
          }
          return null;
        })
        .finally(() => {
          if (isCurrent()) setIsAnalyzing(false);
        });

      lastScan.current = run;
      return run;
    },
    [analyze, enabled],
  );

  const value = useMemo<AiScanContextValue>(
    () => ({ enabled, setEnabled, blueprint, isAnalyzing, error, scan }),
    [enabled, setEnabled, blueprint, isAnalyzing, error, scan],
  );

  return <AiScanContext.Provider value={value}>{children}</AiScanContext.Provider>;
};
