import { GatewayError } from '../http/error-response.js';

export const parseImageDataUrl = (
  value: string,
  invalidMessage: string,
): { mimeType: string; data: string } => {
  const match = value.match(/^data:(.+?);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }
  return {
    mimeType: match[1],
    data: match[2].replace(/\s+/g, ''),
  };
};
