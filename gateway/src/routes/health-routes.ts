import type { GatewayConfig } from '../config/env.js';
import { getGoogleAuthStatus } from '../auth/google-auth.js';

export const healthResponse = () => ({
  ok: true,
  service: 'chang-store-vertex-gateway',
  uptimeSeconds: Math.round(process.uptime()),
});

export const readyResponse = (config: GatewayConfig) => ({
  ok: true,
  service: 'chang-store-vertex-gateway',
  google: getGoogleAuthStatus(config),
  limits: {
    maxJsonBytes: config.maxJsonBytes,
    maxImages: config.maxImages,
    maxDecodedImageBytes: config.maxDecodedImageBytes,
    upstreamTimeoutMs: config.upstreamTimeoutMs,
    upstreamConcurrency: config.upstreamConcurrency,
  },
  routes: {
    gemini: config.enableGeminiRoutes,
    vertex: config.enableVertexRoutes,
    vtx: config.enableVtxRoutes,
    images: config.enableImageRoutes,
  },
});
