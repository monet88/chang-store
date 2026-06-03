import type { ImageWorkloads } from '../workloads/image-workloads.js';
import { GatewayError } from '../http/error-response.js';

export const runCustomImageRoute = async (
  operation: string,
  body: Record<string, unknown>,
  workloads: ImageWorkloads,
): Promise<Record<string, unknown>> => {
  if (operation === 'imageGenerate') return { success: true, ...(await workloads.generate(body)) };
  if (operation === 'imageEdit') return { success: true, ...(await workloads.edit(body)) };
  if (operation === 'imageUpscale') return { success: true, ...(await workloads.upscale(body)) };
  if (operation === 'imageDescribe') return { success: true, ...(await workloads.describe(body)) };
  if (operation === 'sessionValidate') return { success: true, ...(await workloads.validateSession(body)) };
  throw new GatewayError(404, 'NOT_FOUND', 'Custom route is not implemented.');
};
