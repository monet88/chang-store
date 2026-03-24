export interface ModelCapability {
  supportsImageSize: boolean;
  supportsAspectRatio: boolean;
}

const CAPABILITY_RULES = [
  {
    pattern: /gemini-3/,
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    pattern: /imagen-[34]/,
    capabilities: { supportsImageSize: true, supportsAspectRatio: true },
  },
  {
    pattern: /gemini-2\.5/,
    capabilities: { supportsImageSize: false, supportsAspectRatio: true },
  },
];

const DEFAULT_CAPABILITIES: ModelCapability = {
  supportsImageSize: false,
  supportsAspectRatio: true,
};

export function getModelCapabilities(modelId: string): ModelCapability {
  for (const rule of CAPABILITY_RULES) {
    if (rule.pattern.test(modelId)) {
      return rule.capabilities;
    }
  }
  return DEFAULT_CAPABILITIES;
}
