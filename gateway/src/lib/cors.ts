import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GatewayConfig } from '../config/env.js';
import { GatewayError } from '../http/error-response.js';

export const applyCors = (req: IncomingMessage, res: ServerResponse, config: GatewayConfig): void => {
  const origin = req.headers.origin;
  if (!origin) return;
  if (!config.corsOrigins.includes(origin) && !config.corsOrigins.includes('*')) {
    throw new GatewayError(403, 'CORS_DENIED', 'Origin is not allowed.');
  }
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  res.setHeader(
    'access-control-allow-headers',
    'authorization, content-type, x-api-key, x-goog-api-key, x-goog-api-client, x-request-id',
  );
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
};
