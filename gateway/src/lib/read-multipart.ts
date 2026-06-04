import type { IncomingMessage } from 'node:http';
import { GatewayError } from '../http/error-response.js';

export interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

const parseContentDisposition = (value: string): { name?: string; filename?: string } => ({
  ...(value.match(/name="([^"]+)"/i)?.[1] ? { name: value.match(/name="([^"]+)"/i)?.[1] } : {}),
  ...(value.match(/filename="([^"]*)"/i)?.[1] ? { filename: value.match(/filename="([^"]*)"/i)?.[1] } : {}),
});

export const readMultipartBody = async (
  req: IncomingMessage,
  maxBytes: number,
): Promise<MultipartPart[]> => {
  const contentType = req.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.includes('multipart/form-data')) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'Expected multipart/form-data.');
  }
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'Multipart boundary is required.');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new GatewayError(413, 'PAYLOAD_TOO_LARGE', 'Multipart payload exceeds gateway byte limit.');
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('latin1');
  const boundary = `--${boundaryMatch[1]}`;
  const segments = raw.split(boundary)
    .slice(1, -1)
    .map((segment) => segment.replace(/^\r\n/, '').replace(/\r\n$/, ''));

  const parts: MultipartPart[] = [];
  for (const segment of segments) {
    const headerEnd = segment.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerText = segment.slice(0, headerEnd);
    const bodyText = segment.slice(headerEnd + 4);
    const headers = Object.fromEntries(
      headerText.split('\r\n').map((line) => {
        const [name, ...rest] = line.split(':');
        return [name.trim().toLowerCase(), rest.join(':').trim()];
      }),
    );
    if (typeof headers['content-disposition'] !== 'string') continue;
    const disposition = parseContentDisposition(headers['content-disposition']);
    if (!disposition.name) continue;
    parts.push({
      name: disposition.name,
      ...(disposition.filename ? { filename: disposition.filename } : {}),
      ...(typeof headers['content-type'] === 'string' ? { contentType: headers['content-type'] } : {}),
      data: Buffer.from(bodyText, 'latin1'),
    });
  }
  return parts;
};
