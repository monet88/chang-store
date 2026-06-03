import { readFileSync } from 'node:fs';
import type { GatewayConfig } from '../config/env.js';

export interface ServiceAccountCredential {
  type: 'service_account';
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface GoogleAuthStatus {
  mode: 'adc' | 'serviceAccountJson';
  project: string;
  location: string;
  apiVersion: string;
  hasGoogleCredentialsFile: boolean;
  email?: string;
}

const readCredentialJson = (credentialsFile: string): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(credentialsFile, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Vertex credential JSON is not readable: ${message}`);
  }
};

export const loadServiceAccountCredential = (
  credentialsFile: string | null,
): ServiceAccountCredential | null => {
  if (!credentialsFile) {
    return null;
  }

  const credential = readCredentialJson(credentialsFile);
  if (credential.installed || credential.web) {
    throw new Error('Vertex credential JSON must be a Google service account key, not an OAuth installed/web client JSON.');
  }

  const type = credential.type;
  const projectId = credential.project_id;
  const clientEmail = credential.client_email;
  const privateKey = credential.private_key;
  if (type !== 'service_account') {
    throw new Error('Vertex credential JSON must include type: service_account.');
  }
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw new Error('Vertex service account JSON is missing project_id.');
  }
  if (typeof clientEmail !== 'string' || clientEmail.trim() === '') {
    throw new Error('Vertex service account JSON is missing client_email.');
  }
  if (typeof privateKey !== 'string' || privateKey.trim() === '') {
    throw new Error('Vertex service account JSON is missing private_key.');
  }

  return {
    type,
    project_id: projectId.trim(),
    client_email: clientEmail.trim(),
    private_key: privateKey,
  };
};

export const getGoogleAuthStatus = (config: GatewayConfig): GoogleAuthStatus => {
  const serviceAccount = loadServiceAccountCredential(config.googleCredentialsFile);
  return {
    mode: serviceAccount ? 'serviceAccountJson' : 'adc',
    project: serviceAccount?.project_id ?? config.googleProject,
    location: config.googleLocation,
    apiVersion: config.googleApiVersion,
    hasGoogleCredentialsFile: Boolean(config.googleCredentialsFile),
    ...(serviceAccount && { email: serviceAccount.client_email }),
  };
};
