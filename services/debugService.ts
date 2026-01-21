const STORAGE_KEY = 'chang-store-debug';

export type Provider = 'Gemini' | 'Local';

export interface ApiCallLog {
  provider: Provider;
  model: string;
  feature: string;
  prompt?: string;
  duration: number;
  status: 'pending' | 'success' | 'error';
  responseSize?: number;
  error?: string;
}

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setDebugEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function logApiCall(log: ApiCallLog): void {
  if (!isDebugEnabled()) return;

  try {
    const statusIcon = log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '⏳';

    console.group(`[ChangStore] ${log.feature} - ${log.provider}`);
    console.log('Model:', log.model);
    if (log.prompt) {
      const truncatedPrompt = log.prompt.length > 100 ? log.prompt.slice(0, 100) + '...' : log.prompt;
      console.log('Prompt:', truncatedPrompt);
    }
    console.log('Duration:', (log.duration / 1000).toFixed(2) + 's');
    if (log.responseSize) {
      console.log('Response:', (log.responseSize / 1024 / 1024).toFixed(2) + ' MB');
    }
    console.log('Status:', statusIcon, log.status);
    if (log.error) {
      console.error('Error:', log.error);
    }
    console.groupEnd();
  } catch (e) {
    console.groupEnd();
    console.error('[ChangStore] Debug log error:', e, 'Log data:', log);
  }
}
