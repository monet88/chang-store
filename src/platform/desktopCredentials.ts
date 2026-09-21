import {
  DESKTOP_CREDENTIAL_SENTINEL,
  getDesktopGatewayApi,
  isStoredDesktopCredential,
} from './desktopGateway';

const CPA_GATEWAY_API_KEY_KEY = 'cpa_gateway_api_key';
const CPA_GATEWAY_URL_KEY = 'cpa_gateway_url';
const LEGACY_GATEWAY_API_KEY_KEY = 'vertex_proxy_api_key';
const LEGACY_GATEWAY_URL_KEY = 'vertex_proxy_url';
const GATEWAY_PROFILES_KEY = 'gateway_profiles_v1';

const reportCredentialFailure = (action: string, error: unknown): void => {
  console.error(`[DesktopCredentials] ${action} failed`, error);
};

export const storeDesktopCredential = async (
  credentialRef: string,
  baseUrl: string,
  apiKey: string,
): Promise<boolean> => {
  const desktopGateway = getDesktopGatewayApi();
  const key = apiKey.trim();
  if (!desktopGateway || !key || isStoredDesktopCredential(key)) {
    return false;
  }

  try {
    const result = await desktopGateway.storeCredential({ credentialRef, baseUrl, apiKey: key });
    if (result.ok === false) {
      reportCredentialFailure('store', result.error);
      return false;
    }
    return true;
  } catch (error) {
    reportCredentialFailure('store', error);
    return false;
  }
};

export const removeDesktopCredential = (credentialRef: string): void => {
  const desktopGateway = getDesktopGatewayApi();
  if (!desktopGateway) return;
  void desktopGateway.removeCredential({ credentialRef })
    .then((result) => {
      if (result.ok === false) reportCredentialFailure('remove', result.error);
    })
    .catch((error) => reportCredentialFailure('remove', error));
};

export const clearDesktopCredentials = async (): Promise<void> => {
  const desktopGateway = getDesktopGatewayApi();
  if (!desktopGateway) return;
  try {
    const result = await desktopGateway.clearCredentials();
    if (result.ok === false) reportCredentialFailure('clear', result.error);
  } catch (error) {
    reportCredentialFailure('clear', error);
  }
};

export const migrateDesktopGatewayCredentials = async (): Promise<void> => {
  const desktopGateway = getDesktopGatewayApi();
  if (!desktopGateway || typeof localStorage === 'undefined') return;

  let cpaKey = localStorage.getItem(CPA_GATEWAY_API_KEY_KEY)?.trim() || '';
  let cpaUrl = localStorage.getItem(CPA_GATEWAY_URL_KEY)?.trim() || 'https://cliproxy.monet.uno';
  const legacyKey = localStorage.getItem(LEGACY_GATEWAY_API_KEY_KEY)?.trim() || '';
  const legacyUrl = localStorage.getItem(LEGACY_GATEWAY_URL_KEY)?.trim() || cpaUrl;

  if (!cpaKey && legacyKey && await storeDesktopCredential('cpa-default', legacyUrl, legacyKey)) {
    cpaKey = DESKTOP_CREDENTIAL_SENTINEL;
    cpaUrl = legacyUrl;
    localStorage.setItem(CPA_GATEWAY_URL_KEY, legacyUrl);
    localStorage.setItem(CPA_GATEWAY_API_KEY_KEY, DESKTOP_CREDENTIAL_SENTINEL);
    localStorage.removeItem(LEGACY_GATEWAY_URL_KEY);
    localStorage.removeItem(LEGACY_GATEWAY_API_KEY_KEY);
  }

  const hasAuthoritativeCpaKey = cpaKey.length > 0;
  let cpaStoredSecurely = isStoredDesktopCredential(cpaKey);
  if (cpaKey && !isStoredDesktopCredential(cpaKey)) {
    if (await storeDesktopCredential('cpa-default', cpaUrl, cpaKey)) {
      localStorage.setItem(CPA_GATEWAY_API_KEY_KEY, DESKTOP_CREDENTIAL_SENTINEL);
      cpaStoredSecurely = true;
    }
  }

  const rawProfiles = localStorage.getItem(GATEWAY_PROFILES_KEY);
  if (!rawProfiles) return;

  try {
    const parsed: unknown = JSON.parse(rawProfiles);
    if (!Array.isArray(parsed)) return;

    let changed = false;
    const migrated = await Promise.all(parsed.map(async (profile) => {
      if (!profile || typeof profile !== 'object' || !('id' in profile) || !('apiKey' in profile)) return profile;
      if (typeof profile.id !== 'string' || typeof profile.apiKey !== 'string') return profile;
      const apiKey = profile.apiKey.trim();
      if (!apiKey || isStoredDesktopCredential(apiKey)) return profile;

      // CPA settings are the authoritative Gemini credential. The profile copy
      // can lag behind it, so never let that duplicate overwrite the vault.
      if (profile.id === 'cpa-default' && hasAuthoritativeCpaKey) {
        if (!cpaStoredSecurely) return profile;
        changed = true;
        return { ...profile, apiKey: DESKTOP_CREDENTIAL_SENTINEL };
      }

      if (!('baseUrl' in profile) || typeof profile.baseUrl !== 'string' || !profile.baseUrl.trim()) return profile;
      if (!await storeDesktopCredential(profile.id, profile.baseUrl, apiKey)) return profile;
      changed = true;
      return { ...profile, apiKey: DESKTOP_CREDENTIAL_SENTINEL };
    }));

    if (changed) localStorage.setItem(GATEWAY_PROFILES_KEY, JSON.stringify(migrated));
  } catch (error) {
    reportCredentialFailure('migrate', error);
  }
};
