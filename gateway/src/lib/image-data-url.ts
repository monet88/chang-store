import { GatewayError } from '../http/error-response.js';

export const parseImageDataUrl = (
  value: string,
  invalidMessage: string,
): { mimeType: string; data: string } => {
  if (value.substring(0, 5).toLowerCase() !== 'data:') {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const commaIdx = value.indexOf(',', 5);
  if (commaIdx === -1) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const meta = value.substring(5, commaIdx).toLowerCase();
  if (!meta.endsWith(';base64')) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const mimeType = meta.substring(0, meta.length - 7);
  const data = value.substring(commaIdx + 1).replace(/\s+/g, '');

  if (!mimeType) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    // [A-Za-z0-9+/=]
    if (
      !(code >= 65 && code <= 90) && // A-Z
      !(code >= 97 && code <= 122) && // a-z
      !(code >= 48 && code <= 57) && // 0-9
      code !== 43 && // +
      code !== 47 && // /
      code !== 61 // =
    ) {
      throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
    }
  }

  return {
    mimeType,
    data,
  };
};
