/**
 * Models the active profile served, read from the discovery cache (US-006 Lớp 2c).
 *
 * Discovery is user-triggered, so this reads the cache instead of fetching: the served list
 * is whatever the last successful "Kiểm tra" wrote, and `version` (bumped by that probe)
 * is what re-runs this hook.
 */
import { useMemo } from 'react';
import { getCachedGatewayModels } from '../services/gatewayDiscoveryService';

export const useServedModels = (baseUrl: string | undefined, version: number): string[] | undefined =>
  useMemo(
    () => (baseUrl ? getCachedGatewayModels(baseUrl)?.modelIds : undefined),
    [baseUrl, version],
  );
