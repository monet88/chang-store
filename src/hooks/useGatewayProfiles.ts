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
  geminiProfileFor,
  isProfileSelectable,
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
import { removeDesktopCredential, storeDesktopCredential } from '../platform/desktopCredentials';
import { invalidateCachedGatewayModels } from '../services/gatewayDiscoveryService';
import {
  DESKTOP_CREDENTIAL_SENTINEL,
  getDesktopGatewayApi,
  isStoredDesktopCredential,
} from '../platform/desktopGateway';

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
  /** Bumped when a probe wrote the served-model cache, so pickers re-read it. */
  servedModelsVersion: number;
  saveProfiles: (profiles: GatewayProfile[]) => void;
  /** The profile a driver uses right now, resolved from the selected id. */
  imageProfileForDriver: (driver: ImageDriverId) => GatewayProfile | undefined;
  selectImageProfile: (id: string | null) => void;
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
    setStoredProfiles(profiles);

    if (!getDesktopGatewayApi()) {
      saveGatewayProfiles(storage, profiles);
      return;
    }

    // Desktop never writes raw credentials into renderer localStorage. Other
    // profile fields persist immediately; the sentinel is written only after
    // main confirms the key reached encrypted storage.
    saveGatewayProfiles(
      storage,
      profiles.map((profile) => (
        profile.apiKey.trim() && !isStoredDesktopCredential(profile.apiKey)
          ? { ...profile, apiKey: '' }
          : profile
      )),
    );

    for (const profile of profiles) {
      const rawApiKey = profile.apiKey.trim();
      if (!rawApiKey) {
        const previous = storedProfiles.find((item) => item.id === profile.id);
        if (previous?.apiKey.trim()) {
          invalidateCachedGatewayModels(profile.id);
          void removeDesktopCredential(profile.id);
        }
        continue;
      }
      if (isStoredDesktopCredential(rawApiKey)) continue;

      void storeDesktopCredential(profile.id, profile.baseUrl, rawApiKey).then((stored) => {
        if (!stored) return;
        invalidateCachedGatewayModels(profile.id);
        setStoredProfiles((current) => {
          let changed = false;
          const next = current.map((item) => {
            if (item.id !== profile.id || item.apiKey !== profile.apiKey || item.baseUrl !== profile.baseUrl) {
              return item;
            }
            changed = true;
            return { ...item, apiKey: DESKTOP_CREDENTIAL_SENTINEL };
          });
          if (changed) {
            saveGatewayProfiles(
              storage,
              next.map((item) => (
                item.apiKey.trim() && !isStoredDesktopCredential(item.apiKey)
                  ? { ...item, apiKey: '' }
                  : item
              )),
            );
          }
          return changed ? next : current;
        });
      });
    }
  }, [storage, storedProfiles]);

  /** The image profile a driver uses: the active one, else that driver's first selectable one. */
  const imageProfileForDriver = useCallback((driver: ImageDriverId): GatewayProfile | undefined =>
    resolveActiveProfile(gatewayProfiles, 'image', activeImageProfileId, driver)
    ?? imageProfiles.find((profile) => profile.driver === driver && isProfileSelectable(profile)),
  [activeImageProfileId, gatewayProfiles, imageProfiles]);

  const selectImageProfile = useCallback((id: string | null) => {
    writeActiveProfileId(storage, ACTIVE_IMAGE_PROFILE_KEY, id);
    setActiveImageProfileId(id);
  }, [storage]);

  return {
    gatewayProfiles,
    geminiProfile,
    imageProfiles,
    activeImageProfileId,
    servedModelsVersion,
    saveProfiles: persist,
    imageProfileForDriver,
    selectImageProfile,
    notifyServedModelsChanged: useCallback(() => setServedModelsVersion((version) => version + 1), []),
  };
};
