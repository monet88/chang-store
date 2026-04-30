import { randomUUID } from 'node:crypto';

export const TRACE_HEADER = 'X-Trace-Id';

export function extractTraceId(request: Request): string {
  return request.headers.get(TRACE_HEADER)?.trim() || generateTraceId();
}

export function generateTraceId(): string {
  return randomUUID();
}
