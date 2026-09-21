import { logEvent } from './debugService';
import { safeFetch } from './providers/shared/safeFetch';
import {
  DESKTOP_CREDENTIAL_SENTINEL,
  DesktopGatewayError,
  getDesktopGatewayApi,
  transientDesktopApiKey,
  unwrapDesktopBridgeResult,
} from '../platform/desktopGateway';
import { gatewayHostOf } from './providers/shared/imageDriverPolicy';

/**
 * Gateway model discovery (US-006 Lớp 2a): `GET {baseUrl}/v1/models` answers the
 * active key's entitlement (measured: cliproxy 32 ids in 0.23 s, xompet 1 id in
 * 0.36 s, CORS open, `/v1/models/{id}` 404 ⇒ list-only, never per model).
 *
 * Discovery decides *what is selectable*; capabilities stay in the catalog — the
 * endpoint carries no capability metadata. It is user-triggered only: nothing here
 * runs on import or on app boot, so no key-bearing request is ever unsolicited.
 */
export type GatewayProbeStatus = 'ok' | 'unauthorized' | 'forbidden' | 'unreachable' | 'malformedShape';

export interface GatewayProbeResult {
  status: GatewayProbeStatus;
  modelIds: string[];
  ownedBy: Record<string, string>;
  /** 0 when the answer came from the cache — no request was made. */
  latencyMs: number;
  httpStatus?: number;
}

/** Minimal shape of a gateway to probe; `GatewayProfile` (phase 4) is structurally compatible. */
export interface GatewayProbeTarget {
  baseUrl: string;
  apiKey: string;
  credentialRef?: string;
}

interface GatewayModelsCacheEntry {
  baseUrl: string;
  /** Non-reversible key identity: two keys on one host must never share a served list. */
  keyId: string;
  fetchedAt: number;
  modelIds: string[];
  ownedBy: Record<string, string>;
}

const CACHE_STORAGE_KEY = 'gateway_models_cache_v1';
/** Discovery is user-triggered, so a cached list is reused for this long. */
export const GATEWAY_MODELS_TTL_MS = 10 * 60 * 1000;
/** Measured budget is 0.23–0.36 s; this is the abort ceiling. */
export const GATEWAY_PROBE_TIMEOUT_MS = 10_000;

/**
 * `https://host`, `https://host/` and `https://host/v1` address the same API root: the
 * image lanes document the versioned form (`…/v1/images/generations`), so the probe must
 * accept it instead of asking for `/v1/v1/models`.
 */
const toApiRoot = (baseUrl: string): string => baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

/** FNV-1a over the key: enough to tell two keys apart, useless for recovering one. */
const keyIdentity = (apiKey: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < apiKey.length; index += 1) {
    hash = Math.imul(hash ^ apiKey.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16);
};

const readCache = (): GatewayModelsCacheEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCacheEntry = (entry: GatewayModelsCacheEntry): void => {
  try {
    const entries = readCache().filter(
      (cached) => cached?.baseUrl !== entry.baseUrl || cached?.keyId !== entry.keyId,
    );
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify([...entries, entry]));
  } catch {
    // A blocked or full localStorage must never break discovery.
  }
};

export const invalidateCachedGatewayModels = (credentialRef: string): void => {
  try {
    const keyId = `ref:${credentialRef}`;
    const remaining = readCache().filter((entry) => entry?.keyId !== keyId);
    if (remaining.length === 0) {
      localStorage.removeItem(CACHE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // Cache invalidation is best-effort; a blocked localStorage already behaves as a cache miss.
  }
};

/** Cached `ok` probe for this (host, key) pair, still inside the TTL — never keyed by host alone. */
const cacheKeyIdentity = (apiKey: string, credentialRef?: string): string =>
  credentialRef && apiKey === DESKTOP_CREDENTIAL_SENTINEL
    ? `ref:${credentialRef}`
    : keyIdentity(apiKey);

export function getCachedGatewayModels(
  baseUrl: string,
  apiKey: string,
  now: number = Date.now(),
  credentialRef?: string,
): GatewayProbeResult | null {
  const entry = readCache().find(
    (cached) => cached?.baseUrl === toApiRoot(baseUrl) && cached?.keyId === cacheKeyIdentity(apiKey, credentialRef),
  );
  if (!entry || now - entry.fetchedAt > GATEWAY_MODELS_TTL_MS) {
    return null;
  }
  return { status: 'ok', modelIds: entry.modelIds, ownedBy: entry.ownedBy, latencyMs: 0 };
}

/** `{object, data:[{id, owned_by}]}` → ids + owners; `null` when `data[]` is absent. */
const parseListBody = (body: unknown): { modelIds: string[]; ownedBy: Record<string, string> } | null => {
  if (typeof body !== 'object' || body === null || !('data' in body) || !Array.isArray(body.data)) {
    return null;
  }

  const modelIds: string[] = [];
  const ownedBy: Record<string, string> = {};
  for (const item of body.data) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const id = 'id' in item && typeof item.id === 'string' ? item.id : '';
    if (!id) {
      continue;
    }
    modelIds.push(id);
    const owner = 'owned_by' in item && typeof item.owned_by === 'string' ? item.owned_by : '';
    if (owner) {
      ownedBy[id] = owner;
    }
  }
  return { modelIds, ownedBy };
};

const empty = (status: GatewayProbeStatus, latencyMs: number, httpStatus?: number): GatewayProbeResult => ({
  status,
  modelIds: [],
  ownedBy: {},
  latencyMs,
  ...(httpStatus === undefined ? {} : { httpStatus }),
});

const probe = async (target: GatewayProbeTarget): Promise<GatewayProbeResult> => {
  const startedAt = Date.now();
  // safeFetch turns a network failure into a typed error and preserves aborts; both
  // mean the same thing here ("unreachable"), so either one yields null.
  const response = await safeFetch(`${target.baseUrl}/v1/models`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${target.apiKey}` },
    signal: AbortSignal.timeout(GATEWAY_PROBE_TIMEOUT_MS),
  }).catch(() => null);

  const latencyMs = Date.now() - startedAt;

  if (!response) {
    return empty('unreachable', latencyMs);
  }
  // 403 is an edge/gateway block (measured: a non-browser User-Agent), never a bad key.
  if (response.status === 401) {
    return empty('unauthorized', latencyMs, 401);
  }
  if (response.status === 403) {
    return empty('forbidden', latencyMs, 403);
  }
  if (!response.ok) {
    return empty('unreachable', latencyMs, response.status);
  }

  const parsed = parseListBody(await response.json().catch(() => null));
  if (!parsed) {
    return empty('malformedShape', latencyMs, response.status);
  }

  return { status: 'ok', ...parsed, latencyMs, httpStatus: response.status };
};

/**
 * List the models this key may use on this gateway. A cached `ok` answer inside the
 * TTL is returned without a request; `force` is the operator's explicit **Kiểm tra**.
 */
export async function listGatewayModels(
  target: GatewayProbeTarget,
  options: { force?: boolean } = {},
): Promise<GatewayProbeResult> {
  const baseUrl = toApiRoot(target.baseUrl);

  if (!options.force) {
    const cached = getCachedGatewayModels(baseUrl, target.apiKey, Date.now(), target.credentialRef);
    if (cached) {
      return cached;
    }
  }

  const desktopGateway = getDesktopGatewayApi();
  let result: GatewayProbeResult;
  if (desktopGateway && target.credentialRef) {
    const startedAt = Date.now();
    try {
      result = unwrapDesktopBridgeResult(await desktopGateway.listGatewayModels({
        credentialRef: target.credentialRef,
        // Main binds credentials to the configured provider URL. Keep the
        // profile URL intact here; main normalizes /v1 only for the models path.
        baseUrl: target.baseUrl,
        apiKey: transientDesktopApiKey(target.apiKey),
      }));
    } catch (error) {
      const status = error instanceof DesktopGatewayError ? error.status : undefined;
      result = empty(
        status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'unreachable',
        Date.now() - startedAt,
        status,
      );
    }
  } else {
    result = await probe({ ...target, baseUrl });
  }

  if (result.status === 'ok') {
    writeCacheEntry({
      baseUrl,
      keyId: cacheKeyIdentity(target.apiKey, target.credentialRef),
      fetchedAt: Date.now(),
      modelIds: result.modelIds,
      ownedBy: result.ownedBy,
    });
  }

  logEvent('gateway.discovery', {
    host: gatewayHostOf(baseUrl) ?? baseUrl,
    status: result.status,
    models: result.modelIds.length,
    latencyMs: result.latencyMs,
  });

  return result;
}
