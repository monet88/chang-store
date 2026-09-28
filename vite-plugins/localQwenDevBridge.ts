import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  localQwenManager,
  parseLocalQwenFolder,
  parseLocalQwenGenerateParams,
  parseLocalQwenUpscaleParams,
  type LocalQwenManager,
} from '../electron/localQwenManager';
import { bridge } from '../electron/bridgeResult';
import type { DesktopBridgeResult } from '../src/platform/desktopGateway';

export const LOCAL_QWEN_DEV_PATH = '/api/local-qwen';

const MAX_BODY_BYTES = 64 * 1024 * 1024;

const readBody = (request: IncomingMessage): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const chunks: Buffer[] = [];
  let size = 0;
  request.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      reject(new Error('Local Qwen dev bridge: request body too large.'));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  request.on('error', reject);
  return promise;
};

/**
 * One action per call, the same set the Electron IPC channels expose, so the
 * dev server and the packaged app drive the identical manager: same parsers,
 * same `DesktopBridgeResult` envelope.
 */
export const handleLocalQwenDevRequest = async (
  manager: LocalQwenManager,
  action: string,
  payload: unknown,
): Promise<DesktopBridgeResult<unknown>> => {
  switch (action) {
    case 'getStatus':
      return bridge(() => manager.getStatus(parseLocalQwenFolder(payload)));
    case 'startServer':
      return bridge(() => manager.startServer(parseLocalQwenFolder(payload)));
    case 'stopServer':
      return bridge(() => manager.stopServer());
    case 'generateImage':
      return bridge(() => manager.generateImage(parseLocalQwenGenerateParams(payload)));
    case 'cancelJob':
      return bridge(() => manager.cancelJob());
    case 'upscaleImage':
      return bridge(() => manager.upscaleImage(parseLocalQwenUpscaleParams(payload)));
    case 'verifyFolder':
      return bridge(() => manager.checkFolder(parseLocalQwenFolder(payload) || ''));
    default:
      return { ok: false, error: { message: `Unknown Local Qwen action: ${action}` } };
  }
};

/**
 * Dev-only HTTP transport for Local Qwen so the web build can drive the local
 * ComfyUI instance (browser testing, phone testing on the tailnet). The
 * packaged desktop app never loads this: there the preload IPC bridge owns the
 * same manager, and the dev server does not exist to host it.
 *
 * This endpoint can start ComfyUI and spend the machine's GPU for whoever can
 * reach the dev server, so it exists only under `vite dev`.
 */
export const localQwenDevBridge = (manager: LocalQwenManager = localQwenManager): Plugin => ({
  name: 'changstore-local-qwen-dev-bridge',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(LOCAL_QWEN_DEV_PATH, (request, response: ServerResponse, next) => {
      if (request.method !== 'POST') {
        next();
        return;
      }
      void readBody(request)
        .then((raw) => {
          const parsed = JSON.parse(raw || '{}') as { action?: string; payload?: unknown };
          return handleLocalQwenDevRequest(manager, String(parsed.action ?? ''), parsed.payload);
        })
        .catch((error: unknown) => ({
          ok: false as const,
          error: { message: error instanceof Error ? error.message : 'Local Qwen dev bridge failed.' },
        }))
        .then((result) => {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(result));
        });
    });
  },
});
