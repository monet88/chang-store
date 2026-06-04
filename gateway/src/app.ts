import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { GatewayConfig } from './config/env.js';
import { extractGatewayKey, requireGatewayAuth } from './auth/gateway-auth.js';
import { sendError, sendJson, GatewayError } from './http/error-response.js';
import { createRequestContext } from './http/request-context.js';
import { classifyRoute } from './http/request-classifier.js';
import { sendSseStream } from './http/sse-response.js';
import { applyCors } from './lib/cors.js';
import { readJsonBody } from './lib/read-json.js';
import { StreamAdmission } from './lib/stream-admission.js';
import type { GenAiFactory } from './lib/google-genai-client.js';
import { createGoogleGenAiClient } from './lib/google-genai-client.js';
import { createGenAiRuntime } from './lib/genai-runtime.js';
import { maybeHandleAdminRoute } from './routes/admin-routes.js';
import { healthResponse, readyResponse, rootResponse } from './routes/health-routes.js';
import { runCustomImageRoute } from './routes/custom-image-routes.js';
import { runGeminiCompatibleRoute } from './routes/gemini-compatible-routes.js';
import { runOpenAiCompatibleRoute, runOpenAiCompatibleStreamRoute } from './routes/openai-compatible-routes.js';
import { runOpenAiResponsesRoute, runOpenAiResponsesStreamRoute } from './routes/openai-responses-routes.js';
import { runVertexCompatibleRoute } from './routes/vertex-compatible-routes.js';
import { runCompatibilityStreamRoute } from './strategies/compatibility-strategy.js';
import { ImageWorkloads } from './workloads/image-workloads.js';

export interface AppOptions {
  config: GatewayConfig;
  genAiFactory?: GenAiFactory;
}

export const createApp = ({ config, genAiFactory = createGoogleGenAiClient }: AppOptions) => {
  const runtime = genAiFactory === createGoogleGenAiClient
    ? createGenAiRuntime(config)
    : null;
  const ai = runtime?.client ?? genAiFactory(config);
  const workloads = new ImageWorkloads(ai, config);
  const streamAdmission = new StreamAdmission(config.streamPerKeyLimit, config.streamQueueLimit);
  const streamConfig = {
    idleTimeoutMs: config.streamIdleTimeoutMs,
    maxDurationMs: config.streamMaxDurationMs,
  };

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const ctx = createRequestContext(req, res);
    try {
      const url = new URL(req.url ?? '/', 'http://gateway.local');
      if (maybeHandleAdminRoute(req, res, url, config, runtime?.getSnapshot())) {
        return;
      }

      applyCors(req, res, config);
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/') {
        sendJson(res, 200, rootResponse());
        return;
      }
      if (url.pathname === '/healthz') {
        sendJson(res, 200, healthResponse());
        return;
      }
      if (url.pathname === '/readyz') {
        sendJson(res, 200, readyResponse(config, runtime?.getSnapshot()));
        return;
      }

      const route = classifyRoute(req.method ?? 'GET', url.pathname);
      requireGatewayAuth(req, config);
      const gatewayKey = extractGatewayKey(req);
      const body = req.method === 'GET'
        ? {}
        : await readJsonBody<Record<string, unknown>>(req, config.maxJsonBytes);
      const isStreamingRequest = (
        (route.family === 'gemini' && route.stream)
        || (route.family === 'vertex' && route.stream)
        || (route.family === 'openai' && route.operation === 'chatCompletions' && body.stream === true)
        || (route.family === 'openai' && route.operation === 'responses' && body.stream === true)
      );
      const releaseStream = isStreamingRequest && gatewayKey
        ? await streamAdmission.acquire(gatewayKey)
        : null;

      try {
        if (route.family === 'gemini') {
          if (!config.enableGeminiRoutes) throw new GatewayError(404, 'NOT_FOUND', 'Gemini-compatible routes are disabled.');
          if (route.stream) {
            await sendSseStream(res, await runCompatibilityStreamRoute(route, body, ai), { includeDone: false, ...streamConfig });
            return;
          }
          sendJson(res, 200, await runGeminiCompatibleRoute(route, body, ai));
          return;
        }
        if (route.family === 'openai') {
          if (!config.enableOpenAiRoutes) throw new GatewayError(404, 'NOT_FOUND', 'OpenAI-compatible routes are disabled.');
          if (route.operation === 'chatCompletions' && body.stream === true) {
            await runOpenAiCompatibleStreamRoute(req, res, route, body, ai, streamConfig);
            return;
          }
          if (route.operation === 'responses' && body.stream === true) {
            await runOpenAiResponsesStreamRoute(req, res, route, body, ai, streamConfig);
            return;
          }
          if (route.operation === 'responses') {
            sendJson(res, 200, await runOpenAiResponsesRoute(route, body, ai));
            return;
          }
          sendJson(res, 200, await runOpenAiCompatibleRoute(route, body, ai));
          return;
        }
        if (route.family === 'vertex' || route.family === 'vtx') {
          if ((route.family === 'vertex' && !config.enableVertexRoutes) || (route.family === 'vtx' && !config.enableVtxRoutes)) {
            throw new GatewayError(404, 'NOT_FOUND', 'Vertex-compatible routes are disabled.');
          }
          if (route.stream) {
            await sendSseStream(res, await runCompatibilityStreamRoute(route, body, ai), { includeDone: false, ...streamConfig });
            return;
          }
          sendJson(res, 200, await runVertexCompatibleRoute(route, body, ai));
          return;
        }
        if (route.family === 'custom') {
          if (!config.enableImageRoutes) throw new GatewayError(404, 'NOT_FOUND', 'Custom image routes are disabled.');
          sendJson(res, 200, await runCustomImageRoute(route.operation, body, workloads));
          return;
        }
      } finally {
        releaseStream?.();
      }

      throw new GatewayError(404, 'NOT_FOUND', 'Route is not implemented.');
    } catch (error) {
      if (error instanceof GatewayError && error.code === 'PAYLOAD_TOO_LARGE') {
        res.once('finish', () => req.destroy());
      }
      if (res.headersSent || res.writableEnded) {
        if (!res.writableEnded && !res.destroyed) {
          try {
            res.end();
          } catch {
            // Socket already closed or streaming handler owned the failure.
          }
        }
        return;
      }
      sendError(res, ctx.id, error);
    } finally {
      ctx.log('request.complete', { status: res.statusCode, latencyMs: Date.now() - ctx.startedAt });
    }
  });
};
