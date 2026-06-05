import type { ProviderModelCatalog } from '../config/env.js';

export const getProviderModelCatalog = (
  modelCatalog: Record<string, ProviderModelCatalog>,
  provider: string,
): ProviderModelCatalog => modelCatalog[provider] ?? {
  aliases: {},
  allowlist: [],
  disabled: [],
};

export const resolveProviderModel = (
  modelCatalog: Record<string, ProviderModelCatalog>,
  provider: string,
  requestedModel: unknown,
): string | undefined => {
  const catalog = getProviderModelCatalog(modelCatalog, provider);
  const requested = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (!requested) {
    return catalog.defaultModel || undefined;
  }
  return catalog.aliases[requested] || requested;
};
