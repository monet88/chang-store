import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGatewayProfiles } from '@/hooks/useGatewayProfiles';
import {
  ACTIVE_IMAGE_PROFILE_KEY,
  GATEWAY_PROFILES_KEY,
  type GatewayProfile,
  type ProfileStorage,
} from '@/config/gatewayProfiles';

const GEMINI = { url: 'https://cliproxy.monet.uno', apiKey: 'sk-cpa-gateway' };

const openAiProfile = (overrides: Partial<GatewayProfile> = {}): GatewayProfile => ({
  id: 'gptImage-default',
  label: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-openai',
  lane: 'image',
  driver: 'openai-images',
  enabled: true,
  ...overrides,
});

const storageWith = (profiles: GatewayProfile[], activeId?: string): ProfileStorage => {
  const map = new Map<string, string>([[GATEWAY_PROFILES_KEY, JSON.stringify(profiles)]]);
  if (activeId) {
    map.set(ACTIVE_IMAGE_PROFILE_KEY, activeId);
  }
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
};

const profilesFrom = (profiles: GatewayProfile[], activeId?: string) =>
  renderHook(() => useGatewayProfiles({ gemini: GEMINI, storage: storageWith(profiles, activeId) })).result.current;

describe('useGatewayProfiles image-lane resolution', () => {
  beforeEach(() => {
    delete window.desktopGateway;
  });

  it('keeps a disabled profile out of the driver fallback', () => {
    const api = profilesFrom([openAiProfile({ enabled: false, apiKey: 'sk-disabled-profile' })]);

    expect(api.imageProfileForDriver('openai-images')).toBeUndefined();
  });

  it('refuses to pair a profile with no address against the default host', () => {
    const api = profilesFrom(
      [openAiProfile({ id: 'blank-address', baseUrl: '   ', apiKey: 'sk-gateway-secret' })],
      'blank-address',
    );

    // A selected profile whose address was cleared has no request target: fail closed
    // with its empty address instead of sending its key to api.openai.com.
    const resolved = api.imageProfileForDriver('openai-images');
    expect(resolved?.baseUrl.trim()).toBe('');
  });

  it('selects and switches active image profile', () => {
    const custom = openAiProfile({ id: 'custom-profile', baseUrl: 'https://api.custom.com/v1', apiKey: 'custom-key' });
    const api = profilesFrom([openAiProfile(), custom], 'custom-profile');

    expect(api.activeImageProfileId).toBe('custom-profile');
    expect(api.imageProfileForDriver('openai-images')?.id).toBe('custom-profile');
  });

  it('removes the vaulted desktop credential when a profile key is cleared', async () => {
    const removeCredential = vi.fn().mockResolvedValue({ ok: true, value: null });
    const storeCredential = vi.fn().mockResolvedValue({ ok: true, value: null });
    Object.defineProperty(window, 'desktopGateway', {
      configurable: true,
      value: { removeCredential, storeCredential },
    });
    const stored = openAiProfile({ apiKey: '__desktop_gateway_credential__' });
    const storage = storageWith([stored]);
    const { result } = renderHook(() => useGatewayProfiles({ gemini: GEMINI, storage }));

    act(() => {
      result.current.saveProfiles(
        result.current.gatewayProfiles.map((profile) => (
          profile.id === stored.id ? { ...profile, apiKey: '' } : profile
        )),
      );
    });

    await waitFor(() => {
      expect(removeCredential).toHaveBeenCalledWith({ credentialRef: stored.id });
    });
  });
});
