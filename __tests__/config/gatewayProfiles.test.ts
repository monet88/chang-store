import { describe, expect, it } from 'vitest';
import {
  ACTIVE_GATEWAY_PROFILE_KEY,
  DEFAULT_GEMINI_PROFILE_ID,
  driverForProvider,
  geminiProfileFor,
  imageProfileIdForProvider,
  isGatewayProfile,
  loadGatewayProfiles,
  providerIdForDriver,
  readStoredProfiles,
  resolveActiveProfile,
  type ProfileStorage,
} from '@/config/gatewayProfiles';

const memoryStorage = (initial: Record<string, string> = {}): ProfileStorage => {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
};

const GEMINI = { url: 'https://cliproxy.monet.uno', apiKey: 'cpa-key' };

describe('gateway profiles (US-006 Lớp 2b)', () => {
  it('folds the CPA settings into the single Gemini-lane profile and stores it once', () => {
    const storage = memoryStorage();
    const profiles = loadGatewayProfiles(storage, GEMINI);

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      id: DEFAULT_GEMINI_PROFILE_ID,
      lane: 'gemini',
      driver: 'gemini-native',
      baseUrl: 'https://cliproxy.monet.uno',
      apiKey: 'cpa-key',
      enabled: true,
    });
    expect(storage.getItem(ACTIVE_GATEWAY_PROFILE_KEY)).toBe(DEFAULT_GEMINI_PROFILE_ID);
    expect(readStoredProfiles(storage)).toEqual(profiles);
  });

  it('turns the legacy provider overrides into image-lane profiles of their own driver', () => {
    const storage = memoryStorage({
      'provider:gptImage:baseUrl': 'https://api.xompet.io.vn',
      'provider:gptImage:apiKey': 'xompet-key',
      'provider:grok:baseUrl': 'https://api.x.ai/v1',
      'provider:grok:apiKey': 'xai-key',
    });

    const profiles = loadGatewayProfiles(storage, GEMINI);
    const imageProfiles = profiles.filter((profile) => profile.lane === 'image');

    expect(imageProfiles).toHaveLength(2);
    expect(imageProfiles.find((profile) => profile.driver === 'openai-images')).toEqual({
      id: imageProfileIdForProvider('gptImage'),
      label: 'GPT',
      baseUrl: 'https://api.xompet.io.vn',
      apiKey: 'xompet-key',
      lane: 'image',
      driver: 'openai-images',
      enabled: true,
    });
    expect(imageProfiles.find((profile) => profile.driver === 'grok-images')).toEqual({
      id: imageProfileIdForProvider('grok'),
      label: 'Grok',
      baseUrl: 'https://api.x.ai/v1',
      apiKey: 'xai-key',
      lane: 'image',
      driver: 'grok-images',
      enabled: true,
    });
  });

  it('never seeds the CPA host into the image lane (invariant 11)', () => {
    const storage = memoryStorage({
      'provider:gptImage:baseUrl': 'https://cliproxy.monet.uno/v1',
      'provider:gptImage:apiKey': 'cpa-key',
    });

    const profiles = loadGatewayProfiles(storage, GEMINI);

    expect(profiles.filter((profile) => profile.lane === 'image')).toEqual([]);
  });

  it('seeds nothing for a provider that was never configured', () => {
    expect(loadGatewayProfiles(memoryStorage(), GEMINI).filter((p) => p.lane === 'image')).toEqual([]);
  });

  it('is idempotent and keeps operator edits while re-projecting the Gemini address', () => {
    const storage = memoryStorage();
    const seeded = loadGatewayProfiles(storage, GEMINI);
    const renamed = seeded.map((profile) => ({ ...profile, label: 'CPA nhà', enabled: false }));
    storage.setItem('gateway_profiles_v1', JSON.stringify(renamed));

    const reloaded = loadGatewayProfiles(storage, { url: 'https://gateway.example.com', apiKey: 'new-key' });

    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({
      label: 'CPA nhà',
      enabled: false,
      baseUrl: 'https://gateway.example.com',
      apiKey: 'new-key',
    });
  });

  it('re-seeds when the stored list is unusable instead of trusting it', () => {
    for (const stored of ['not json', '{}', '[]', '[{"id":"x"}]']) {
      const storage = memoryStorage({ gateway_profiles_v1: stored });

      expect(readStoredProfiles(storage)).toBeNull();
      expect(loadGatewayProfiles(storage, GEMINI)).toHaveLength(1);
    }
  });

  it('rejects a stored record with an unknown lane or driver', () => {
    const base = { id: 'x', label: 'x', baseUrl: 'https://x.test', apiKey: '', enabled: true };

    expect(isGatewayProfile({ ...base, lane: 'image', driver: 'openai-images' })).toBe(true);
    expect(isGatewayProfile({ ...base, lane: 'video', driver: 'openai-images' })).toBe(false);
    expect(isGatewayProfile({ ...base, lane: 'image', driver: 'guessed-images' })).toBe(false);
    expect(isGatewayProfile({ ...base, lane: 'image' })).toBe(false);
  });

  it('maps providers onto drivers both ways', () => {
    expect(driverForProvider('grok')).toBe('grok-images');
    expect(driverForProvider('gptImage')).toBe('openai-images');
    expect(providerIdForDriver('grok-images')).toBe('grok');
    expect(providerIdForDriver('openai-images')).toBe('gptImage');
    expect(providerIdForDriver('gemini-native')).toBeNull();
  });
});

describe('resolveActiveProfile', () => {
  const gemini = geminiProfileFor(GEMINI);
  const xompet = {
    id: 'xompet', label: 'xompet', baseUrl: 'https://api.xompet.io.vn', apiKey: 'k',
    lane: 'image' as const, driver: 'openai-images' as const, enabled: true,
  };
  const disabled = { ...xompet, id: 'off', enabled: false };
  const grok = { ...xompet, id: 'grok1', driver: 'grok-images' as const };
  const profiles = [gemini, xompet, disabled, grok];

  it('honors the selected id when it is usable', () => {
    expect(resolveActiveProfile(profiles, 'image', 'grok1', 'grok-images')?.id).toBe('grok1');
    expect(resolveActiveProfile(profiles, 'gemini', DEFAULT_GEMINI_PROFILE_ID)?.id).toBe(DEFAULT_GEMINI_PROFILE_ID);
  });

  it('falls back to the first usable profile of the requested driver', () => {
    expect(resolveActiveProfile(profiles, 'image', 'missing', 'openai-images')?.id).toBe('xompet');
    expect(resolveActiveProfile(profiles, 'image', null, 'grok-images')?.id).toBe('grok1');
  });

  it('never returns a disabled profile and never mixes drivers', () => {
    expect(resolveActiveProfile([gemini, disabled], 'image', 'off', 'openai-images')).toBeUndefined();
    expect(resolveActiveProfile([gemini], 'image', null, 'openai-images')).toBeUndefined();
  });
});
