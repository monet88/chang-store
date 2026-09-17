/**
 * Gateway profiles (US-006 Lớp 2b).
 *
 * One profile = one lane = one driver (design invariant 10): the `gemini` lane is the CPA
 * route the app already drives and holds exactly one profile, the `image` lane holds any
 * number of OpenAI-Images / Grok gateways. The legacy `cpa_gateway_*` / `provider:*` keys
 * are read once and folded into profiles; `gateway_profiles_v1` is the store from then on.
 */
import {
  PROVIDER_IDS,
  getProviderDefaultBaseUrl,
  getProviderEnvApiKey,
  getProviderMetadata,
  type ProviderId,
} from './providerRegistry';
import { CPA_GATEWAY_HOST, type GatewayLane, type ImageDriverId } from './imageModelCatalog';
import { gatewayHostOf } from '../services/providers/shared/imageDriverPolicy';

export interface GatewayProfile {
  /** Stable slug, used in storage keys and in the picker. */
  id: string;
  /** Operator-facing, e.g. "xompet" / "gateway rẻ #3". */
  label: string;
  baseUrl: string;
  apiKey: string;
  lane: GatewayLane;
  driver: ImageDriverId;
  /** Disabled profiles stay stored but are hidden from pickers. */
  enabled: boolean;
}

export const GATEWAY_PROFILES_KEY = 'gateway_profiles_v1';
export const ACTIVE_GATEWAY_PROFILE_KEY = 'active_gateway_profile_v1';
export const ACTIVE_IMAGE_PROFILE_KEY = 'active_image_profile_v1';
export const DEFAULT_GEMINI_PROFILE_ID = 'cpa-default';
export const DEFAULT_GEMINI_PROFILE_LABEL = 'Cliproxy';

/** The slice of `Storage` this module needs, so the store is testable without a DOM. */
export interface ProfileStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const legacyProviderBaseUrlKey = (provider: ProviderId): string => `provider:${provider}:baseUrl`;
export const legacyProviderApiKeyKey = (provider: ProviderId): string => `provider:${provider}:apiKey`;
export const imageProfileIdForProvider = (provider: ProviderId): string => `${provider}-default`;

const DRIVER_BY_PROVIDER: Record<ProviderId, ImageDriverId> = {
  grok: 'grok-images',
  gptImage: 'openai-images',
};

export const driverForProvider = (provider: ProviderId): ImageDriverId => DRIVER_BY_PROVIDER[provider];

/** The provider a driver's profiles serve; `gemini-native` has no studio-side provider. */
export function providerIdForDriver(driver: ImageDriverId): ProviderId | null {
  return PROVIDER_IDS.find((provider) => DRIVER_BY_PROVIDER[provider] === driver) ?? null;
}

const isLane = (value: unknown): value is GatewayLane => value === 'gemini' || value === 'image';

export const isImageDriverId = (value: unknown): value is ImageDriverId =>
  value === 'gemini-native' || value === 'openai-images' || value === 'grok-images';

/** Every field checked before a stored record is trusted. */
export function isGatewayProfile(value: unknown): value is GatewayProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'id' in value && typeof value.id === 'string'
    && 'label' in value && typeof value.label === 'string'
    && 'baseUrl' in value && typeof value.baseUrl === 'string'
    && 'apiKey' in value && typeof value.apiKey === 'string'
    && 'enabled' in value && typeof value.enabled === 'boolean'
    && 'lane' in value && isLane(value.lane)
    && 'driver' in value && isImageDriverId(value.driver)
  );
}

export function readStoredProfiles(storage: ProfileStorage): GatewayProfile[] | null {
  const raw = storage.getItem(GATEWAY_PROFILES_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const profiles = parsed.filter(isGatewayProfile);
    return profiles.length > 0 ? profiles : null;
  } catch {
    return null;
  }
}

export function saveGatewayProfiles(storage: ProfileStorage, profiles: GatewayProfile[]): void {
  storage.setItem(GATEWAY_PROFILES_KEY, JSON.stringify(profiles));
}

export const readActiveProfileId = (storage: ProfileStorage, key: string): string | null =>
  storage.getItem(key)?.trim() || null;

export const writeActiveProfileId = (storage: ProfileStorage, key: string, id: string | null): void => {
  if (id) {
    storage.setItem(key, id);
    return;
  }
  storage.removeItem(key);
};

export interface GeminiGatewaySeed {
  url: string;
  apiKey: string;
}

/** The Gemini lane's single profile from a CPA settings seed, keeping the operator's label. */
export const geminiProfileFor = (seed: GeminiGatewaySeed, previous?: GatewayProfile): GatewayProfile => ({
  id: previous?.id ?? DEFAULT_GEMINI_PROFILE_ID,
  label: previous?.label ?? DEFAULT_GEMINI_PROFILE_LABEL,
  baseUrl: seed.url,
  apiKey: seed.apiKey,
  lane: 'gemini',
  driver: 'gemini-native',
  enabled: previous?.enabled ?? true,
});

/** The Gemini lane's profile as stored, without the CPA projection. */
export const geminiProfileOf = (profiles: readonly GatewayProfile[]): GatewayProfile | undefined =>
  profiles.find((profile) => profile.lane === 'gemini');

/**
 * One image-lane profile per provider that carries a stored override, and never the CPA host
 * (invariant 11: the CPA answers the images route in its own fixed size, so it is not an
 * image-lane gateway unless the operator adds it as one explicitly).
 */
export function seedImageProfiles(storage: ProfileStorage): GatewayProfile[] {
  const seeded: GatewayProfile[] = [];
  for (const provider of PROVIDER_IDS) {
    const storedBaseUrl = storage.getItem(legacyProviderBaseUrlKey(provider))?.trim() ?? '';
    const storedApiKey = storage.getItem(legacyProviderApiKeyKey(provider))?.trim() ?? '';
    if (!storedBaseUrl && !storedApiKey) {
      continue;
    }
    const baseUrl = storedBaseUrl || getProviderDefaultBaseUrl(provider);
    if (gatewayHostOf(baseUrl) === CPA_GATEWAY_HOST) {
      continue;
    }
    seeded.push({
      id: imageProfileIdForProvider(provider),
      label: getProviderMetadata(provider).label,
      baseUrl,
      apiKey: storedApiKey || getProviderEnvApiKey(provider),
      lane: 'image',
      driver: driverForProvider(provider),
      enabled: true,
    });
  }
  return seeded;
}

/** The stored profiles, seeded from the legacy keys on first run. Idempotent. */
export function loadGatewayProfiles(storage: ProfileStorage, gemini: GeminiGatewaySeed): GatewayProfile[] {
  const stored = readStoredProfiles(storage);
  const geminiProfile = geminiProfileFor(gemini, geminiProfileOf(stored ?? []));
  const profiles = [geminiProfile, ...(stored ?? seedImageProfiles(storage)).filter((p) => p.lane !== 'gemini')];

  if (!stored) {
    saveGatewayProfiles(storage, profiles);
    writeActiveProfileId(storage, ACTIVE_GATEWAY_PROFILE_KEY, geminiProfile.id);
  }
  return profiles;
}

const isUsable = (profile: GatewayProfile): boolean => profile.enabled && profile.baseUrl.trim().length > 0;

/** The active profile of a lane: the selected id when usable, else the first usable one. */
export function resolveActiveProfile(
  profiles: readonly GatewayProfile[],
  lane: GatewayLane,
  activeId?: string | null,
  driver?: ImageDriverId,
): GatewayProfile | undefined {
  const candidates = profiles.filter(
    (profile) => profile.lane === lane && (driver === undefined || profile.driver === driver),
  );
  const selected = candidates.find((profile) => profile.id === activeId);
  if (selected?.enabled) {
    return selected;
  }
  return candidates.find(isUsable);
}

/** Disabled profiles stay in the store but never reach a picker or a request. */
export const isProfileSelectable = isUsable;
