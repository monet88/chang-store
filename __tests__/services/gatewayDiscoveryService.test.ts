import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GATEWAY_MODELS_TTL_MS,
  getCachedGatewayModels,
  listGatewayModels,
} from '@/services/gatewayDiscoveryService';

const TARGET = { baseUrl: 'https://cliproxy.monet.uno', apiKey: 'sk-test-key' };

/** Measured cliproxy shape: `{object:'list', data:[{id, object, owned_by, created}]}`. */
const SERVED_LIST = {
  object: 'list',
  data: [
    { id: 'gpt-image-2.5-sunburst', object: 'model', created: 1789644202, owned_by: 'cunai-gpt-image' },
    { id: 'gemini-3.1-flash-image', object: 'model', owned_by: 'google' },
  ],
};

const jsonResponse = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const brokenJsonResponse = (status: number): Response =>
  ({ ok: true, status, json: async () => { throw new SyntaxError('Unexpected token'); } }) as unknown as Response;

describe('gatewayDiscoveryService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('never probes on import — discovery is user-triggered only', () => {
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a 200 served list to ok with ids and owners', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, SERVED_LIST));

    const result = await listGatewayModels(TARGET);

    expect(result).toMatchObject({
      status: 'ok',
      modelIds: ['gpt-image-2.5-sunburst', 'gemini-3.1-flash-image'],
      ownedBy: { 'gpt-image-2.5-sunburst': 'cunai-gpt-image', 'gemini-3.1-flash-image': 'google' },
      httpStatus: 200,
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('requests /v1/models with a bearer token and no query string', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, SERVED_LIST));

    await listGatewayModels(TARGET);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cliproxy.monet.uno/v1/models');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer sk-test-key');
    expect(init.signal).toBeDefined();
  });

  it('accepts a key entitled to nothing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { object: 'list', data: [] }));

    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'ok', modelIds: [] });
  });

  it('keeps 401 (bad key) and 403 (edge block) apart', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: 'invalid api key' } }));
    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'unauthorized', httpStatus: 401 });

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(403, 'error code: 1010'));
    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'forbidden', httpStatus: 403 });
  });

  it('maps other non-2xx, a network failure and an abort to unreachable', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { message: 'boom' } }));
    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'unreachable', httpStatus: 500 });

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'unreachable' });

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'unreachable' });
  });

  it('maps a 2xx body without a data array to malformedShape', async () => {
    for (const body of [{}, { data: 'nope' }, null]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(jsonResponse(200, body));
      await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'malformedShape', httpStatus: 200 });
    }

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(brokenJsonResponse(200));
    await expect(listGatewayModels(TARGET)).resolves.toMatchObject({ status: 'malformedShape' });
  });

  it('caches a successful probe and reuses it until the TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T10:00:00Z'));
    fetchMock.mockResolvedValue(jsonResponse(200, SERVED_LIST));

    const first = await listGatewayModels(TARGET);
    const second = await listGatewayModels(TARGET);

    expect(first.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A cached answer made no request, so it reports no latency.
    expect(second).toMatchObject({ status: 'ok', latencyMs: 0, modelIds: SERVED_LIST.data.map((m) => m.id) });
    expect(getCachedGatewayModels(TARGET.baseUrl)?.modelIds).toEqual(SERVED_LIST.data.map((m) => m.id));

    vi.setSystemTime(Date.now() + GATEWAY_MODELS_TTL_MS + 1);
    await listGatewayModels(TARGET);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bypasses the cache for an explicit refresh', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, SERVED_LIST));
    await listGatewayModels(TARGET);

    fetchMock.mockResolvedValue(jsonResponse(200, { object: 'list', data: [{ id: 'freshly-added-model' }] }));
    await expect(listGatewayModels(TARGET, { force: true })).resolves.toMatchObject({
      status: 'ok',
      modelIds: ['freshly-added-model'],
    });
    expect(getCachedGatewayModels(TARGET.baseUrl)?.modelIds).toEqual(['freshly-added-model']);
  });

  it('never caches a failure and never stores the api key', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: 'invalid api key' } }));
    await listGatewayModels(TARGET);

    expect(localStorage.getItem('gateway_models_cache_v1')).toBeNull();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(200, SERVED_LIST));
    await listGatewayModels(TARGET);

    const cached = localStorage.getItem('gateway_models_cache_v1') ?? '';
    expect(cached).toContain('gpt-image-2.5-sunburst');
    expect(cached).not.toContain('sk-test-key');
  });

  it('logs gateway.discovery with host, status, count and latency but never the key', async () => {
    const logged: string[] = [];
    localStorage.setItem('chang-store-debug', 'true');
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '));
    });
    fetchMock.mockResolvedValue(jsonResponse(200, SERVED_LIST));

    await listGatewayModels(TARGET);

    const output = logged.join('\n');
    expect(output).toContain('gateway.discovery');
    expect(output).toContain('cliproxy.monet.uno');
    expect(output).toContain('"models":2');
    expect(output).not.toContain('sk-test-key');
  });
});
