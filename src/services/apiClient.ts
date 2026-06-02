import { GoogleGenAI } from "@google/genai";

interface GeminiClientConfiguration {
  apiKey: string | null;
  baseUrl: string | null;
  requireExplicitApiKey?: boolean;
}

let geminiClientInstance: GoogleGenAI | null = null;
let directApiKeyOverride: string | null = null;
let activeApiKeyOverride: string | null = null;
let customBaseUrl: string | null = null;
let requireExplicitApiKey = false;

const trimToNull = (value: string | null | undefined): string | null => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const getEnvGeminiApiKey = (): string | null => {
  const envApiKey = process.env.GEMINI_API_KEY?.trim();
  return envApiKey ? envApiKey : null;
};

const buildGeminiClient = (apiKey: string, baseUrl: string | null): GoogleGenAI => {
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    ...(baseUrl && {
      httpOptions: { baseUrl },
    }),
  });
};

const getDirectApiKey = (): string => {
  const envApiKey = getEnvGeminiApiKey();
  if (envApiKey) {
    return envApiKey;
  }

  if (directApiKeyOverride) {
    return directApiKeyOverride;
  }

  if (!customBaseUrl && activeApiKeyOverride) {
    return activeApiKeyOverride;
  }

  throw new Error("API_KEY is not configured. Please set it in the settings or environment.");
};

export function setGeminiApiKey(key: string | null) {
  directApiKeyOverride = trimToNull(key);

  if (!customBaseUrl) {
    activeApiKeyOverride = directApiKeyOverride;
    requireExplicitApiKey = false;
    geminiClientInstance = null;
  }
}

export function setGeminiBaseUrl(url: string | null) {
  customBaseUrl = trimToNull(url);

  if (!customBaseUrl) {
    requireExplicitApiKey = false;
  }

  geminiClientInstance = null;
}

export function configureGeminiClient({
  apiKey,
  baseUrl,
  requireExplicitApiKey: shouldRequireExplicitApiKey = false,
}: GeminiClientConfiguration): void {
  activeApiKeyOverride = trimToNull(apiKey);
  customBaseUrl = trimToNull(baseUrl);
  requireExplicitApiKey = Boolean(customBaseUrl) && shouldRequireExplicitApiKey;
  geminiClientInstance = null;
}

export function isProxyEnabled(): boolean {
  return customBaseUrl !== null;
}

export function getActiveApiKey(): string {
  if (customBaseUrl || requireExplicitApiKey) {
    if (activeApiKeyOverride) {
      return activeApiKeyOverride;
    }

    throw new Error("API_KEY is not configured. Please set it in the settings or environment.");
  }

  const envApiKey = getEnvGeminiApiKey();
  if (envApiKey) {
    return envApiKey;
  }

  if (activeApiKeyOverride) {
    return activeApiKeyOverride;
  }

  if (directApiKeyOverride) {
    return directApiKeyOverride;
  }

  throw new Error("API_KEY is not configured. Please set it in the settings or environment.");
}

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClientInstance) {
    geminiClientInstance = buildGeminiClient(getActiveApiKey(), customBaseUrl);
  }

  return geminiClientInstance;
}

export function getDirectGeminiClient(): GoogleGenAI {
  return buildGeminiClient(getDirectApiKey(), null);
}

export function reinitializeGeminiClient(): void {
  geminiClientInstance = null;
}
