import type { ProviderModelCatalog } from '../config/env.js';

export const getProviderModelCatalog = (
  modelCatalog: Record<string, ProviderModelCatalog>,
  provider: string,
): ProviderModelCatalog => modelCatalog[provider] ?? {
  aliases: {},
  allowlist: [],
  disabled: [],
};
