import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getGoogleAuthStatus, loadServiceAccountCredential } from '../src/auth/google-auth.js';
import { testConfig } from './test-config.js';

describe('google auth status', () => {
  const writeCredential = (body: Record<string, unknown>) => {
    const dir = join(tmpdir(), `chang-store-gateway-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'vertex-account.json');
    writeFileSync(file, JSON.stringify(body));
    return file;
  };

  it('keeps browser gateway auth separate from Google server auth', () => {
    const credentialFile = writeCredential({
      type: 'service_account',
      project_id: 'service-project',
      client_email: 'svc@example.test',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
    });

    expect(getGoogleAuthStatus(testConfig({
      gatewayKeys: ['browser-facing-gateway-key'],
      googleCredentialsFile: credentialFile,
    }))).toEqual({
      mode: 'serviceAccountJson',
      project: 'service-project',
      location: 'us-central1',
      apiVersion: 'v1',
      hasGoogleCredentialsFile: true,
      email: 'svc@example.test',
    });
  });

  it('rejects OAuth client JSON because Vertex needs service account credentials', () => {
    const credentialFile = writeCredential({
      installed: {
        client_id: 'client-id',
        client_secret: 'client-secret',
      },
    });

    expect(() => loadServiceAccountCredential(credentialFile)).toThrow(/service account key/);
  });
});
