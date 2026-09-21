import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, ipcMain, safeStorage, type IpcMainInvokeEvent } from 'electron';
import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';
import {
  DESKTOP_CREDENTIAL_SENTINEL,
  DESKTOP_GATEWAY_CHANNELS,
  type DesktopBridgeErrorShape,
  type DesktopBridgeResult,
  type DesktopGatewayProbeResult,
  type DesktopProviderResponse,
} from '../src/platform/desktopGateway';
import type { ImageFile } from '../src/types';
import { MAX_GPT_REFERENCE_IMAGES } from '../src/config/gptImageModelRegistry';
import { validateProviderBaseUrl } from '../src/utils/provider-url-validation';
import { isPublicNetworkAddress, normalizeNetworkHostname } from './networkSafety';

interface StoredCredential {
  baseUrl: string;
  encryptedApiKey: string;
}

type CredentialVault = Record<string, StoredCredential>;

const vaultPath = (): string => path.join(app.getPath('userData'), 'gateway-credentials.json');

const readVault = (): CredentialVault => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(vaultPath(), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, StoredCredential] => {
      const value = entry[1];
      return Boolean(
        value
        && typeof value === 'object'
        && 'baseUrl' in value
        && typeof value.baseUrl === 'string'
        && 'encryptedApiKey' in value
        && typeof value.encryptedApiKey === 'string',
      );
    }));
  } catch {
    return {};
  }
};

const writeVault = (vault: CredentialVault): void => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this system.');
  }
  mkdirSync(path.dirname(vaultPath()), { recursive: true });
  writeFileSync(vaultPath(), JSON.stringify(vault), { encoding: 'utf8', mode: 0o600 });
};

const normalizedProviderUrl = (rawUrl: string): string => requireProviderUrl(rawUrl).replace(/\/+$/, '');

const storeCredential = (credentialRef: string, baseUrl: string, apiKey: string): void => {
  const key = apiKey.trim();
  if (!credentialRef.trim() || !key || key === DESKTOP_CREDENTIAL_SENTINEL) {
    throw new Error('A real credential and credential reference are required.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this system.');
  }
  const vault = readVault();
  vault[credentialRef] = {
    baseUrl: normalizedProviderUrl(baseUrl),
    encryptedApiKey: safeStorage.encryptString(key).toString('base64'),
  };
  writeVault(vault);
};

const removeCredential = (credentialRef: string): void => {
  const vault = readVault();
  if (!(credentialRef in vault)) {
    return;
  }
  delete vault[credentialRef];
  if (Object.keys(vault).length === 0) {
    rmSync(vaultPath(), { force: true });
    return;
  }
  writeVault(vault);
};

const readCredential = (credentialRef: string, baseUrl: string): string | null => {
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }
  const stored = readVault()[credentialRef];
  if (!stored || stored.baseUrl !== normalizedProviderUrl(baseUrl)) {
    return null;
  }
  try {
    return safeStorage.decryptString(Buffer.from(stored.encryptedApiKey, 'base64')).trim() || null;
  } catch {
    return null;
  }
};

const builtInCredential = (credentialRef: string, baseUrl: string): string | null => {
  const requestedUrl = normalizedProviderUrl(baseUrl);
  if (credentialRef === 'cpa-default') {
    if (requestedUrl !== normalizedProviderUrl('https://cliproxy.monet.uno')) return null;
    const key = (process.env.CLIPROXY_API_KEY || process.env.VITE_CLIPROXY_API_KEY)?.trim();
    return key && key !== DESKTOP_CREDENTIAL_SENTINEL ? key : null;
  }

  if (credentialRef === 'gptImage-default') {
    const expectedUrl = (
      process.env.XOMPET_BASE_URL
      || process.env.VITE_XOMPET_BASE_URL
      || process.env.GPT_IMAGE_BASE_URL
      || process.env.VITE_GPT_IMAGE_BASE_URL
      || 'https://api.openai.com/v1'
    ).trim();
    if (requestedUrl !== normalizedProviderUrl(expectedUrl)) return null;
    const key = (
      process.env.XOMPET_API_KEY
      || process.env.GPT_IMAGE_API_KEY
      || process.env.VITE_XOMPET_API_KEY
      || process.env.VITE_GPT_IMAGE_API_KEY
    )?.trim();
    return key && key !== DESKTOP_CREDENTIAL_SENTINEL ? key : null;
  }

  return null;
};

const resolveCredential = (credentialRef: string, baseUrl: string, transientApiKey?: string): string => {
  const transient = transientApiKey?.trim();
  if (transient && transient !== DESKTOP_CREDENTIAL_SENTINEL) {
    return transient;
  }
  const key = readCredential(credentialRef, baseUrl) ?? builtInCredential(credentialRef, baseUrl);
  if (!key) {
    const error = new Error('API_KEY is not configured. Please set it in the settings or environment.') as Error & {
      status?: number;
      code?: string;
    };
    error.status = 401;
    error.code = 'missing_api_key';
    throw error;
  }
  return key;
};

const requireProviderUrl = (rawUrl: string): string => {
  const validation = validateProviderBaseUrl(rawUrl);
  if (validation.status === 'invalid') {
    const error = new Error('error.provider.missingBaseUrl') as Error & { status?: number; code?: string };
    error.status = 400;
    error.code = 'invalid_base_url';
    throw error;
  }
  return validation.url.replace(/\/+$/, '');
};

const bridgeError = (error: unknown): DesktopBridgeErrorShape => {
  const shaped = error as { message?: unknown; status?: unknown; code?: unknown };
  return {
    message: typeof shaped?.message === 'string' ? shaped.message : 'Desktop gateway request failed.',
    ...(typeof shaped?.status === 'number' ? { status: shaped.status } : {}),
    ...(typeof shaped?.code === 'string' ? { code: shaped.code } : {}),
  };
};

const bridge = async <T>(task: () => Promise<T> | T): Promise<DesktopBridgeResult<T>> => {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, error: bridgeError(error) };
  }
};

type UnknownRecord = Record<string, unknown>;

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid desktop gateway ${name}.`);
  }
  return value as UnknownRecord;
};

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid desktop gateway ${name}.`);
  }
  return value;
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const assertOnlyKeys = (input: UnknownRecord, allowed: readonly string[], name: string): void => {
  const unexpected = Object.keys(input).find((key) => !allowed.includes(key));
  if (unexpected) {
    throw new Error(`Invalid desktop gateway ${name}: unsupported field ${unexpected}.`);
  }
};

const parseCredentialTarget = (value: unknown): { credentialRef: string; baseUrl: string; apiKey?: string } => {
  const input = requireRecord(value, 'request');
  return {
    credentialRef: requireString(input.credentialRef, 'credential reference'),
    baseUrl: requireProviderUrl(requireString(input.baseUrl, 'base URL')),
    apiKey: optionalString(input.apiKey),
  };
};

const parseStringNumberRecord = (value: unknown): Record<string, string | number> => {
  const input = requireRecord(value, 'request body');
  const entries = Object.entries(input);
  if (entries.some(([, field]) => typeof field !== 'string' && typeof field !== 'number')) {
    throw new Error('Invalid desktop gateway request body.');
  }
  return Object.fromEntries(entries) as Record<string, string | number>;
};

const parseEditFields = (value: unknown): Array<[string, string]> => {
  if (!Array.isArray(value)) throw new Error('Invalid desktop gateway edit fields.');
  return value.map((field) => {
    if (!Array.isArray(field) || field.length !== 2) throw new Error('Invalid desktop gateway edit field.');
    return [requireString(field[0], 'edit field name'), requireString(field[1], 'edit field value')];
  });
};

const parseEditImages = (value: unknown): Array<ImageFile & { fileName: string }> => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GPT_REFERENCE_IMAGES) {
    throw new Error('Invalid desktop gateway edit images.');
  }
  return value.map((image) => {
    const item = requireRecord(image, 'edit image');
    return {
      base64: requireString(item.base64, 'image data'),
      mimeType: requireString(item.mimeType, 'image MIME type'),
      fileName: requireString(item.fileName, 'image file name'),
    };
  });
};

const parseGeminiPart = (value: unknown): UnknownRecord => {
  const part = requireRecord(value, 'Gemini part');
  assertOnlyKeys(part, ['text', 'inlineData'], 'Gemini part');
  if ('text' in part) {
    if (typeof part.text !== 'string') throw new Error('Invalid desktop gateway Gemini text part.');
    return { text: part.text };
  }
  if ('inlineData' in part) {
    const inlineData = requireRecord(part.inlineData, 'Gemini inline data');
    assertOnlyKeys(inlineData, ['data', 'mimeType'], 'Gemini inline data');
    return {
      inlineData: {
        data: requireString(inlineData.data, 'Gemini inline data'),
        mimeType: requireString(inlineData.mimeType, 'Gemini MIME type'),
      },
    };
  }
  throw new Error('Invalid desktop gateway Gemini part.');
};

const parseGeminiContent = (value: unknown): unknown => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(parseGeminiContent);

  const content = requireRecord(value, 'Gemini content');
  assertOnlyKeys(content, ['role', 'parts'], 'Gemini content');
  if (!Array.isArray(content.parts)) throw new Error('Invalid desktop gateway Gemini parts.');
  return {
    ...(content.role === undefined ? {} : { role: requireString(content.role, 'Gemini role') }),
    parts: content.parts.map(parseGeminiPart),
  };
};

const parseGeminiConfig = (value: unknown): UnknownRecord | undefined => {
  if (value === undefined) return undefined;
  const config = requireRecord(value, 'Gemini config');
  assertOnlyKeys(config, ['responseModalities', 'imageConfig', 'httpOptions'], 'Gemini config');
  const parsed: UnknownRecord = {};

  if (config.responseModalities !== undefined) {
    if (!Array.isArray(config.responseModalities)) {
      throw new Error('Invalid desktop gateway Gemini response modalities.');
    }
    parsed.responseModalities = config.responseModalities.map((item) => requireString(item, 'Gemini modality'));
  }

  if (config.imageConfig !== undefined) {
    const imageConfig = requireRecord(config.imageConfig, 'Gemini image config');
    assertOnlyKeys(imageConfig, ['aspectRatio', 'imageSize'], 'Gemini image config');
    parsed.imageConfig = {
      ...(imageConfig.aspectRatio === undefined ? {} : { aspectRatio: requireString(imageConfig.aspectRatio, 'Gemini aspect ratio') }),
      ...(imageConfig.imageSize === undefined ? {} : { imageSize: requireString(imageConfig.imageSize, 'Gemini image size') }),
    };
  }

  if (config.httpOptions !== undefined) {
    const httpOptions = requireRecord(config.httpOptions, 'Gemini HTTP options');
    assertOnlyKeys(httpOptions, ['timeout'], 'Gemini HTTP options');
    if (typeof httpOptions.timeout !== 'number' || !Number.isFinite(httpOptions.timeout) || httpOptions.timeout <= 0) {
      throw new Error('Invalid desktop gateway Gemini timeout.');
    }
    parsed.httpOptions = { timeout: httpOptions.timeout };
  }

  return parsed;
};

const parseGeminiRequest = (value: unknown): GenerateContentParameters => {
  const request = requireRecord(value, 'Gemini generateContent request');
  assertOnlyKeys(request, ['model', 'contents', 'config'], 'Gemini generateContent request');
  if (!('contents' in request)) throw new Error('Invalid desktop gateway Gemini contents.');
  const config = parseGeminiConfig(request.config);
  return {
    model: requireString(request.model, 'Gemini model'),
    contents: parseGeminiContent(request.contents) as GenerateContentParameters['contents'],
    ...(config ? { config: config as GenerateContentParameters['config'] } : {}),
  };
};

const assertTrustedSender = (event: IpcMainInvokeEvent): void => {
  const senderUrl = event.senderFrame?.url;
  if (!senderUrl || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Untrusted desktop gateway sender.');
  }
  try {
    const parsed = new URL(senderUrl);
    if (app.isPackaged && parsed.protocol === 'file:') {
      const expectedRenderer = path.normalize(path.join(__dirname, '../renderer/index.html'));
      if (path.normalize(fileURLToPath(parsed)) === expectedRenderer) return;
    }
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
      const rendererOrigin = new URL(process.env.ELECTRON_RENDERER_URL).origin;
      if (parsed.origin === rendererOrigin) return;
    }
  } catch {
    // Fall through to the explicit rejection below.
  }
  throw new Error('Untrusted desktop gateway sender.');
};

const trustedBridge = <T>(event: IpcMainInvokeEvent, task: () => Promise<T> | T): Promise<DesktopBridgeResult<T>> =>
  bridge(() => {
    assertTrustedSender(event);
    return task();
  });

const apiRoot = (baseUrl: string): string => normalizedProviderUrl(baseUrl).replace(/\/v1$/, '');

const probeGatewayModels = async (baseUrl: string, apiKey: string): Promise<DesktopGatewayProbeResult> => {
  const startedAt = Date.now();
  const response = await fetch(`${apiRoot(baseUrl)}/v1/models`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const latencyMs = Date.now() - startedAt;

  if (!response) return { status: 'unreachable', modelIds: [], ownedBy: {}, latencyMs };
  if (response.status === 401) return { status: 'unauthorized', modelIds: [], ownedBy: {}, latencyMs, httpStatus: 401 };
  if (response.status === 403) return { status: 'forbidden', modelIds: [], ownedBy: {}, latencyMs, httpStatus: 403 };
  if (!response.ok) return { status: 'unreachable', modelIds: [], ownedBy: {}, latencyMs, httpStatus: response.status };

  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data)) {
    return { status: 'malformedShape', modelIds: [], ownedBy: {}, latencyMs, httpStatus: response.status };
  }

  const modelIds: string[] = [];
  const ownedBy: Record<string, string> = {};
  for (const item of body.data) {
    if (!item || typeof item !== 'object') continue;
    const id = 'id' in item && typeof item.id === 'string' ? item.id : '';
    if (!id) continue;
    modelIds.push(id);
    if ('owned_by' in item && typeof item.owned_by === 'string' && item.owned_by) {
      ownedBy[id] = item.owned_by;
    }
  }
  return { status: 'ok', modelIds, ownedBy, latencyMs, httpStatus: response.status };
};

const normalizeGeminiResponse = (response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>): unknown => ({
  candidates: response.candidates,
  promptFeedback: response.promptFeedback,
  modelVersion: response.modelVersion,
  responseId: response.responseId,
  usageMetadata: response.usageMetadata,
  text: response.text,
});

const responseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text || 'error.provider.requestFailed' } };
  }
};

const MAX_REMOTE_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_REMOTE_IMAGE_REDIRECTS = 4;

const resolvePublicAddress = async (target: URL): Promise<{ address: string; family: 4 | 6 }> => {
  const hostname = normalizeNetworkHostname(target.hostname);
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true });
  const candidate = addresses.find(({ address }) => isPublicNetworkAddress(address));
  if (!candidate) throw new Error('error.provider.response.urlOnly');
  return { address: candidate.address, family: candidate.family as 4 | 6 };
};

const downloadPublicImage = async (
  rawUrl: string,
  redirectsRemaining: number = MAX_REMOTE_IMAGE_REDIRECTS,
): Promise<{ base64: string; mimeType: string }> => {
  const target = new URL(rawUrl);
  if ((target.protocol !== 'https:' && target.protocol !== 'http:') || target.username || target.password) {
    throw new Error('error.provider.response.urlOnly');
  }

  const hostname = normalizeNetworkHostname(target.hostname);
  const { address, family } = await resolvePublicAddress(target);
  const response = await new Promise<{ statusCode: number; location?: string; mimeType?: string; body?: Buffer }>((resolve, reject) => {
    const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
    let deadline: NodeJS.Timeout;
    const clearDeadline = (): void => clearTimeout(deadline);
    const request = transport({
      protocol: target.protocol,
      hostname: address,
      family,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: { Host: target.host },
      ...(target.protocol === 'https:' && !isIP(hostname) ? { servername: hostname } : {}),
    }, (incoming) => {
      const statusCode = incoming.statusCode ?? 0;
      const location = incoming.headers.location;
      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        incoming.resume();
        clearDeadline();
        resolve({ statusCode, location });
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        incoming.resume();
        clearDeadline();
        reject(new Error('error.provider.response.urlOnly'));
        return;
      }

      const mimeType = incoming.headers['content-type']?.split(';')[0]?.trim();
      if (!mimeType?.startsWith('image/')) {
        incoming.resume();
        clearDeadline();
        reject(new Error('error.provider.response.urlOnly'));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      incoming.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
          request.destroy(new Error('error.provider.response.urlOnly'));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on('end', () => {
        clearDeadline();
        resolve({ statusCode, mimeType, body: Buffer.concat(chunks) });
      });
      incoming.on('error', (error) => {
        clearDeadline();
        reject(error);
      });
    });
    deadline = setTimeout(() => request.destroy(new Error('error.provider.response.urlOnly')), 60_000);
    deadline.unref();
    request.on('error', (error) => {
      clearDeadline();
      reject(error);
    });
    request.end();
  });

  if (response.location) {
    if (redirectsRemaining <= 0) throw new Error('error.provider.response.urlOnly');
    return downloadPublicImage(new URL(response.location, target).toString(), redirectsRemaining - 1);
  }
  if (!response.body || !response.mimeType) throw new Error('error.provider.response.urlOnly');
  return { base64: response.body.toString('base64'), mimeType: response.mimeType };
};

const materializeImageUrls = async (body: unknown): Promise<unknown> => {
  if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data)) return body;

  const data = await Promise.all(body.data.map(async (item) => {
    if (!item || typeof item !== 'object' || !('url' in item) || typeof item.url !== 'string' || !item.url) {
      return item;
    }
    const image = await downloadPublicImage(item.url);
    return { ...item, url: undefined, b64_json: image.base64, mime_type: image.mimeType };
  }));
  return { ...body, data };
};

const providerResult = async (response: Response): Promise<DesktopProviderResponse> => {
  const body = await responseBody(response);
  return {
    ok: response.ok,
    status: response.status,
    body: response.ok ? await materializeImageUrls(body) : body,
  };
};

export const registerDesktopGatewayHandlers = (): void => {
  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.storeCredential, (event, value: unknown) =>
    trustedBridge(event, () => {
      const input = parseCredentialTarget(value);
      const raw = requireRecord(value, 'credential');
      storeCredential(input.credentialRef, input.baseUrl, requireString(raw.apiKey, 'API key'));
      return null;
    }));

  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.removeCredential, (event, value: unknown) =>
    trustedBridge(event, () => {
      const input = requireRecord(value, 'credential');
      removeCredential(requireString(input.credentialRef, 'credential reference'));
      return null;
    }));

  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.clearCredentials, (event) => trustedBridge(event, () => {
    rmSync(vaultPath(), { force: true });
    return null;
  }));

  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.listGatewayModels, (event, value: unknown) => trustedBridge(event, () => {
    const input = parseCredentialTarget(value);
    return probeGatewayModels(
      input.baseUrl,
      resolveCredential(input.credentialRef, input.baseUrl, input.apiKey),
    );
  }));

  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.geminiGenerateContent, (event, value: unknown) => trustedBridge(event, async () => {
    const input = parseCredentialTarget(value);
    const raw = requireRecord(value, 'Gemini request');
    const request = parseGeminiRequest(raw.request);
    const baseUrl = input.baseUrl;
    const ai = new GoogleGenAI({
      apiKey: resolveCredential(input.credentialRef, baseUrl, input.apiKey),
      apiVersion: 'v1beta',
      httpOptions: { baseUrl },
    });
    (ai as GoogleGenAI & { apiClient?: { setBaseUrl?: (url: string) => void } }).apiClient?.setBaseUrl?.(baseUrl);
    const response = await ai.models.generateContent(request);
    return normalizeGeminiResponse(response);
  }));

  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.gptImageGenerate, (event, value: unknown) => trustedBridge(event, async () => {
    const input = parseCredentialTarget(value);
    const raw = requireRecord(value, 'image generation request');
    const body = parseStringNumberRecord(raw.body);
    return providerResult(await fetch(`${input.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolveCredential(input.credentialRef, input.baseUrl, input.apiKey)}`,
      },
      body: JSON.stringify(body),
    }));
  }));

  ipcMain.handle(DESKTOP_GATEWAY_CHANNELS.gptImageEdit, (event, value: unknown) => trustedBridge(event, async () => {
    const input = parseCredentialTarget(value);
    const raw = requireRecord(value, 'image edit request');
    const form = new FormData();
    for (const [name, fieldValue] of parseEditFields(raw.fields)) form.append(name, fieldValue);
    for (const image of parseEditImages(raw.images)) {
      form.append(
        'image[]',
        new Blob([Buffer.from(image.base64, 'base64')], { type: image.mimeType || 'image/png' }),
        image.fileName,
      );
    }
    return providerResult(await fetch(`${input.baseUrl}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resolveCredential(input.credentialRef, input.baseUrl, input.apiKey)}` },
      body: form,
    }));
  }));
};
