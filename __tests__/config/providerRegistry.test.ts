import { describe, it, expect } from 'vitest';
import {
  PROVIDER_REGISTRY,
  PROVIDER_IDS,
  getProviderMetadata,
  getProviderDefaultBaseUrl,
  getProviderEnvApiKey,
} from '@/config/providerRegistry';

describe('providerRegistry', () => {
  it('registers grok and gptImage providers', () => {
    expect(PROVIDER_IDS).toEqual(['grok', 'gptImage']);
    expect(PROVIDER_REGISTRY.grok.label).toBe('Grok');
    expect(PROVIDER_REGISTRY.gptImage.label).toBe('GPT');
  });

  it('exposes built-in default base URLs', () => {
    expect(getProviderDefaultBaseUrl('grok')).toBe('https://api.x.ai/v1');
    expect(getProviderDefaultBaseUrl('gptImage')).toBe('https://api.openai.com/v1');
  });

  it('returns metadata by id', () => {
    expect(getProviderMetadata('grok').id).toBe('grok');
    expect(getProviderMetadata('gptImage').id).toBe('gptImage');
  });

  it('returns an empty env API key string when not injected in test env', () => {
    expect(getProviderEnvApiKey('grok')).toBe('');
    expect(getProviderEnvApiKey('gptImage')).toBe('');
  });
});
