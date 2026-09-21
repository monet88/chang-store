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

const credentialOperations = new Map<string, Promise<void>>();

const reportCredentialFailure = (action: string, error: unknown): void => {
  console.error(`[DesktopCredentials] ${action} failed`, error);
};

const runCredentialOperation = async <T>(credentialRef: string, operation: () => Promise<T>): Promise<T> => {
  const previous = credentialOperations.get(credentialRef) ?? Promise.resolve();
  const execution = previous.catch(() => undefined).then(operation);
  const tail = execution.then(() => undefined, () => undefined);
  credentialOperations.set(credentialRef, tail);
  try {
    return await execution;
  } finally {
    if (credentialOperations.get(credentialRef) === tail) {
      credentialOperations.delete(credentialRef);
    }
  }
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
    const result = await runCredentialOperation(
      credentialRef,
      () => desktopGateway.storeCredential({ credentialRef, baseUrl, apiKey: key }),
    );
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

export const removeDesktopCredential = async (credentialRef: string): Promise<boolean> => {
  const desktopGateway = getDesktopGatewayApi();
  if (!desktopGateway) return true;
  try {
    const result = await runCredentialOperation(
      credentialRef,
      () => desktopGateway.removeCredential({ credentialRef }),
    );
    if (result.ok === false) {
      reportCredentialFailure('remove', result.error);
      return false;
    }
    return true;
  } catch (error) {
    reportCredentialFailure('remove', error);
    return false;
  }
};

export const clearDesktopCredentials = async (): Promise<boolean> => {
  const desktopGateway = getDesktopGatewayApi();
  if (!desktopGateway) return true;
  try {
    while (credentialOperations.size > 0) {
      await Promise.all([...credentialOperations.values()]);
    }
    const result = await desktopGateway.clearCredentials();
    if (result.ok === false) {
      reportCredentialFailure('clear', result.error);
      return false;
    }
    return true;
  } catch (error) {
    reportCredentialFailure('clear', error);
    return false;
  }
};

export const migrateDesktopGatewayCredentials = async (): Promise<void> => {
  const desktopGateway = getDesktopGatewayApi();
  if (!desktopGateway || typeof localStorage === 'undefined') return;

  try {
    let cpaKey = localStorage.getItem(CPA_GATEWAY_API_KEY_KEY)?.trim() || '';
    const storedCpaUrl = localStorage.getItem(CPA_GATEWAY_URL_KEY)?.trim() || '';
    const legacyKey = localStorage.getItem(LEGACY_GATEWAY_API_KEY_KEY)?.trim() || '';
    const legacyUrl = localStorage.getItem(LEGACY_GATEWAY_URL_KEY)?.trim() || '';
    let cpaUrl = storedCpaUrl || legacyUrl || 'https://cliproxy.monet.uno';

    if (!cpaKey && legacyKey && await storeDesktopCredential('cpa-default', cpaUrl, legacyKey)) {
      cpaKey = DESKTOP_CREDENTIAL_SENTINEL;
      localStorage.setItem(CPA_GATEWAY_URL_KEY, cpaUrl);
      localStorage.setItem(CPA_GATEWAY_API_KEY_KEY, DESKTOP_CREDENTIAL_SENTINEL);
      localStorage.removeItem(LEGACY_GATEWAY_URL_KEY);
      localStorage.removeItem(LEGACY_GATEWAY_API_KEY_KEY);
    }

    const hasAuthoritativeCpaKey = cpaKey.length > 0;
    let cpaStoredSecurely = isStoredDesktopCredential(cpaKey);
    if (cpaKey && !isStoredDesktopCredential(cpaKey)) {
      if (await storeDesktopCredential('cpa-default', cpaUrl, cpaKey)) {
        localStorage.setItem(CPA_GATEWAY_URL_KEY, cpaUrl);
        localStorage.setItem(CPA_GATEWAY_API_KEY_KEY, DESKTOP_CREDENTIAL_SENTINEL);
        cpaStoredSecurely = true;
      }
    }

    const rawProfiles = localStorage.getItem(GATEWAY_PROFILES_KEY);
    if (!rawProfiles) return;

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
      if (profile.id === 'cpa-default') {
        cpaUrl = profile.baseUrl;
        localStorage.setItem(CPA_GATEWAY_URL_KEY, cpaUrl);
        localStorage.setItem(CPA_GATEWAY_API_KEY_KEY, DESKTOP_CREDENTIAL_SENTINEL);
      }
      changed = true;
      return { ...profile, apiKey: DESKTOP_CREDENTIAL_SENTINEL };
    }));

    if (changed) localStorage.setItem(GATEWAY_PROFILES_KEY, JSON.stringify(migrated));
  } catch (error) {
    reportCredentialFailure('migrate', error);
  }
};
