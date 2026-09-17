import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGatewayProfileEditor } from '@/hooks/useGatewayProfileEditor';
import { listGatewayModels } from '@/services/gatewayDiscoveryService';

const saveGatewayProfiles = vi.fn();
const selectImageProfile = vi.fn();
const notifyServedModelsChanged = vi.fn();

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    gatewayProfiles: [],
    imageProfiles: [],
    activeImageProfileId: null,
    saveGatewayProfiles,
    selectImageProfile,
    notifyServedModelsChanged,
  }),
}));

vi.mock('@/services/gatewayDiscoveryService', () => ({
  listGatewayModels: vi.fn(async () => ({ status: 'ok', modelIds: ['m'], ownedBy: {}, latencyMs: 12 })),
}));

const probeGateway = vi.mocked(listGatewayModels);

describe('useGatewayProfileEditor.probeProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses an unusable base URL instead of sending the key anywhere', async () => {
    const { result } = renderHook(() => useGatewayProfileEditor());

    await act(async () => {
      await result.current.probeProfile('image-1', '   ', 'sk-secret');
    });

    expect(probeGateway).not.toHaveBeenCalled();
    expect(result.current.probeStates['image-1']).toEqual({ phase: 'invalid' });
  });

  it('probes a usable base URL and stores the result', async () => {
    const { result } = renderHook(() => useGatewayProfileEditor());

    await act(async () => {
      await result.current.probeProfile('image-2', 'https://cliproxy.monet.uno', 'sk-live');
    });

    expect(probeGateway).toHaveBeenCalledWith(
      { baseUrl: 'https://cliproxy.monet.uno', apiKey: 'sk-live' },
      { force: true },
    );
    expect(result.current.probeStates['image-2']).toMatchObject({ phase: 'done' });
    expect(notifyServedModelsChanged).toHaveBeenCalled();
  });
});
