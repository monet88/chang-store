import { describe, it, expect } from 'vitest';
import {
  validateProviderBaseUrl,
  isUsableProviderBaseUrl,
  ALLOWED_PROVIDER_HOSTS,
} from '@/utils/provider-url-validation';

describe('validateProviderBaseUrl', () => {
  it('allows known provider hosts over HTTPS', () => {
    expect(validateProviderBaseUrl('https://api.x.ai/v1')).toMatchObject({
      status: 'allowed',
      host: 'api.x.ai',
    });
    expect(validateProviderBaseUrl('https://api.openai.com/v1')).toMatchObject({
      status: 'allowed',
      host: 'api.openai.com',
    });
  });

  it('flags custom HTTPS domains for confirmation', () => {
    expect(validateProviderBaseUrl('https://proxy.example.com/v1')).toMatchObject({
      status: 'custom',
      host: 'proxy.example.com',
    });
  });

  it('accepts non-HTTPS (http) URLs for local proxies', () => {
    expect(validateProviderBaseUrl('http://api.x.ai/v1')).toMatchObject({
      status: 'allowed',
      host: 'api.x.ai',
    });
    expect(validateProviderBaseUrl('http://localhost:8333')).toMatchObject({
      status: 'custom',
      host: 'localhost',
    });
  });

  it('rejects empty and malformed URLs', () => {
    expect(validateProviderBaseUrl('')).toEqual({ status: 'invalid', reason: 'empty' });
    expect(validateProviderBaseUrl('   ')).toEqual({ status: 'invalid', reason: 'empty' });
    expect(validateProviderBaseUrl('not a url')).toEqual({ status: 'invalid', reason: 'not-a-url' });
  });

  it('normalizes www and casing when matching the allowlist', () => {
    expect(validateProviderBaseUrl('https://API.X.AI/v1').status).toBe('allowed');
    expect(validateProviderBaseUrl('https://www.api.openai.com/v1').status).toBe('allowed');
  });

  it('isUsableProviderBaseUrl is true for allowed and custom, false for invalid', () => {
    expect(isUsableProviderBaseUrl('https://api.x.ai/v1')).toBe(true);
    expect(isUsableProviderBaseUrl('https://proxy.example.com')).toBe(true);
    expect(isUsableProviderBaseUrl('http://localhost:8333')).toBe(true);
    expect(isUsableProviderBaseUrl('not a url')).toBe(false);
  });

  it('exposes the expected allowlist', () => {
    expect(ALLOWED_PROVIDER_HOSTS).toContain('api.x.ai');
    expect(ALLOWED_PROVIDER_HOSTS).toContain('api.openai.com');
  });
});
