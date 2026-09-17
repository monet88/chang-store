/**
 * Gateway profile state (US-006 Lớp 2b).
 *
 * Owns the profile store, the lane selections, and the provider settings the studios read.
 * The Gemini profile is a projection of the CPA gateway settings (single source), the image
 * lane accepts any number of profiles, and the legacy `provider:*` overrides become
 * image-lane profiles on first load.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ACTIVE_IMAGE_PROFILE_KEY,
  driverForProvider,
  geminiProfileFor,
  imageProfileIdForProvider,
  isProfileSelectable,
  legacyProviderApiKeyKey,
  legacyProviderBaseUrlKey,
  loadGatewayProfiles,
  readActiveProfileId,
  resolveActiveProfile,
  saveGatewayProfiles,
  writeActiveProfileId,
  type GeminiGatewaySeed,
  type GatewayProfile,
  type ProfileStorage,
} from '../config/gatewayProfiles';
import type { ImageDriverId } from '../config/imageModelCatalog';
import {
  PROVIDER_IDS,
  getProviderDefaultBaseUrl,
  getProviderEnvApiKey,
  getProviderMetadata,
  type ProviderId,
} from '../config/providerRegistry';

/** User-overridable settings for a single provider studio. */
export interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
}

export interface UseGatewayProfilesParams {
  gemini: GeminiGatewaySeed;
  storage: ProfileStorage;
}

export interface UseGatewayProfilesReturn {
  /** The projected list: Gemini first, then the image lane. */
  gatewayProfiles: GatewayProfile[];
  geminiProfile: GatewayProfile;
  imageProfiles: GatewayProfile[];
  activeImageProfileId: string | null;
  providerSettings: Record<ProviderId, ProviderSettings>;
  /** Bumped when a probe wrote the served-model cache, so pickers re-read it. */
  servedModelsVersion: number;
  saveProfiles: (profiles: GatewayProfile[]) => void;
  /** The profile a driver uses right now, resolved from the selected id. */
  imageProfileForDriver: (driver: ImageDriverId) => GatewayProfile | undefined;
  selectImageProfile: (id: string | null) => void;
  setProviderSettings: (provider: ProviderId, settings: Partial<ProviderSettings>) => void;
  resetProviderSettings: (provider: ProviderId) => void;
  notifyServedModelsChanged: () => void;
}

export const useGatewayProfiles = ({ gemini, storage }: UseGatewayProfilesParams): UseGatewayProfilesReturn => {
  const [storedProfiles, setStoredProfiles] = useState<GatewayProfile[]>(() => loadGatewayProfiles(storage, gemini));
  const [activeImageProfileId, setActiveImageProfileId] = useState<string | null>(
    () => readActiveProfileId(storage, ACTIVE_IMAGE_PROFILE_KEY),
  );
  const [servedModelsVersion, setServedModelsVersion] = useState(0);

  const gatewayProfiles = useMemo(() => {
    const geminiProfile = geminiProfileFor(gemini, storedProfiles.find((profile) => profile.lane === 'gemini'));
    return [geminiProfile, ...storedProfiles.filter((profile) => profile.lane !== 'gemini')];
  }, [storedProfiles, gemini]);

  const geminiProfile = gatewayProfiles[0];
  const imageProfiles = useMemo(() => gatewayProfiles.filter((profile) => profile.lane === 'image'), [gatewayProfiles]);

  const persist = useCallback((profiles: GatewayProfile[]) => {
    saveGatewayProfiles(storage, profiles);
    setStoredProfiles(profiles);
  }, [storage]);

  /** The image profile a driver uses: the active one, else that driver's first selectable one. */
  const imageProfileForDriver = useCallback((driver: ImageDriverId): GatewayProfile | undefined =>
    resolveActiveProfile(gatewayProfiles, 'image', activeImageProfileId, driver)
    ?? imageProfiles.find((profile) => profile.driver === driver && isProfileSelectable(profile)),
  [activeImageProfileId, gatewayProfiles, imageProfiles]);

  const imageProfileFor = useCallback(
    (provider: ProviderId): GatewayProfile | undefined => imageProfileForDriver(driverForProvider(provider)),
    [imageProfileForDriver],
  );

  const providerSettings = useMemo(() => {
    const resolved = {} as Record<ProviderId, ProviderSettings>;
    for (const provider of PROVIDER_IDS) {
      const profile = imageProfileFor(provider);
      if (profile) {
        const baseUrl = profile.baseUrl.trim();
        // A profile with no address has no request target: pairing its key with the provider
        // default would send a gateway key to OpenAI. Fail closed until an address is set.
        resolved[provider] = baseUrl
          ? { baseUrl, apiKey: profile.apiKey.trim() || getProviderEnvApiKey(provider) }
          : { baseUrl: '', apiKey: '' };
        continue;
      }
      // No image-lane profile yet: the legacy override, then the provider's own defaults.
      const storedBaseUrl = storage.getItem(legacyProviderBaseUrlKey(provider))?.trim() ?? '';
      const storedApiKey = storage.getItem(legacyProviderApiKeyKey(provider))?.trim() ?? '';
      resolved[provider] = {
        baseUrl: storedBaseUrl || getProviderDefaultBaseUrl(provider),
        apiKey: storedApiKey || getProviderEnvApiKey(provider),
      };
    }
    return resolved;
  }, [imageProfileFor, storage]);

  const selectImageProfile = useCallback((id: string | null) => {
    writeActiveProfileId(storage, ACTIVE_IMAGE_PROFILE_KEY, id);
    setActiveImageProfileId(id);
  }, [storage]);

  const setProviderSettings = useCallback((provider: ProviderId, settings: Partial<ProviderSettings>) => {
    const current = imageProfileFor(provider);
    const target: GatewayProfile = current
      ? { ...current, ...settings }
      : {
        id: imageProfileIdForProvider(provider),
        label: getProviderMetadata(provider).label,
        baseUrl: settings.baseUrl ?? getProviderDefaultBaseUrl(provider),
        apiKey: settings.apiKey ?? getProviderEnvApiKey(provider),
        lane: 'image',
        driver: driverForProvider(provider),
        enabled: true,
      };

    persist(current
      ? gatewayProfiles.map((profile) => (profile.id === target.id ? target : profile))
      : [...gatewayProfiles, target]);
    // The legacy `provider:*` keys stay a mirror: they are the fallback when a driver has no
    // profile, and every consumer written before profiles existed still reads them.
    storage.setItem(legacyProviderApiKeyKey(provider), target.apiKey);
    storage.setItem(legacyProviderBaseUrlKey(provider), target.baseUrl);
    if (!current) {
      selectImageProfile(target.id);
    }
  }, [gatewayProfiles, imageProfileFor, persist, selectImageProfile, storage]);

  const resetProviderSettings = useCallback((provider: ProviderId) => {
    const driver = driverForProvider(provider);
    const removedIds = imageProfiles.filter((profile) => profile.driver === driver).map((profile) => profile.id);
    persist(gatewayProfiles.filter((profile) => !removedIds.includes(profile.id)));
    storage.removeItem(legacyProviderApiKeyKey(provider));
    storage.removeItem(legacyProviderBaseUrlKey(provider));
    if (activeImageProfileId && removedIds.includes(activeImageProfileId)) {
      selectImageProfile(null);
    }
  }, [activeImageProfileId, gatewayProfiles, imageProfiles, persist, selectImageProfile, storage]);

  return {
    gatewayProfiles,
    geminiProfile,
    imageProfiles,
    activeImageProfileId,
    providerSettings,
    servedModelsVersion,
    saveProfiles: persist,
    imageProfileForDriver,
    selectImageProfile,
    setProviderSettings,
    resetProviderSettings,
    notifyServedModelsChanged: useCallback(() => setServedModelsVersion((version) => version + 1), []),
  };
};
