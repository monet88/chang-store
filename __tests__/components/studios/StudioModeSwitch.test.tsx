import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'studio.switch.label': 'Studio',
        'studio.switch.gemini': 'Gemini',
        'studio.switch.grok': 'Grok',
        'studio.switch.gptImage': 'GPT',
      };
      return translations[key] ?? key;
    },
  }),
}));

import StudioModeSwitch from '../../../src/components/studios/StudioModeSwitch';

describe('StudioModeSwitch', () => {
  it('renders three studio segments', () => {
    render(<StudioModeSwitch studioMode="gemini" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Gemini' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grok' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'GPT' })).toBeInTheDocument();
  });

  it('marks the active segment as checked', () => {
    render(<StudioModeSwitch studioMode="grok" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Grok' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Gemini' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the selected mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StudioModeSwitch studioMode="gemini" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'GPT' }));

    expect(onChange).toHaveBeenCalledWith('gptImage');
  });
});
