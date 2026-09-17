import { getImageDimensions } from '@/utils/imageUtils';
import { logEvent } from '@/services/debugService';
import type { ImageFile } from '../../../types';
import {
  getImageModelDescriptor,
  resolveCapabilities,
  type ImageModelCapabilities,
  type ImageModelDescriptor,
} from '../../../config/imageModelCatalog';

/**
 * Lớp 1 driver discipline (US-006): what a request may send, and what the answer
 * must be checked against. Capabilities are a property of the (gateway, model)
 * pair, so both live behind {@link resolveDriverPolicy}.
 */
export interface DriverPolicy {
  descriptor: ImageModelDescriptor;
  /** Bare host of the active base URL, or undefined when it cannot be parsed. */
  gatewayHost?: string;
  capabilities: ImageModelCapabilities;
}

/** Context for the returned-dimension guard. */
export interface DimensionGuardContext {
  modelId: string;
}

/** Requested vs returned `WxH` of the first image a gateway answered at the wrong size. */
export interface SizeMismatch {
  requested: string;
  returned: string;
}

/**
 * Bare host of a base URL ('cliproxy.monet.uno', 'localhost'), or undefined.
 * No port: catalog overrides are keyed by the host the facts were measured on, so the
 * same gateway on `localhost:8333` must still pick up its own measured quirks.
 */
export function gatewayHostOf(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl).hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Capability facts for the (gateway, model) pair a request is about to use.
 * `null` for a model the catalog does not know — an unverified model the gateway
 * serves, which keeps the historical field behaviour instead of guessing.
 */
export function resolveDriverPolicy(modelId: string, baseUrl: string): DriverPolicy | null {
  const descriptor = getImageModelDescriptor(modelId);
  if (!descriptor) {
    return null;
  }
  const gatewayHost = gatewayHostOf(baseUrl);
  return { descriptor, gatewayHost, capabilities: resolveCapabilities(descriptor, gatewayHost) };
}

export type RequestField = [string, string];

/**
 * The fields a request may send: a capability-measured-ignored field is dropped
 * (both gateways swallow unknown fields with HTTP 200), and the drop is logged
 * through `debugService` — never `console.log`.
 */
export function prepareRequestFields(
  modelId: string,
  params: { size: string; quality: string },
  policy: DriverPolicy | null,
): RequestField[] {
  const capabilities = policy?.capabilities;
  const fields: RequestField[] = [];
  if (capabilities?.honorsSize !== 'no') fields.push(['size', params.size]);
  if (capabilities?.honorsQuality !== false) fields.push(['quality', params.quality]);

  const sent = fields.map(([name]) => name);
  logEvent('provider.request', {
    model: modelId,
    driver: capabilities?.driver ?? 'unknown',
    size: fields.find(([name]) => name === 'size')?.[1] ?? 'dropped',
    droppedFields: ['size', 'quality'].filter((name) => !sent.includes(name)).join(',') || 'none',
  });

  return fields;
}

/** `1080x1920` → dimensions; `auto` or a ratio string → null (nothing to compare). */
export function parsePixelSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/**
 * Compare what came back with what was asked for. A gateway that silently answers
 * its own size is the exact failure this guards, so `flaky` still checks every
 * call. Best effort: the image is always kept (a wrong-size image beats a lost
 * one) and an unmeasurable payload is not a generation failure. Returns the first
 * mismatch so the caller can surface one non-blocking notice.
 *
 * Scope: pixel sizes. A `ratio` lane is not compared yet — the Gemini lane sends
 * `imageConfig` and the xAI rows are still `honorsSize: 'no'`, so a ratio branch would
 * have no caller able to exercise it; add it with that lane's live measurement.
 */
export async function verifyReturnedDimensions(
  images: ImageFile[],
  requestedSize: string,
  capabilities: ImageModelCapabilities,
  context: DimensionGuardContext,
): Promise<SizeMismatch | null> {
  if (capabilities.sizeMode !== 'pixel' || capabilities.honorsSize === 'no') {
    return null;
  }

  const requested = parsePixelSize(requestedSize);
  if (!requested) {
    return null;
  }

  let mismatch: SizeMismatch | null = null;
  for (const image of images) {
    try {
      const { width, height } = await getImageDimensions(image.base64, image.mimeType);
      if (width !== requested.width || height !== requested.height) {
        logEvent('image.dimensionMismatch', {
          model: context.modelId,
          driver: capabilities.driver,
          requested: requestedSize,
          returned: `${width}x${height}`,
        });
        mismatch ??= { requested: requestedSize, returned: `${width}x${height}` };
      }
    } catch {
      // Cannot measure the payload — never fail the generation for that.
    }
  }
  return mismatch;
}
