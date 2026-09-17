import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import ResolutionSelector from '@/components/ResolutionSelector';
import { LanguageProvider } from '@/contexts/LanguageContext';

describe('ResolutionSelector', () => {
  it('exposes the selected resolution and native keyboard behavior', async () => {
    const user = userEvent.setup();
    const setResolution = vi.fn();

    render(
      <ResolutionSelector
        resolution="2K"
        setResolution={setResolution}
        model="gemini-3.1-flash-image"
      />,
      { wrapper: LanguageProvider },
    );

    expect(screen.getByRole('radiogroup', { name: 'Chất lượng:' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2K', checked: true })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1K', checked: false })).toBeInTheDocument();

    screen.getByRole('radio', { name: '2K' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(setResolution).toHaveBeenCalledWith('4K');
  });
});
