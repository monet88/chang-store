import { describe, expect, it } from 'vitest';
import { en } from '@/locales/en';
import { vi } from '@/locales/vi';

/**
 * Guard against silent VI drift (Red Team #7): VI mirrors are hand-added, so a
 * missing key would only surface as a runtime fallback. This asserts both
 * locales expose the identical set of leaf key paths. Arrays are treated as
 * leaves (their contents may legitimately differ per language).
 */
const collectKeyPaths = (obj: unknown, prefix = ''): string[] => {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [prefix];
  }
  return Object.entries(obj as Record<string, unknown>)
    .flatMap(([key, value]) => collectKeyPaths(value, prefix ? `${prefix}.${key}` : key));
};

describe('locale key parity', () => {
  it('en and vi expose the identical set of key paths', () => {
    const enKeys = new Set(collectKeyPaths(en));
    const viKeys = new Set(collectKeyPaths(vi));

    const missingInVi = [...enKeys].filter((k) => !viKeys.has(k)).sort();
    const missingInEn = [...viKeys].filter((k) => !enKeys.has(k)).sort();

    expect(missingInVi, `Keys present in en but missing in vi:\n${missingInVi.join('\n')}`).toEqual([]);
    expect(missingInEn, `Keys present in vi but missing in en:\n${missingInEn.join('\n')}`).toEqual([]);
  });
});
