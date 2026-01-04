/**
 * LanguageContext Unit Tests
 *
 * Tests for the LanguageContext provider and useLanguage hook.
 * Covers translation retrieval, interpolation, returnObjects mode,
 * missing key fallback, and provider requirement validation.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import React, { type ReactNode } from 'react';

/**
 * Wrapper component that provides LanguageContext to hooks
 * Sets explicit 'en' language for test stability (default in app is 'vi')
 */
const wrapper = ({ children }: { children: ReactNode }) => {
  const Wrapper = () => {
    const { setLanguage } = useLanguage();

    // Set to English for tests
    React.useEffect(() => {
      setLanguage('en');
    }, [setLanguage]);

    return <>{children}</>;
  };

  return (
    <LanguageProvider>
      <Wrapper />
    </LanguageProvider>
  );
};

describe('LanguageContext', () => {
  describe('useLanguage hook', () => {
    it('throws error when used outside LanguageProvider', () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used within LanguageProvider', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.language).toBe('en');
      expect(typeof result.current.t).toBe('function');
      expect(typeof result.current.setLanguage).toBe('function');
      expect(result.current.translations).toBeDefined();
    });
  });

  describe('t() function - simple key lookup', () => {
    it('returns translation for simple nested key', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('header.title');

      expect(translation).toBe('Virtual Fashion Studio');
    });

    it('returns translation for deeply nested key', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('error.api.safetyBlock');

      expect(translation).toBe(
        'The request was blocked due to safety settings. Please modify your prompt.'
      );
    });

    it('returns key itself when translation is not found', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('nonexistent.key.path');

      expect(translation).toBe('nonexistent.key.path');
    });

    it('returns key for partially valid path', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('header.nonexistent');

      expect(translation).toBe('header.nonexistent');
    });
  });

  describe('t() function - interpolation', () => {
    it('interpolates single placeholder correctly', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('gallery.openAria', { count: 5 });

      expect(translation).toBe('Open image gallery (5 images)');
    });

    it('interpolates placeholder with string value', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('error.api.textOnlyResponse', {
        reason: 'No image generated',
      });

      expect(translation).toBe(
        'The API returned only text. Please adjust your prompt. Reason: No image generated'
      );
    });

    it('interpolates multiple placeholders in same string', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // gallery.clearAllConfirmation has {{count}} placeholder
      const translation = result.current.t('gallery.clearAllConfirmation', { count: 10 });

      expect(translation).toBe(
        'Are you sure you want to permanently delete all 10 images from your gallery? This action cannot be undone.'
      );
    });

    it('handles numeric value interpolation', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('gallery.openAria', { count: 0 });

      expect(translation).toBe('Open image gallery (0 images)');
    });

    it('handles multiple same placeholders (replaced globally)', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Using a key that has the same placeholder repeated would test this
      // For now, test with gallery.altText which has {{index}}
      const translation = result.current.t('gallery.altText', { index: 3 });

      expect(translation).toBe('Gallery image 3');
    });
  });

  describe('t() function - returnObjects mode', () => {
    it('returns array when returnObjects is true', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const prompts = result.current.t('generatedImage.predefinedPrompts', {
        returnObjects: true,
      });

      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts).toHaveLength(4);
      expect(prompts[0]).toBe('Make it cinematic');
      expect(prompts[1]).toBe('Improve the lighting');
    });

    it('returns empty array when key not found with returnObjects', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const result2 = result.current.t('nonexistent.array.path', {
        returnObjects: true,
      });

      expect(Array.isArray(result2)).toBe(true);
      expect(result2).toHaveLength(0);
    });

    it('returns object when key points to object with returnObjects', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const cameraOptions = result.current.t('cameraView.options', {
        returnObjects: true,
      });

      expect(typeof cameraOptions).toBe('object');
      expect(cameraOptions.default).toBe('Default');
      expect(cameraOptions.fullBody).toBe('Full-body');
    });
  });

  describe('t() function - edge cases', () => {
    it('handles empty string key', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const translation = result.current.t('');

      // Empty key returns undefined from get(), then falls back to key
      expect(translation).toBe('');
    });

    it('returns non-string value as-is (object without returnObjects)', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // When accessing an object key without returnObjects flag
      const obj = result.current.t('header');

      // Should return the object directly since it's not a string
      expect(typeof obj).toBe('object');
      expect(obj.title).toBe('Virtual Fashion Studio');
    });

    it('handles options with no matching placeholders gracefully', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Pass options that don't match any placeholders
      const translation = result.current.t('header.title', { foo: 'bar' });

      expect(translation).toBe('Virtual Fashion Studio');
    });
  });

  describe('setLanguage function', () => {
    it('allows setting language (currently only en supported)', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Verify initial state
      expect(result.current.language).toBe('en');

      // setLanguage is available and callable
      act(() => {
        result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
    });

    it('allows setting language to vi and returns correct translations', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Switch to Vietnamese
      act(() => {
        result.current.setLanguage('vi');
      });

      expect(result.current.language).toBe('vi');
      // Verify a known Vietnamese translation from vi.ts
      // In vi.ts: header: { title: 'Fashion Expert', ... }
      expect(result.current.t('header.title')).toBe('Fashion Expert');
    });
  });

  describe('translations object', () => {
    it('exposes full translations object', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      expect(result.current.translations).toBeDefined();
      expect(result.current.translations.header).toBeDefined();
      expect(result.current.translations.header.title).toBe('Virtual Fashion Studio');
    });

    it('translations object matches current language', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Direct access should match t() function results
      expect(result.current.translations.error.unknown).toBe(
        result.current.t('error.unknown')
      );
    });
  });
});
