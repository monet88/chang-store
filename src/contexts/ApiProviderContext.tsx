import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useMemo, useCallback } from 'react';
import { ImageEditModel, ImageGenerateModel, TextGenerateModel } from '../types';
import { getDefaultModelForSelectionType, isKnownModelForSelectionType, ModelSelectionType } from '../config/modelRegistry';
import { isImageDriverId, type GatewayProfile } from '../config/gatewayProfiles';
import { useGatewayProfiles } from '../hooks/useGatewayProfiles';
import { configureGeminiClient } from '../services/apiClient';
import { invalidateCachedGatewayModels } from '../services/gatewayDiscoveryService';
import { useToast } from '../components/Toast';
import { validateProviderBaseUrl } from '../utils/provider-url-validation';
import { useLanguage } from './LanguageContext';
import { storeDesktopCredential } from '../platform/desktopCredentials';
import {
  DESKTOP_CREDENTIAL_SENTINEL,
  getDesktopGatewayApi,
  isStoredDesktopCredential,
} from '../platform/desktopGateway';


/** Gateway settings. The gateway is always the Gemini route; only its address
 *  and key are configurable. */
export interface CpaGatewaySettings {
  url: string;
  apiKey: string;
}

interface ApiContextType {
  imageEditModel: ImageEditModel;
  setImageEditModel: (model: ImageEditModel) => void;
  imageGenerateModel: ImageGenerateModel;
  setImageGenerateModel: (model: ImageGenerateModel) => void;
  textGenerateModel: TextGenerateModel;
  setTextGenerateModel: (model: TextGenerateModel) => void;
  cpaGatewaySettings: CpaGatewaySettings;
  setCpaGatewaySettings: (settings: CpaGatewaySettings) => Promise<boolean>;
  /** The gateway profiles: one Gemini-lane profile, any number of image-lane ones. */
  gatewayProfiles: GatewayProfile[];
  geminiProfile: GatewayProfile;
  imageProfiles: GatewayProfile[];
  activeImageProfileId: string | null;
  /** Bumped when discovery wrote the served-model cache, so pickers re-read it. */
  servedModelsVersion: number;
  saveGatewayProfiles: (profiles: GatewayProfile[]) => void;
  selectImageProfile: (id: string | null) => void;
  /** The image-lane profile a studio driver uses right now, or `undefined` when none is set. */
  imageProfileForDriver: (driver: string) => GatewayProfile | undefined;
  notifyServedModelsChanged: () => void;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);
const IMAGE_EDIT_MODEL_KEY = 'image_edit_model';
const IMAGE_GENERATE_MODEL_KEY = 'image_generate_model';
const TEXT_GENERATE_MODEL_KEY = 'text_generate_model';
const CPA_GATEWAY_URL_KEY = 'cpa_gateway_url';
const CPA_GATEWAY_API_KEY_KEY = 'cpa_gateway_api_key';
const DEFAULT_CPA_GATEWAY_URL = 'https://cliproxy.monet.uno';


const safeStorage = {
  getItem: (key: string) => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('[safeStorage] Failed to save:', key, error);
    }
  },
  removeItem: (key: string) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[safeStorage] Failed to remove:', key, error);
    }
  },
};

const resolveStoredModel = (selectionType: ModelSelectionType, storedValue: string | null): string => {
  if (storedValue && isKnownModelForSelectionType(selectionType, storedValue)) {
    return storedValue;
  }

  return getDefaultModelForSelectionType(selectionType);
};

/** Gateway key from the build environment, used when nothing is stored. */
const readCpaGatewayEnvApiKey = (): string => (process.env.CLIPROXY_API_KEY || '').trim();

const LEGACY_GATEWAY_URL_KEY = 'vertex_proxy_url';
const LEGACY_GATEWAY_API_KEY_KEY = 'vertex_proxy_api_key';

/** Reads a gateway setting, migrating the pre-CPA-rename storage key on first use. */
const readGatewayValue = (key: string, legacyKey: string): string => {
  const current = safeStorage.getItem(key)?.trim() || '';
  if (current) return current;

  const legacy = safeStorage.getItem(legacyKey)?.trim() || '';
  if (legacy && !getDesktopGatewayApi()) {
    safeStorage.setItem(key, legacy);
    safeStorage.removeItem(legacyKey);
  }
  return legacy;
};

const resolveStoredCpaGatewaySettings = (): { invalidRestore: boolean; settings: CpaGatewaySettings } => {
  const storedUrl = readGatewayValue(CPA_GATEWAY_URL_KEY, LEGACY_GATEWAY_URL_KEY);
  const storedApiKey = readGatewayValue(CPA_GATEWAY_API_KEY_KEY, LEGACY_GATEWAY_API_KEY_KEY);
  const validation = validateProviderBaseUrl(storedUrl || DEFAULT_CPA_GATEWAY_URL);

  return {
    // A stored URL that no longer validates falls back to the default gateway.
    invalidRestore: storedUrl.length > 0 && validation.status === 'invalid',
    settings: {
      url: validation.status === 'invalid' ? DEFAULT_CPA_GATEWAY_URL : validation.url,
      apiKey: storedApiKey || readCpaGatewayEnvApiKey(),
    },
  };
};

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const restoredCpaGatewayRef = useRef(resolveStoredCpaGatewaySettings());
  const [cpaGatewaySettings, setCpaGatewaySettingsState] = useState<CpaGatewaySettings>(
    restoredCpaGatewayRef.current.settings,
  );

  const profiles = useGatewayProfiles({
    gemini: cpaGatewaySettings,
    storage: safeStorage,
  });

  // The UI passes driver ids as plain strings, so the guard lives at this boundary.
  const imageProfileForDriver = useCallback(
    (driver: string) => (isImageDriverId(driver) ? profiles.imageProfileForDriver(driver) : undefined),
    [profiles],
  );

  const [imageEditModel, setImageEditModelState] = useState<ImageEditModel>(() => {
    const saved = safeStorage.getItem(IMAGE_EDIT_MODEL_KEY);
    return resolveStoredModel('imageEdit', saved);
  });
  const [imageGenerateModel, setImageGenerateModelState] = useState<ImageGenerateModel>(() => {
    const saved = safeStorage.getItem(IMAGE_GENERATE_MODEL_KEY);
    return resolveStoredModel('imageGenerate', saved);
  });
  const [textGenerateModel, setTextGenerateModelState] = useState<TextGenerateModel>(() => {
    const saved = safeStorage.getItem(TEXT_GENERATE_MODEL_KEY);
    return resolveStoredModel('textGenerate', saved);
  });

  useEffect(() => {
    if (!restoredCpaGatewayRef.current.invalidRestore) {
      return;
    }

    safeStorage.setItem(CPA_GATEWAY_URL_KEY, restoredCpaGatewayRef.current.settings.url);

    restoredCpaGatewayRef.current.invalidRestore = false;
    showToast(t('settingsModal.notifications.cpaGatewayRestoreInvalid'));
  }, [showToast, t]);

  useEffect(() => {
    const storedImageEditModel = safeStorage.getItem(IMAGE_EDIT_MODEL_KEY);
    if (storedImageEditModel && !isKnownModelForSelectionType('imageEdit', storedImageEditModel)) {
      safeStorage.setItem(IMAGE_EDIT_MODEL_KEY, imageEditModel);
    }

    const storedImageGenerateModel = safeStorage.getItem(IMAGE_GENERATE_MODEL_KEY);
    if (storedImageGenerateModel && !isKnownModelForSelectionType('imageGenerate', storedImageGenerateModel)) {
      safeStorage.setItem(IMAGE_GENERATE_MODEL_KEY, imageGenerateModel);
    }

    const storedTextGenerateModel = safeStorage.getItem(TEXT_GENERATE_MODEL_KEY);
    if (storedTextGenerateModel && !isKnownModelForSelectionType('textGenerate', storedTextGenerateModel)) {
      safeStorage.setItem(TEXT_GENERATE_MODEL_KEY, textGenerateModel);
    }
  }, [imageEditModel, imageGenerateModel, textGenerateModel]);

  // The gateway is the only Gemini route, so it is always configured; a missing
  // key surfaces as an explicit client error instead of a silent fallback.
  useEffect(() => {
    const validation = validateProviderBaseUrl(cpaGatewaySettings.url);

    configureGeminiClient({
      apiKey: cpaGatewaySettings.apiKey.trim(),
      baseUrl: validation.status === 'invalid' ? DEFAULT_CPA_GATEWAY_URL : validation.url,
      credentialRef: profiles.geminiProfile.id,
    });
  }, [cpaGatewaySettings, profiles.geminiProfile.id]);

  const setCpaGatewaySettings = useCallback(async (settings: CpaGatewaySettings): Promise<boolean> => {
    const desktopGateway = getDesktopGatewayApi();
    const apiKey = settings.apiKey.trim();

    if (!desktopGateway || !apiKey || isStoredDesktopCredential(apiKey)) {
      setCpaGatewaySettingsState(settings);
      safeStorage.setItem(CPA_GATEWAY_URL_KEY, settings.url);
      safeStorage.setItem(CPA_GATEWAY_API_KEY_KEY, settings.apiKey);
      return true;
    }

    // Desktop commits the visible settings only after main confirms the raw key
    // reached encrypted storage. A failed store leaves the previous working
    // settings intact and never writes the raw key to renderer storage.
    const stored = await storeDesktopCredential(profiles.geminiProfile.id, settings.url, apiKey);
    if (!stored) return false;

    invalidateCachedGatewayModels(profiles.geminiProfile.id);
    const securedSettings = { ...settings, apiKey: DESKTOP_CREDENTIAL_SENTINEL };
    setCpaGatewaySettingsState(securedSettings);
    safeStorage.setItem(CPA_GATEWAY_URL_KEY, settings.url);
    safeStorage.setItem(CPA_GATEWAY_API_KEY_KEY, DESKTOP_CREDENTIAL_SENTINEL);
    return true;
  }, [profiles.geminiProfile.id]);

  const setImageEditModel = useCallback((model: ImageEditModel) => {
    setImageEditModelState(model);
    safeStorage.setItem(IMAGE_EDIT_MODEL_KEY, model);
  }, []);

  const setImageGenerateModel = useCallback((model: ImageGenerateModel) => {
    setImageGenerateModelState(model);
    safeStorage.setItem(IMAGE_GENERATE_MODEL_KEY, model);
  }, []);

  const setTextGenerateModel = useCallback((model: TextGenerateModel) => {
    setTextGenerateModelState(model);
    safeStorage.setItem(TEXT_GENERATE_MODEL_KEY, model);
  }, []);

  // ⚡ Bolt: Wrap Context Provider value in useMemo to preserve object identity
  // and prevent massive cascading re-renders across all consumer components.
  const contextValue = useMemo(() => ({
      imageEditModel,
      setImageEditModel,
      imageGenerateModel,
      setImageGenerateModel,
      textGenerateModel,
      setTextGenerateModel,
      cpaGatewaySettings,
      setCpaGatewaySettings,
      gatewayProfiles: profiles.gatewayProfiles,
      geminiProfile: profiles.geminiProfile,
      imageProfiles: profiles.imageProfiles,
      activeImageProfileId: profiles.activeImageProfileId,
      servedModelsVersion: profiles.servedModelsVersion,
      saveGatewayProfiles: profiles.saveProfiles,
      selectImageProfile: profiles.selectImageProfile,
      imageProfileForDriver,
      notifyServedModelsChanged: profiles.notifyServedModelsChanged,
  }), [imageEditModel, setImageEditModel, imageGenerateModel, setImageGenerateModel, textGenerateModel, setTextGenerateModel, cpaGatewaySettings, setCpaGatewaySettings, profiles, imageProfileForDriver]);

  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
