import type { GatewayConfig } from '../src/config/env.js';

export const testConfig = (overrides: Partial<GatewayConfig> = {}): GatewayConfig => ({
  port: 0,
  gatewayKeys: ['test-key'],
  corsOrigins: ['http://localhost:3000'],
  googleProject: 'test-project',
  googleLocation: 'us-central1',
  googleCredentialsFile: null,
  googleApiVersion: 'v1',
  maxJsonBytes: 1024 * 1024,
  maxImages: 4,
  maxDecodedImageBytes: 1024 * 1024,
  upstreamTimeoutMs: 1000,
  upstreamConcurrency: 2,
  enableGeminiRoutes: true,
  enableOpenAiRoutes: true,
  enableVertexRoutes: true,
  enableVtxRoutes: true,
  enableImageRoutes: true,
  ...overrides,
});
