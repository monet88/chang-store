export type GenAiRouteFamily =
  | 'gemini'
  | 'vertex'
  | 'openai-chat'
  | 'openai-responses'
  | 'images'
  | 'unknown';

export interface GenAiStreamGuardMetadata {
  idleTimeoutMs: number;
  maxDurationMs: number;
}

export interface GenAiRequestMetadata {
  routeFamily?: GenAiRouteFamily;
  streamGuard?: GenAiStreamGuardMetadata;
}

const ROUTE_FAMILY_KEY = '__gatewayRouteFamily';
const STREAM_GUARD_KEY = '__gatewayStreamGuard';

export const withGenAiRequestMetadata = (
  request: Record<string, unknown>,
  metadata: GenAiRequestMetadata,
): Record<string, unknown> => ({
  ...request,
  ...(metadata.routeFamily ? { [ROUTE_FAMILY_KEY]: metadata.routeFamily } : {}),
  ...(metadata.streamGuard ? { [STREAM_GUARD_KEY]: metadata.streamGuard } : {}),
});

export const extractGenAiRequestMetadata = (
  request: Record<string, unknown>,
): {
  metadata: { routeFamily: GenAiRouteFamily; streamGuard?: GenAiStreamGuardMetadata };
  request: Record<string, unknown>;
} => {
  const {
    [ROUTE_FAMILY_KEY]: rawRouteFamily,
    [STREAM_GUARD_KEY]: rawStreamGuard,
    ...cleanRequest
  } = request;
  return {
    metadata: {
      routeFamily: isRouteFamily(rawRouteFamily) ? rawRouteFamily : 'unknown',
      ...(isStreamGuard(rawStreamGuard) ? { streamGuard: rawStreamGuard } : {}),
    },
    request: cleanRequest,
  };
};

const isRouteFamily = (value: unknown): value is GenAiRouteFamily =>
  value === 'gemini'
  || value === 'vertex'
  || value === 'openai-chat'
  || value === 'openai-responses'
  || value === 'images'
  || value === 'unknown';

const isStreamGuard = (value: unknown): value is GenAiStreamGuardMetadata =>
  Boolean(value)
  && typeof value === 'object'
  && typeof (value as GenAiStreamGuardMetadata).idleTimeoutMs === 'number'
  && typeof (value as GenAiStreamGuardMetadata).maxDurationMs === 'number';
