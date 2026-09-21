import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import type { ImageFile } from '../types';

export const DESKTOP_CREDENTIAL_SENTINEL = '__desktop_gateway_credential__';

export const DESKTOP_GATEWAY_CHANNELS = {
  storeCredential: 'desktop-gateway:store-credential',
  removeCredential: 'desktop-gateway:remove-credential',
  clearCredentials: 'desktop-gateway:clear-credentials',
  listGatewayModels: 'desktop-gateway:list-models',
  geminiGenerateContent: 'desktop-gateway:gemini-generate-content',
  gptImageGenerate: 'desktop-gateway:gpt-image-generate',
  gptImageEdit: 'desktop-gateway:gpt-image-edit',
} as const;

export interface DesktopBridgeErrorShape {
  message: string;
  status?: number;
  code?: string;
}

export type DesktopBridgeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DesktopBridgeErrorShape };

export interface DesktopGatewayProbeResult {
  status: 'ok' | 'unauthorized' | 'forbidden' | 'unreachable' | 'malformedShape';
  modelIds: string[];
  ownedBy: Record<string, string>;
  latencyMs: number;
  httpStatus?: number;
}

export interface DesktopProviderResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface DesktopGatewayApi {
  storeCredential(input: { credentialRef: string; baseUrl: string; apiKey: string }): Promise<DesktopBridgeResult<null>>;
  removeCredential(input: { credentialRef: string }): Promise<DesktopBridgeResult<null>>;
  clearCredentials(): Promise<DesktopBridgeResult<null>>;
  listGatewayModels(input: {
    credentialRef: string;
    baseUrl: string;
    apiKey?: string;
  }): Promise<DesktopBridgeResult<DesktopGatewayProbeResult>>;
  geminiGenerateContent(input: {
    credentialRef: string;
    baseUrl: string;
    apiKey?: string;
    request: GenerateContentParameters;
  }): Promise<DesktopBridgeResult<GenerateContentResponse>>;
  gptImageGenerate(input: {
    credentialRef: string;
    baseUrl: string;
    apiKey?: string;
    body: Record<string, string | number>;
  }): Promise<DesktopBridgeResult<DesktopProviderResponse>>;
  gptImageEdit(input: {
    credentialRef: string;
    baseUrl: string;
    apiKey?: string;
    fields: Array<[string, string]>;
    images: Array<ImageFile & { fileName: string }>;
  }): Promise<DesktopBridgeResult<DesktopProviderResponse>>;
}

declare global {
  interface Window {
    desktopGateway?: DesktopGatewayApi;
    desktopEnv?: {
      isDesktop: boolean;
      platform: string;
    };
  }
}

export class DesktopGatewayError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(error: DesktopBridgeErrorShape) {
    super(error.message);
    this.name = 'DesktopGatewayError';
    this.status = error.status;
    this.code = error.code;
  }
}

export const getDesktopGatewayApi = (): DesktopGatewayApi | undefined =>
  typeof window === 'undefined' ? undefined : window.desktopGateway;

export const isStoredDesktopCredential = (value: string | null | undefined): boolean =>
  value === DESKTOP_CREDENTIAL_SENTINEL;

export const transientDesktopApiKey = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && !isStoredDesktopCredential(trimmed) ? trimmed : undefined;
};

export const unwrapDesktopBridgeResult = <T>(result: DesktopBridgeResult<T>): T => {
  if (result.ok === false) {
    throw new DesktopGatewayError(result.error);
  }
  return result.value;
};
