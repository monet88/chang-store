import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'studio.settings.title': 'Settings',
        'studio.settings.reset': 'Reset',
        'studio.settings.baseUrlLabel': 'Base URL',
        'studio.settings.apiKeyLabel': 'API key',
        'studio.settings.apiKeyPlaceholder': 'Enter your API key',
        'studio.settings.apiKeyHint': 'Stored locally.',
        'studio.settings.showKey': 'Show',
        'studio.settings.hideKey': 'Hide',
        'studio.settings.urlInvalid': 'Enter a valid URL.',
        'studio.settings.urlCustomWarning': `Warning: key sent to ${params?.host ?? ''}.`,
      };
      return translations[key] ?? key;
    },
  }),
}));

import ProviderSettingsPanel from '@/components/studios/provider-studio/ProviderSettingsPanel';

const baseProps = {
  providerLabel: 'Grok',
  apiKey: 'secret-key',
  baseUrl: 'https://api.x.ai/v1',
  onApiKeyChange: vi.fn(),
  onBaseUrlChange: vi.fn(),
  onReset: vi.fn(),
};

describe('ProviderSettingsPanel', () => {
  it('renders base URL and API key inputs', () => {
    render(<ProviderSettingsPanel {...baseProps} />);
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.x.ai/v1');
    expect(screen.getByLabelText('API key')).toHaveValue('secret-key');
  });

  it('masks the API key by default and toggles visibility', async () => {
    const user = userEvent.setup();
    render(<ProviderSettingsPanel {...baseProps} />);

    const keyInput = screen.getByLabelText('API key');
    expect(keyInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(keyInput).toHaveAttribute('type', 'text');
  });

  it('warns when the base URL targets a custom (non-allowlisted) domain', () => {
    render(<ProviderSettingsPanel {...baseProps} baseUrl="https://proxy.evil.com/v1" />);
    expect(screen.getByText(/Warning: key sent to proxy.evil.com/)).toBeInTheDocument();
  });

  it('treats an http base URL (local proxy) as a custom domain, not an error', () => {
    render(<ProviderSettingsPanel {...baseProps} baseUrl="http://localhost:8333/v1" />);
    expect(screen.queryByText('Enter a valid URL.')).not.toBeInTheDocument();
    expect(screen.getByText(/Warning: key sent to localhost/)).toBeInTheDocument();
  });

  it('treats an http base URL on a public host as a custom domain, not an error', () => {
    render(<ProviderSettingsPanel {...baseProps} baseUrl="http://proxy.evil.com/v1" />);
    expect(screen.queryByText('Enter a valid URL.')).not.toBeInTheDocument();
    expect(screen.getByText(/Warning: key sent to proxy.evil.com/)).toBeInTheDocument();
  });

  it('invokes callbacks on input and reset', async () => {
    const user = userEvent.setup();
    const onApiKeyChange = vi.fn();
    const onReset = vi.fn();
    render(
      <ProviderSettingsPanel
        {...baseProps}
        apiKey=""
        onApiKeyChange={onApiKeyChange}
        onReset={onReset}
      />,
    );

    await user.type(screen.getByLabelText('API key'), 'x');
    expect(onApiKeyChange).toHaveBeenCalledWith('x');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalled();
  });
});
