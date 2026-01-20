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

const PROVIDER_STYLES: Record<Provider, string> = {
  Gemini: 'color: #4285f4; font-weight: bold',
  Local: 'color: #10b981; font-weight: bold',
};

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setDebugEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function logApiCall(log: ApiCallLog): void {
  if (!isDebugEnabled()) return;

  const providerStyle = PROVIDER_STYLES[log.provider];
  const statusIcon = log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '⏳';
  const statusColor = log.status === 'success' ? 'color: #10b981' : log.status === 'error' ? 'color: #ef4444' : 'color: #f59e0b';

  console.group(`%c[ChangStore] ${log.feature}`, 'color: #fbbf24; font-weight: bold');
  console.log(`%cProvider: %c${log.provider}`, 'color: #94a3b8', providerStyle);
  console.log(`%cModel: %c${log.model}`, 'color: #94a3b8', 'color: #e2e8f0');
  if (log.prompt) {
    const truncatedPrompt = log.prompt.length > 100 ? log.prompt.slice(0, 100) + '...' : log.prompt;
    console.log(`%cPrompt: %c${truncatedPrompt}`, 'color: #94a3b8', 'color: #e2e8f0');
  }
  console.log(`%c⏱ Duration: %c${(log.duration / 1000).toFixed(2)}s`, 'color: #94a3b8', 'color: #e2e8f0');
  if (log.responseSize) {
    const sizeMB = (log.responseSize / 1024 / 1024).toFixed(2);
    console.log(`%c📦 Response: %c${sizeMB} MB`, 'color: #94a3b8', 'color: #e2e8f0');
  }
  console.log(`%c${statusIcon} ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}`, statusColor);
  if (log.error) {
    console.log(`%cError: %c${log.error}`, 'color: #94a3b8', 'color: #ef4444');
  }
  console.groupEnd();
}
