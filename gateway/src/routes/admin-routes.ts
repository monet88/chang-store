import type { ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type { GatewayConfig } from '../config/env.js';
import { GatewayError, sendJson } from '../http/error-response.js';
import type { GenAiRuntimeSnapshotView } from '../lib/genai-runtime.js';

const extractAdminBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const buildFallbackRuntimeSnapshot = (config: GatewayConfig): GenAiRuntimeSnapshotView => ({
  mode: config.runtimeMode,
  active: {
    version: 0,
    selection: config.vertexPoolSelection,
    targetCount: config.resolvedVertexTargets.length,
    healthyTargets: config.resolvedVertexTargets.length,
    cooldownTargets: 0,
    targets: config.resolvedVertexTargets.map((target) => ({
      id: target.id,
      ...(target.label ? { label: target.label } : {}),
      project: target.project,
      location: target.location,
      weight: target.weight,
      health: {
        status: 'healthy',
        success: 0,
        failure: 0,
        recent: [],
        routeFamilyBuckets: {
          gemini: { success: 0, failure: 0 },
          vertex: { success: 0, failure: 0 },
          'openai-chat': { success: 0, failure: 0 },
          'openai-responses': { success: 0, failure: 0 },
          images: { success: 0, failure: 0 },
          unknown: { success: 0, failure: 0 },
        },
      },
    })),
  },
});

export const maybeHandleAdminRoute = (
  req: { method?: string; headers: Record<string, string | string[] | undefined> },
  res: ServerResponse,
  url: URL,
  config: GatewayConfig,
  runtimeSnapshot?: GenAiRuntimeSnapshotView,
): boolean => {
  if (!url.pathname.startsWith('/admin/')) {
    return false;
  }
  if (!config.enableAdminRoutes) {
    throw new GatewayError(404, 'NOT_FOUND', 'Admin routes are disabled.');
  }

  const token = extractAdminBearerToken(
    typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
  );
  if (!token || token !== config.adminToken) {
    throw new GatewayError(401, 'AUTH_INVALID', 'Admin authorization failed.');
  }

  if (req.method === 'GET' && url.pathname === '/admin/api/health/pool') {
    sendJson(res, 200, {
      ok: true,
      service: 'chang-store-vertex-gateway',
      runtime: runtimeSnapshot ?? buildFallbackRuntimeSnapshot(config),
    });
    return true;
  }

  throw new GatewayError(404, 'NOT_FOUND', 'Admin route is not implemented.');
};
