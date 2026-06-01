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

  it('accepts http only for localhost and private/loopback hosts', () => {
    // Allowlisted hosts still match by host name even over http (api.x.ai is public,
    // but the policy gate on http is the host being private — api.x.ai is not, so this should fail).
    expect(validateProviderBaseUrl('http://api.x.ai/v1')).toEqual({
      status: 'invalid',
      reason: 'insecure-http',
    });

    // localhost / loopback / private network is fine for local proxies.
    expect(validateProviderBaseUrl('http://localhost:8333')).toMatchObject({
      status: 'custom',
      host: 'localhost',
    });
    expect(validateProviderBaseUrl('http://127.0.0.1:3000')).toMatchObject({
      status: 'custom',
      host: '127.0.0.1',
    });
    expect(validateProviderBaseUrl('http://192.168.1.10:8080')).toMatchObject({
      status: 'custom',
      host: '192.168.1.10',
    });
    expect(validateProviderBaseUrl('http://10.0.0.5:80')).toMatchObject({
      status: 'custom',
      host: '10.0.0.5',
    });
    expect(validateProviderBaseUrl('http://172.16.5.1')).toMatchObject({
      status: 'custom',
      host: '172.16.5.1',
    });
    expect(validateProviderBaseUrl('http://[::1]:8000')).toMatchObject({
      status: 'custom',
      host: '::1',
    });
    expect(validateProviderBaseUrl('http://my-proxy.local')).toMatchObject({
      status: 'custom',
      host: 'my-proxy.local',
    });
  });

  it('rejects http on public hosts so bearer tokens never go over plain HTTP', () => {
    expect(validateProviderBaseUrl('http://proxy.example.com/v1')).toEqual({
      status: 'invalid',
      reason: 'insecure-http',
    });
    expect(validateProviderBaseUrl('http://8.8.8.8')).toEqual({
      status: 'invalid',
      reason: 'insecure-http',
    });
    // 172.32 is outside the 172.16/12 RFC1918 range, so it's public.
    expect(validateProviderBaseUrl('http://172.32.0.1')).toEqual({
      status: 'invalid',
      reason: 'insecure-http',
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
