import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { GatewayConfig } from './config/env.js';
import { requireGatewayAuth } from './auth/gateway-auth.js';
import { sendError, sendJson, GatewayError } from './http/error-response.js';
import { createRequestContext } from './http/request-context.js';
import { classifyRoute } from './http/request-classifier.js';
import { applyCors } from './lib/cors.js';
import { readJsonBody } from './lib/read-json.js';
import type { GenAiFactory } from './lib/google-genai-client.js';
import { createGoogleGenAiClient } from './lib/google-genai-client.js';
import { healthResponse, readyResponse } from './routes/health-routes.js';
import { runCustomImageRoute } from './routes/custom-image-routes.js';
import { runGeminiCompatibleRoute } from './routes/gemini-compatible-routes.js';
import { runOpenAiCompatibleRoute } from './routes/openai-compatible-routes.js';
import { runVertexCompatibleRoute } from './routes/vertex-compatible-routes.js';
import { ImageWorkloads } from './workloads/image-workloads.js';

export interface AppOptions {
  config: GatewayConfig;
  genAiFactory?: GenAiFactory;
}

export const createApp = ({ config, genAiFactory = createGoogleGenAiClient }: AppOptions) => {
  const ai = genAiFactory(config);
  const workloads = new ImageWorkloads(ai, config);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const ctx = createRequestContext(req, res);
    try {
      applyCors(req, res, config);
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', 'http://gateway.local');
      const route = classifyRoute(req.method ?? 'GET', url.pathname);

      if (url.pathname === '/healthz') {
        sendJson(res, 200, healthResponse());
        return;
      }
      if (url.pathname === '/readyz') {
        sendJson(res, 200, readyResponse(config));
        return;
      }

      requireGatewayAuth(req, config);
      const body = req.method === 'GET'
        ? {}
        : await readJsonBody<Record<string, unknown>>(req, config.maxJsonBytes);

      if (route.family === 'gemini') {
        if (!config.enableGeminiRoutes) throw new GatewayError(404, 'NOT_FOUND', 'Gemini-compatible routes are disabled.');
        sendJson(res, 200, await runGeminiCompatibleRoute(route, body, ai));
        return;
      }
      if (route.family === 'openai') {
        if (!config.enableOpenAiRoutes) throw new GatewayError(404, 'NOT_FOUND', 'OpenAI-compatible routes are disabled.');
        sendJson(res, 200, await runOpenAiCompatibleRoute(route, body, ai));
        return;
      }
      if (route.family === 'vertex' || route.family === 'vtx') {
        if ((route.family === 'vertex' && !config.enableVertexRoutes) || (route.family === 'vtx' && !config.enableVtxRoutes)) {
          throw new GatewayError(404, 'NOT_FOUND', 'Vertex-compatible routes are disabled.');
        }
        sendJson(res, 200, await runVertexCompatibleRoute(route, body, ai));
        return;
      }
      if (route.family === 'custom') {
        if (!config.enableImageRoutes) throw new GatewayError(404, 'NOT_FOUND', 'Custom image routes are disabled.');
        sendJson(res, 200, await runCustomImageRoute(route.operation, body, workloads));
        return;
      }

      throw new GatewayError(404, 'NOT_FOUND', 'Route is not implemented.');
    } catch (error) {
      if (error instanceof GatewayError && error.code === 'PAYLOAD_TOO_LARGE') {
        res.once('finish', () => req.destroy());
      }
      sendError(res, ctx.id, error);
    } finally {
      ctx.log('request.complete', { status: res.statusCode, latencyMs: Date.now() - ctx.startedAt });
    }
  });
};
