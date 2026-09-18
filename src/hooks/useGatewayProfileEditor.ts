/**
 * Editor state for the gateway profile lists (US-006 Lớp 2b).
 *
 * Image-lane rows commit as they are edited (they are a list, not a form); the Gemini row
 * stays a draft owned by the settings modal, so its probe reads what the operator typed.
 */
import { useCallback, useState } from 'react';
import { useApi } from '../contexts/ApiProviderContext';
import type { GatewayProfile } from '../config/gatewayProfiles';
import { listGatewayModels, type GatewayProbeResult } from '../services/gatewayDiscoveryService';
import { logEvent } from '../services/debugService';
import { isUsableProviderBaseUrl } from '../utils/provider-url-validation';

/** The row shape the editor renders; re-exported so the UI layer never imports config. */
export type EditorProfile = GatewayProfile;

/** API shapes an image-lane profile can speak; the label keys stay in the locale files. */
export const IMAGE_DRIVER_OPTIONS: readonly { value: string; labelKey: string }[] = [
  { value: 'openai-images', labelKey: 'settingsModal.gatewayProfiles.drivers.openaiImages' },
];

export type ProfileProbeState =
  | { phase: 'probing' }
  | { phase: 'invalid' }
  | { phase: 'done'; result: GatewayProbeResult };

export interface UseGatewayProfileEditorReturn {
  imageProfiles: GatewayProfile[];
  activeImageProfileId: string | null;
  probeStates: Record<string, ProfileProbeState | undefined>;
  updateImageProfile: (id: string, patch: Partial<GatewayProfile>) => void;
  addImageProfile: () => void;
  selectImageProfile: (id: string) => void;
  removeImageProfile: (id: string) => void;
  probeProfile: (id: string, baseUrl: string, apiKey: string) => Promise<void>;
}

export const useGatewayProfileEditor = (): UseGatewayProfileEditorReturn => {
  const api = useApi();
  const [probeStates, setProbeStates] = useState<Record<string, ProfileProbeState | undefined>>({});

  const updateImageProfile = useCallback((id: string, patch: Partial<GatewayProfile>) => {
    api.saveGatewayProfiles(
      api.gatewayProfiles.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)),
    );
  }, [api]);

  const addImageProfile = useCallback(() => {
    const profile: GatewayProfile = {
      id: `image-${crypto.randomUUID().slice(0, 8)}`,
      label: '',
      baseUrl: '',
      apiKey: '',
      lane: 'image',
      driver: 'openai-images',
      enabled: true,
    };
    api.saveGatewayProfiles([...api.gatewayProfiles, profile]);
    api.selectImageProfile(profile.id);
  }, [api]);

  const selectImageProfile = useCallback((id: string) => {
    api.selectImageProfile(id);
  }, [api]);

  const removeImageProfile = useCallback((id: string) => {
    api.saveGatewayProfiles(api.gatewayProfiles.filter((profile) => profile.id !== id));
    if (api.activeImageProfileId === id) {
      api.selectImageProfile(null);
    }
  }, [api]);

  const probeProfile = useCallback(async (id: string, baseUrl: string, apiKey: string) => {
    // An unusable address must never reach the network: the key would be sent to
    // whatever `fetch` resolves (the page origin for a relative value).
    if (!isUsableProviderBaseUrl(baseUrl)) {
      setProbeStates((current) => ({ ...current, [id]: { phase: 'invalid' } }));
      return;
    }
    setProbeStates((current) => ({ ...current, [id]: { phase: 'probing' } }));
    const result = await listGatewayModels({ baseUrl, apiKey }, { force: true });
    setProbeStates((current) => ({ ...current, [id]: { phase: 'done', result } }));
    if (result.status === 'ok') {
      // The served list just changed under this profile: pickers re-read the cache.
      api.notifyServedModelsChanged();
    }
    logEvent('gateway.profileProbe', {
      profileId: id,
      status: result.status,
      models: result.modelIds.length,
      latencyMs: result.latencyMs,
    });
  }, [api]);

  return {
    imageProfiles: api.imageProfiles,
    activeImageProfileId: api.activeImageProfileId,
    probeStates,
    updateImageProfile,
    addImageProfile,
    selectImageProfile,
    removeImageProfile,
    probeProfile,
  };
};
