import { GatewayError } from '../http/error-response.js';

export const parseImageDataUrl = (
  value: string,
  invalidMessage: string,
): { mimeType: string; data: string } => {
  if (value.substring(0, 5).toLowerCase() !== 'data:') {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const commaIdx = value.indexOf(',', 5);
  if (commaIdx === -1 || value.substring(commaIdx - 7, commaIdx).toLowerCase() !== ';base64') {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  const suffixIdx = commaIdx - 7;
  const mimeType = value.substring(5, suffixIdx);
  const rawData = value.substring(commaIdx + 1);

  if (!mimeType) {
    throw new GatewayError(400, 'VALIDATION_FAILED', invalidMessage);
  }

  let data = '';
  let hasWhitespace = false;
  let chunkStart = 0;

  for (let i = 0; i < rawData.length; i++) {
    const code = rawData.charCodeAt(i);
    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13;

    if (isWhitespace) {
      if (!hasWhitespace) hasWhitespace = true;
      if (i > chunkStart) {
        data += rawData.substring(chunkStart, i);
      }
      chunkStart = i + 1;
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
  }

  if (hasWhitespace) {
    if (chunkStart < rawData.length) {
      data += rawData.substring(chunkStart);
    }
  } else {
    data = rawData;
  }

  return {
    mimeType,
    data,
  };
};
