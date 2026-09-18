import { describe, expect, it } from 'vitest';
import {
  ACTIVE_GATEWAY_PROFILE_KEY,
  ACTIVE_IMAGE_PROFILE_KEY,
  DEFAULT_GEMINI_PROFILE_ID,
  DEFAULT_IMAGE_PROFILE_ID,
  DEFAULT_OPENAI_BASE_URL,
  geminiProfileFor,
  isGatewayProfile,
  isImageDriverId,
  loadGatewayProfiles,
  readStoredProfiles,
  resolveActiveProfile,
  seedImageProfiles,
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
  it('folds the CPA settings into the single Gemini-lane profile and seeds the default image profile', () => {
    const storage = memoryStorage();
    const profiles = loadGatewayProfiles(storage, GEMINI);

    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      id: DEFAULT_GEMINI_PROFILE_ID,
      lane: 'gemini',
      driver: 'gemini-native',
      baseUrl: 'https://cliproxy.monet.uno',
      apiKey: 'cpa-key',
      enabled: true,
    });
    expect(profiles[1]).toMatchObject({
      id: DEFAULT_IMAGE_PROFILE_ID,
      label: 'GPT',
      baseUrl: DEFAULT_OPENAI_BASE_URL,
      apiKey: '',
      lane: 'image',
      driver: 'openai-images',
      enabled: true,
    });
    expect(storage.getItem(ACTIVE_GATEWAY_PROFILE_KEY)).toBe(DEFAULT_GEMINI_PROFILE_ID);
    expect(storage.getItem(ACTIVE_IMAGE_PROFILE_KEY)).toBe(DEFAULT_IMAGE_PROFILE_ID);
    expect(readStoredProfiles(storage)).toEqual(profiles);
  });

  it('seeds an env-default image profile with openai-images driver on fresh install', () => {
    const storage = memoryStorage();
    const profiles = loadGatewayProfiles(storage, GEMINI);
    const imageProfiles = profiles.filter((profile) => profile.lane === 'image');

    expect(imageProfiles).toHaveLength(1);
    expect(imageProfiles[0]).toEqual({
      id: DEFAULT_IMAGE_PROFILE_ID,
      label: 'GPT',
      baseUrl: DEFAULT_OPENAI_BASE_URL,
      apiKey: '',
      lane: 'image',
      driver: 'openai-images',
      enabled: true,
    });
  });

  it('never seeds the CPA host into the image lane (invariant 11)', () => {
    const originalBaseUrl = process.env.GPT_IMAGE_BASE_URL;
    process.env.GPT_IMAGE_BASE_URL = 'https://cliproxy.monet.uno/v1';
    try {
      expect(seedImageProfiles()).toEqual([]);
    } finally {
      process.env.GPT_IMAGE_BASE_URL = originalBaseUrl;
    }
  });

  it('is idempotent and keeps operator edits while re-projecting the Gemini address', () => {
    const storage = memoryStorage();
    const seeded = loadGatewayProfiles(storage, GEMINI);
    const renamed = seeded.map((profile) => ({ ...profile, label: 'CPA nhà', enabled: false }));
    storage.setItem('gateway_profiles_v1', JSON.stringify(renamed));

    const reloaded = loadGatewayProfiles(storage, { url: 'https://gateway.example.com', apiKey: 'new-key' });

    expect(reloaded).toHaveLength(2);
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
      expect(loadGatewayProfiles(storage, GEMINI)).toHaveLength(2);
    }
  });

  it('rejects a stored record with an unknown lane or driver', () => {
    const base = { id: 'x', label: 'x', baseUrl: 'https://x.test', apiKey: '', enabled: true };

    expect(isGatewayProfile({ ...base, lane: 'image', driver: 'openai-images' })).toBe(true);
    expect(isGatewayProfile({ ...base, lane: 'video', driver: 'openai-images' })).toBe(false);
    expect(isGatewayProfile({ ...base, lane: 'image', driver: 'grok-images' })).toBe(false);
    expect(isImageDriverId('grok-images')).toBe(false);
    expect(isGatewayProfile({ ...base, lane: 'image' })).toBe(false);
  });

  it('drops stored Grok image profiles on load', () => {
    const storage = memoryStorage({
      gateway_profiles_v1: JSON.stringify([
        { id: 'cpa', label: 'CPA', baseUrl: 'https://cpa.test', apiKey: 'k', lane: 'gemini', driver: 'gemini-native', enabled: true },
        { id: 'grok-1', label: 'Grok', baseUrl: 'https://api.x.ai/v1', apiKey: 'k', lane: 'image', driver: 'grok-images', enabled: true },
      ]),
    });
    const loaded = loadGatewayProfiles(storage, GEMINI);
    expect(loaded.some((p) => (p.driver as string) === 'grok-images')).toBe(false);
    expect(readStoredProfiles(storage)?.some((p) => (p.driver as string) === 'grok-images')).toBe(false);
  });

  it('cleans up orphaned legacy provider:* keys on load', () => {
    const storage = memoryStorage({
      'provider:gptImage:baseUrl': 'https://api.openai.com/v1',
      'provider:gptImage:apiKey': 'oai-key',
      'provider:grok:baseUrl': 'https://api.x.ai/v1',
      'provider:grok:apiKey': 'xai-key',
    });
    loadGatewayProfiles(storage, GEMINI);
    expect(storage.getItem('provider:gptImage:baseUrl')).toBeNull();
    expect(storage.getItem('provider:gptImage:apiKey')).toBeNull();
    expect(storage.getItem('provider:grok:baseUrl')).toBeNull();
    expect(storage.getItem('provider:grok:apiKey')).toBeNull();
  });
});

describe('resolveActiveProfile', () => {
  const gemini = geminiProfileFor(GEMINI);
  const xompet = {
    id: 'xompet', label: 'xompet', baseUrl: 'https://api.xompet.io.vn', apiKey: 'k',
    lane: 'image' as const, driver: 'openai-images' as const, enabled: true,
  };
  const disabled = { ...xompet, id: 'off', enabled: false };
  const profiles = [gemini, xompet, disabled];

  it('honors the selected id when it is usable', () => {
    expect(resolveActiveProfile(profiles, 'image', 'xompet', 'openai-images')?.id).toBe('xompet');
    expect(resolveActiveProfile(profiles, 'gemini', DEFAULT_GEMINI_PROFILE_ID)?.id).toBe(DEFAULT_GEMINI_PROFILE_ID);
  });

  it('falls back to the first usable profile of the requested driver', () => {
    expect(resolveActiveProfile(profiles, 'image', 'missing', 'openai-images')?.id).toBe('xompet');
  });

  it('never returns a disabled profile and never mixes drivers', () => {
    expect(resolveActiveProfile([gemini, disabled], 'image', 'off', 'openai-images')).toBeUndefined();
    expect(resolveActiveProfile([gemini], 'image', null, 'openai-images')).toBeUndefined();
  });
});
