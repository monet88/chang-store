/**
 * Provider registry for the three-studio split.
 *
 * Holds metadata for the non-Gemini provider studios (GPT Image),
 * including default base URLs and the injected env variable values. Env values
 * are wired in `vite.config.ts` (`process.env.GPT_IMAGE_*`)
 * with a VITE_-prefixed fallback for local `.env` files.
 */

export type ProviderId = 'gptImage';

export interface ProviderMetadata {
  id: ProviderId;
  /** Human-readable label (also exposed via i18n where user-facing). */
  label: string;
  /** Default API base URL when the user has not overridden it. */
  defaultBaseUrl: string;
  /** Env value injected at build time for the API key (may be empty). */
  envApiKey: string;
  /** Env value injected at build time for the base URL (may be empty). */
  envBaseUrl: string;
}

const readEnv = (value: string | undefined | null): string =>
  typeof value === 'string' ? value : '';

const GPT_IMAGE_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderMetadata> = {
  gptImage: {
    id: 'gptImage',
    label: 'GPT',
    defaultBaseUrl: GPT_IMAGE_DEFAULT_BASE_URL,
    // XomPet is the measured reference gateway for the image lane, so its injected env
    // values win when both are present (docs/api/xompet-image-api-guide.md).
    envApiKey: readEnv(process.env.XOMPET_API_KEY) || readEnv(process.env.GPT_IMAGE_API_KEY),
    envBaseUrl: readEnv(process.env.XOMPET_BASE_URL) || readEnv(process.env.GPT_IMAGE_BASE_URL),
  },
};

export const PROVIDER_IDS: ProviderId[] = ['gptImage'];

export function getProviderMetadata(id: ProviderId): ProviderMetadata {
  return PROVIDER_REGISTRY[id];
}

/** Default base URL for a provider: env override first, then the built-in default. */
export function getProviderDefaultBaseUrl(id: ProviderId): string {
  const meta = PROVIDER_REGISTRY[id];
  return meta.envBaseUrl || meta.defaultBaseUrl;
}

/** Env-provided API key for a provider (empty string when unset). */
export function getProviderEnvApiKey(id: ProviderId): string {
  return PROVIDER_REGISTRY[id].envApiKey;
}
