import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ImageFile } from '../types';
import { analyzeOutfitBlueprint } from '../services/textService';
import { aiScanSourceSet } from '../utils/ai-scan-blueprint';

/**
 * AI Scan (issue #162): an optional analytical pre-pass that deconstructs the
 * source garments into a textile blueprint before synthesis.
 *
 * The provider owns the persisted ON/OFF preference and the analysis itself:
 * one analysis per source set, shared between the panel's pre-scan and the
 * generation call (object identity is the cache key). What a panel *shows* is
 * the panel's own state, because a batch scans one source set per job (Virtual
 * Try-On multi-model, wardrobe, Identity Transfer) — a provider-wide blueprint
 * slot would let one job's analysis label another job's images.
 */

const AI_SCAN_ENABLED_KEY = 'ai_scan_enabled';

/**
 * Model standard for the analytical pass (issue #162): one vision model for
 * every studio, so scan latency and token cost stay predictable.
 */
export const AI_SCAN_MODEL = 'gemini-3.8-flash';

/** Analyzer seam: the real service by default, injected in tests. */
export type AiScanAnalyzer = (
  image: ImageFile,
  model?: string,
  userGuidance?: string,
) => Promise<string>;

export interface AiScanContextValue {
  /** Persisted ON/OFF preference. Defaults to ON: the layer is the quality path. */
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  /**
   * Deconstruct `images`. Resolves to the blueprint, or to null when the scan
   * is disabled, has no usable source, or fails closed — callers then keep the
   * base prompt. Repeated calls for the same source set and guidance reuse the one analysis.
   */
  scan: (images: ImageFile[], userGuidance?: string) => Promise<string | null>;
}

const INACTIVE_AI_SCAN: AiScanContextValue = {
  enabled: false,
  setEnabled: () => {},
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

const sameSourceSet = (a: ImageFile[], b: ImageFile[]): boolean =>
  a.length === b.length && a.every((image, index) => image === b[index]);

/** One analyzed source set, held so its own pre-scan and generation share it. */
interface ScanEntry {
  sources: ImageFile[];
  userGuidance?: string;
  scan: Promise<string | null>;
}

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

  // One analysis per source set, so a panel that pre-scans and the generation
  // call that awaits it share one analysis instead of two. Keyed by the set
  // itself, never by a single provider-wide slot: a batch runs several jobs over
  // different sets, and a job must neither evict, invalidate nor inherit another
  // job's analysis.
  const scans = useRef<ScanEntry[]>([]);

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
    (images: ImageFile[], userGuidance?: string): Promise<string | null> => {
      if (!enabled) return Promise.resolve(null);

      const sources = aiScanSourceSet(images);
      if (sources.length === 0) return Promise.resolve(null);

      const normalizedGuidance = userGuidance?.trim() || undefined;
      const cached = scans.current.find(
        (entry) => sameSourceSet(entry.sources, sources) && entry.userGuidance === normalizedGuidance,
      );
      if (cached) return cached.scan;

      const run = Promise.all(
        sources.map((image) =>
          normalizedGuidance
            ? analyze(image, AI_SCAN_MODEL, normalizedGuidance)
            : analyze(image, AI_SCAN_MODEL),
        ),
      )
        .then((reports) => {
          // Fail closed: a partial blueprint would state the fabric of one
          // garment while silently dropping the others, so a single failed or
          // unusable report voids the whole scan and the run keeps its base
          // prompt.
          if (reports.some((report) => !report.trim())) {
            throw new Error('error.api.noTextDescription');
          }
          return joinReports(reports);
        })
        .catch((err: unknown) => {
          // Graceful fallback: a failed or cancelled scan never blocks
          // generation, it only drops the layer. Not cached, so the next
          // toggle or source change retries.
          console.warn('[AiScan] Analysis skipped/failed:', err);
          scans.current = scans.current.filter((entry) => entry.sources !== sources);
          return null;
        });

      scans.current.push({ sources, userGuidance: normalizedGuidance, scan: run });
      return run;
    },
    [analyze, enabled],
  );

  const value = useMemo<AiScanContextValue>(
    () => ({ enabled, setEnabled, scan }),
    [enabled, setEnabled, scan],
  );

  return <AiScanContext.Provider value={value}>{children}</AiScanContext.Provider>;
};
