import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_CREDENTIAL_SENTINEL } from '@/platform/desktopGateway';
import { migrateDesktopGatewayCredentials } from '@/platform/desktopCredentials';

describe('desktopCredentials', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.desktopGateway;
  });

  it('moves persisted CPA and image-profile keys into the desktop vault and leaves only sentinels', async () => {
    const storeCredential = vi.fn().mockResolvedValue({ ok: true, value: null });
    Object.defineProperty(window, 'desktopGateway', {
      configurable: true,
      value: { storeCredential },
    });
    localStorage.setItem('cpa_gateway_api_key', 'cpa-secret');
    localStorage.setItem('gateway_profiles_v1', JSON.stringify([
      {
        id: 'cpa-default',
        label: 'CPA',
        baseUrl: 'https://cliproxy.monet.uno',
        apiKey: 'cpa-secret',
        lane: 'gemini',
        driver: 'gemini-native',
        enabled: true,
      },
      {
        id: 'image-custom',
        label: 'Image',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'image-secret',
        lane: 'image',
        driver: 'openai-images',
        enabled: true,
      },
    ]));

    await migrateDesktopGatewayCredentials();

    expect(storeCredential).toHaveBeenCalledWith({
      credentialRef: 'cpa-default',
      baseUrl: 'https://cliproxy.monet.uno',
      apiKey: 'cpa-secret',
    });
    expect(storeCredential).toHaveBeenCalledWith({
      credentialRef: 'image-custom',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'image-secret',
    });
    expect(localStorage.getItem('cpa_gateway_api_key')).toBe(DESKTOP_CREDENTIAL_SENTINEL);
    const profiles = JSON.parse(localStorage.getItem('gateway_profiles_v1') ?? '[]') as Array<{ apiKey: string }>;
    expect(profiles.map((profile) => profile.apiKey)).toEqual([
      DESKTOP_CREDENTIAL_SENTINEL,
      DESKTOP_CREDENTIAL_SENTINEL,
    ]);
    expect(storeCredential.mock.calls.filter(([input]) => input.credentialRef === 'cpa-default')).toHaveLength(1);
  });

  it('keeps the CPA settings key authoritative over a stale gemini profile copy', async () => {
    const storeCredential = vi.fn().mockResolvedValue({ ok: true, value: null });
    Object.defineProperty(window, 'desktopGateway', {
      configurable: true,
      value: { storeCredential },
    });
    localStorage.setItem('cpa_gateway_url', 'https://cliproxy.monet.uno');
    localStorage.setItem('cpa_gateway_api_key', 'fresh-cpa-key');
    localStorage.setItem('gateway_profiles_v1', JSON.stringify([{
      id: 'cpa-default',
      label: 'CPA',
      baseUrl: 'https://cliproxy.monet.uno',
      apiKey: 'stale-profile-key',
      lane: 'gemini',
      driver: 'gemini-native',
      enabled: true,
    }]));

    await migrateDesktopGatewayCredentials();

    const cpaStores = storeCredential.mock.calls.filter(([input]) => input.credentialRef === 'cpa-default');
    expect(cpaStores).toEqual([[
      {
        credentialRef: 'cpa-default',
        baseUrl: 'https://cliproxy.monet.uno',
        apiKey: 'fresh-cpa-key',
      },
    ]]);
    const profiles = JSON.parse(localStorage.getItem('gateway_profiles_v1') ?? '[]') as Array<{ apiKey: string }>;
    expect(profiles[0]?.apiKey).toBe(DESKTOP_CREDENTIAL_SENTINEL);
  });

  it('does nothing in the web runtime', async () => {
    localStorage.setItem('cpa_gateway_api_key', 'web-secret');
    await migrateDesktopGatewayCredentials();
    expect(localStorage.getItem('cpa_gateway_api_key')).toBe('web-secret');
  });

  it('keeps the existing plaintext value when secure migration fails', async () => {
    const storeCredential = vi.fn().mockResolvedValue({
      ok: false,
      error: { message: 'secure storage unavailable' },
    });
    Object.defineProperty(window, 'desktopGateway', {
      configurable: true,
      value: { storeCredential },
    });
    localStorage.setItem('cpa_gateway_url', 'https://cliproxy.monet.uno');
    localStorage.setItem('cpa_gateway_api_key', 'existing-secret');

    await migrateDesktopGatewayCredentials();

    expect(localStorage.getItem('cpa_gateway_api_key')).toBe('existing-secret');
  });

  it('moves the legacy vertex gateway key into the desktop vault before React mounts', async () => {
    const storeCredential = vi.fn().mockResolvedValue({ ok: true, value: null });
    Object.defineProperty(window, 'desktopGateway', {
      configurable: true,
      value: { storeCredential },
    });
    localStorage.setItem('vertex_proxy_url', 'https://legacy.example.com');
    localStorage.setItem('vertex_proxy_api_key', 'legacy-secret');

    await migrateDesktopGatewayCredentials();

    expect(storeCredential).toHaveBeenCalledWith({
      credentialRef: 'cpa-default',
      baseUrl: 'https://legacy.example.com',
      apiKey: 'legacy-secret',
    });
    expect(localStorage.getItem('cpa_gateway_url')).toBe('https://legacy.example.com');
    expect(localStorage.getItem('cpa_gateway_api_key')).toBe(DESKTOP_CREDENTIAL_SENTINEL);
    expect(localStorage.getItem('vertex_proxy_url')).toBeNull();
    expect(localStorage.getItem('vertex_proxy_api_key')).toBeNull();
  });
});
