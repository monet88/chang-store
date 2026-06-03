import type { ClassifiedRoute } from '../http/request-classifier.js';
import type { GenAiClient } from '../lib/google-genai-client.js';

export const runCompatibilityRoute = async (
  route: ClassifiedRoute,
  body: Record<string, unknown>,
  ai: GenAiClient,
): Promise<Record<string, unknown>> => {
  if (route.operation === 'models') return { models: [] };
  if (route.operation === 'predict') {
    return ai.models.generateContent({ ...(body.instances ? { instances: body.instances } : body), model: route.model });
  }
  return ai.models.generateContent({ ...body, model: route.model });
};
