import type { ServerResponse } from 'node:http';

export type GatewayErrorCode =
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'CORS_DENIED'
  | 'NOT_FOUND'
  | 'NOT_IMPLEMENTED'
  | 'METHOD_NOT_ALLOWED'
  | 'VALIDATION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT'
  | 'UPSTREAM_QUOTA'
  | 'UPSTREAM_UNAVAILABLE'
  | 'IMAGE_NOT_RETURNED'
  | 'INTERNAL';

export class GatewayError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: GatewayErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

export const sendError = (res: ServerResponse, requestId: string, error: unknown): void => {
  const gatewayError = toGatewayError(error);
  sendJson(res, gatewayError.status, {
    success: false,
    requestId,
    error: {
      code: gatewayError.code,
      message: gatewayError.message,
      retryable: gatewayError.retryable || undefined,
    },
  });
};

const safeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  try {
    return String(error);
  } catch {
    return '';
  }
};

export const toGatewayError = (error: unknown): GatewayError => {
  if (error instanceof GatewayError) return error;
  const message = safeErrorMessage(error);
  if (/429|resource_exhausted|quota/i.test(message)) {
    return new GatewayError(429, 'UPSTREAM_QUOTA', 'Upstream quota exhausted.', true);
  }
  if (/timeout|aborted/i.test(message)) {
    return new GatewayError(504, 'TIMEOUT', 'Upstream request timed out.', true);
  }
  return new GatewayError(500, 'INTERNAL', 'Internal gateway error.');
};
