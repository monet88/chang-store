import type { DB, JobRecord } from '../db.js';
import { runFeatureJob, type RunJobResult } from '../../workflows/feature-runner.js';
import { geminiExecuteStep } from './gemini-executor.js';

interface FeatureAdapter {
  feature: string;
  validate: (payload: unknown) => unknown;
  mapInput: (payload: unknown) => Record<string, unknown>;
  mapOutput: (result: Record<string, unknown>) => Record<string, unknown>;
}

const adapterCache: Record<string, FeatureAdapter> = {};

async function loadAdapter(feature: string): Promise<FeatureAdapter> {
  if (adapterCache[feature]) return adapterCache[feature];

  switch (feature) {
    case 'try-on': {
      const mod = await import('../adapters/virtual-try-on.js');
      adapterCache[feature] = mod as unknown as FeatureAdapter;
      break;
    }
    case 'clothing-transfer': {
      const mod = await import('../adapters/clothing-transfer.js');
      adapterCache[feature] = mod as unknown as FeatureAdapter;
      break;
    }
    case 'lookbook': {
      const mod = await import('../adapters/lookbook.js');
      adapterCache[feature] = mod as unknown as FeatureAdapter;
      break;
    }
    case 'photo-album': {
      const mod = await import('../adapters/photo-album.js');
      adapterCache[feature] = mod as unknown as FeatureAdapter;
      break;
    }
    default:
      throw new Error(`Unknown feature: ${feature}`);
  }

  return adapterCache[feature];
}

export async function executeJob(
  db: DB,
  job: JobRecord,
  traceId: string,
): Promise<RunJobResult> {
  const adapter = await loadAdapter(job.feature);
  return runFeatureJob(db, job, adapter, geminiExecuteStep, traceId);
}
