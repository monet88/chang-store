import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockUseImageEngine, mockUseLanguage } from '../../__mocks__/contexts';

vi.mock('@/contexts/LanguageContext', () => mockUseLanguage());

const { setAspectRatio, setQuality, sizeFor } = vi.hoisted(() => ({
  setAspectRatio: vi.fn(),
  setQuality: vi.fn(),
  sizeFor: vi.fn((ratio: string) => (ratio === '9:16' ? '1080x1920' : '1024x1024')),
}));

vi.mock('@/contexts/ImageEngineContext', () => mockUseImageEngine({
  id: 'gptImage',
  options: {
    ratios: ['1:1', '3:4', '9:16'],
    quality: 'high',
    setQuality,
    qualityOptions: ['low', 'medium', 'high', 'auto'],
    sizeFor,
    supportsQuality: true,
  },
}));

import GptImageOptionsPanel from '@/components/studios/GptImageOptionsPanel';

describe('GptImageOptionsPanel', () => {
  it('offers only the ratios the studio supports and reports the size each maps to', () => {
    render(<GptImageOptionsPanel aspectRatio="3:4" setAspectRatio={setAspectRatio} />);

    const options = screen.getAllByRole('radio').map((input) => (input as HTMLInputElement).value);
    expect(options).toEqual(['Default', '1:1', '3:4', '9:16']);
    expect(screen.queryByRole('radio', { name: '4:3' })).toBeNull();
    expect(screen.getByText('1024x1024')).toBeInTheDocument();
  });

  it('maps the chosen ratio to the size the gateway honors', async () => {
    render(<GptImageOptionsPanel aspectRatio="3:4" setAspectRatio={setAspectRatio} />);

    await userEvent.click(screen.getByRole('radio', { name: '9:16' }));

    expect(setAspectRatio).toHaveBeenCalledWith('9:16');
  });

  it('lets the user pick a quality and sends the chosen value', async () => {
    render(<GptImageOptionsPanel aspectRatio="3:4" setAspectRatio={setAspectRatio} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'low');

    expect(setQuality).toHaveBeenCalledWith('low');
  });

  it('renders a slider when numImages and setNumImages are provided', async () => {
    const setNumImages = vi.fn();
    render(
      <GptImageOptionsPanel
        aspectRatio="3:4"
        setAspectRatio={setAspectRatio}
        numImages={2}
        setNumImages={setNumImages}
      />,
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('2');
  });
});
