import { GoogleGenAI } from "@google/genai";

interface DebuggableGeminiClient {
  apiClient?: {
    getBaseUrl?: () => string;
    setBaseUrl?: (url: string) => void;
    clientOptions?: {
      httpOptions?: {
        baseUrl?: string;
        apiVersion?: string;
      };
    };
  };
}

interface GeminiClientConfiguration {
  apiKey: string | null;
  baseUrl: string | null;
}

let geminiClientInstance: GoogleGenAI | null = null;
let activeApiKeyOverride: string | null = null;
let customBaseUrl: string | null = null;

const trimToNull = (value: string | null | undefined): string | null => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const logGeminiClientDebug = (label: string, payload: Record<string, unknown>): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const globalWindow = window as Window & { __DEBUG__?: boolean };
  if (!globalWindow.__DEBUG__) {
    return;
  }

  console.info(`[GeminiClientDebug] ${label}`, payload);
};

const getGeminiClientDebugState = (client: GoogleGenAI): Record<string, unknown> => {
  const debugClient = client as GoogleGenAI & DebuggableGeminiClient;
  const runtimeBaseUrl = debugClient.apiClient?.getBaseUrl?.();
  const configuredHttpOptions = debugClient.apiClient?.clientOptions?.httpOptions;

  return {
    runtimeBaseUrl,
    configuredBaseUrl: configuredHttpOptions?.baseUrl,
    configuredApiVersion: configuredHttpOptions?.apiVersion,
  };
};

const buildGeminiClient = (apiKey: string, baseUrl: string | null): GoogleGenAI => {
  const client = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    ...(baseUrl && {
      httpOptions: { baseUrl },
    }),
  });

  if (baseUrl) {
    const debugClient = client as GoogleGenAI & DebuggableGeminiClient;
    debugClient.apiClient?.setBaseUrl?.(baseUrl);
  }

  return client;
};

/**
 * Point the Gemini client at a base URL and key.
 *
 * The app always configures the CPA gateway, so a configured base URL means the
 * gateway key is the only accepted credential: no silent fallback to a Google key.
 */
export function configureGeminiClient({ apiKey, baseUrl }: GeminiClientConfiguration): void {
  activeApiKeyOverride = trimToNull(apiKey);
  customBaseUrl = trimToNull(baseUrl);
  geminiClientInstance = null;

  logGeminiClientDebug('configureGeminiClient', {
    hasApiKey: Boolean(activeApiKeyOverride),
    customBaseUrl,
  });
}

export function isProxyEnabled(): boolean {
  return customBaseUrl !== null;
}

export function getActiveApiKey(): string {
  // The gateway key is the only accepted credential: there is no direct-Google fallback,
  // so a build without a configured key fails loudly instead of reaching Google.
  if (activeApiKeyOverride) {
    return activeApiKeyOverride;
  }

  throw new Error("API_KEY is not configured. Please set it in the settings or environment.");
}

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClientInstance) {
    geminiClientInstance = buildGeminiClient(getActiveApiKey(), customBaseUrl);
    logGeminiClientDebug('createGeminiClient', {
      customBaseUrl,
      hasActiveApiKeyOverride: Boolean(activeApiKeyOverride),
      ...getGeminiClientDebugState(geminiClientInstance),
    });
  } else {
    logGeminiClientDebug('reuseGeminiClient', {
      customBaseUrl,
      hasActiveApiKeyOverride: Boolean(activeApiKeyOverride),
      ...getGeminiClientDebugState(geminiClientInstance),
    });
  }

  return geminiClientInstance;
}

export function reinitializeGeminiClient(): void {
  geminiClientInstance = null;
}
