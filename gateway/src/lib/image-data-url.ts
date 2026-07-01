import { GatewayError } from '../http/error-response.js';

export const parseImageDataUrl = (
  value: string,
  invalidMessage: string,
): { mimeType: string; data: string } => {
  const header = value.substring(0, 128).toLowerCase();
  if (header.substring(0, 5) !== 'data:') {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  // Prevent memory DoS by not calling toLowerCase() on the entire large image string
  const suffixIdx = header.indexOf(';base64,', 5);
  if (suffixIdx === -1) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const mimeType = value.substring(5, suffixIdx);
  if (!mimeType) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const rawData = value.substring(suffixIdx + 8);
  let data = '';
  // Avoid regex replace on multi-megabyte string (ReDoS / memory DoS)
  for (let i = 0; i < rawData.length; i++) {
    const code = rawData.charCodeAt(i);
    // Skip whitespace (\s): space (32), tab (9), LF (10), CR (13), etc
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      continue;
    }
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
    data += rawData[i];
  }

  return {
    mimeType,
    data,
  };
};
