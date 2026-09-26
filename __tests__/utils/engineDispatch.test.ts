import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_CONCURRENCY,
  resolveEngineConcurrency,
  dispatchByEngine,
} from '@/utils/engineDispatch';

describe('engineDispatch', () => {
  describe('resolveEngineConcurrency', () => {
    it('defines default max concurrency as 10', () => {
      expect(DEFAULT_MAX_CONCURRENCY).toBe(10);
    });

    it('strictly serializes localQwen to 1 concurrency regardless of requested count', () => {
      expect(resolveEngineConcurrency('localQwen', 1)).toBe(1);
      expect(resolveEngineConcurrency('localQwen', 4)).toBe(1);
      expect(resolveEngineConcurrency('localQwen', 10)).toBe(1);
      expect(resolveEngineConcurrency('localQwen', 20)).toBe(1);
    });

    it('scales concurrency to requested count when within maxCap for cloud engines', () => {
      expect(resolveEngineConcurrency('gemini', 1)).toBe(1);
      expect(resolveEngineConcurrency('gemini', 4)).toBe(4);
      expect(resolveEngineConcurrency('gemini', 7)).toBe(7);
      expect(resolveEngineConcurrency('gemini', 10)).toBe(10);

      expect(resolveEngineConcurrency('gptImage', 2)).toBe(2);
      expect(resolveEngineConcurrency('gptImage', 5)).toBe(5);
    });

    it('caps concurrency at DEFAULT_MAX_CONCURRENCY (10) when requested count exceeds 10', () => {
      expect(resolveEngineConcurrency('gemini', 11)).toBe(10);
      expect(resolveEngineConcurrency('gemini', 25)).toBe(10);
      expect(resolveEngineConcurrency('gptImage', 100)).toBe(10);
    });

    it('respects a custom maxCap when specified', () => {
      expect(resolveEngineConcurrency('gemini', 8, 5)).toBe(5);
      expect(resolveEngineConcurrency('gemini', 3, 5)).toBe(3);
    });

    it('handles undefined engineId by treating it as cloud default', () => {
      expect(resolveEngineConcurrency(undefined, 4)).toBe(4);
      expect(resolveEngineConcurrency(undefined, 15)).toBe(10);
    });

    it('ensures at least 1 worker when requested count is 0 or negative', () => {
      expect(resolveEngineConcurrency('gemini', 0)).toBe(1);
      expect(resolveEngineConcurrency('gemini', -5)).toBe(1);
    });
  });

  describe('dispatchByEngine', () => {
    const handlers = {
      localQwen: () => 'result-local-qwen',
      gptImage: () => 'result-gpt-image',
      gemini: () => 'result-gemini',
    };

    it('dispatches to localQwen handler', () => {
      expect(dispatchByEngine('localQwen', handlers)).toBe('result-local-qwen');
    });

    it('dispatches to gptImage handler', () => {
      expect(dispatchByEngine('gptImage', handlers)).toBe('result-gpt-image');
    });

    it('dispatches to gemini handler by default or when engineId is gemini', () => {
      expect(dispatchByEngine('gemini', handlers)).toBe('result-gemini');
      expect(dispatchByEngine(undefined, handlers)).toBe('result-gemini');
    });
  });
});
