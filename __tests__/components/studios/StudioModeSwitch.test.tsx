import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'studio.switch.label': 'Studio',
        'studio.switch.gemini': 'Gemini',
        'studio.switch.gptImage': 'GPT',
        'studio.switch.localQwen': 'Local Qwen',
      };
      return translations[key] ?? key;
    },
  }),
}));

import StudioModeSwitch from '@/components/studios/StudioModeSwitch';
import '@/platform/desktopGateway';

describe('StudioModeSwitch', () => {
  beforeEach(() => {
    delete window.desktopGateway;
    delete window.desktopLocalQwen;
  });
  describe('browser environment', () => {
    it('renders only Gemini and GPT segments in browser mode', () => {
      render(<StudioModeSwitch studioMode="gemini" onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Gemini' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'GPT' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Local Qwen' })).not.toBeInTheDocument();
    });

    it('marks the active segment as checked', () => {
      render(<StudioModeSwitch studioMode="gptImage" onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'GPT' })).toHaveAttribute('aria-checked', 'true');
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

  describe('desktop environment', () => {
    beforeEach(() => {
      window.desktopGateway = {
        storeCredential: vi.fn(),
        removeCredential: vi.fn(),
        clearCredentials: vi.fn(),
        listGatewayModels: vi.fn(),
        geminiGenerateContent: vi.fn(),
        gptImageGenerate: vi.fn(),
        gptImageEdit: vi.fn(),
      };
    });

    it('does not render Local Qwen when only desktopGateway is present without local Qwen bridge', () => {
      render(<StudioModeSwitch studioMode="gemini" onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Gemini' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'GPT' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Local Qwen' })).not.toBeInTheDocument();
    });

    it('renders Gemini, GPT, and Local Qwen segments when desktopLocalQwen bridge exists', () => {
      window.desktopLocalQwen = {
        getStatus: vi.fn(),
        startServer: vi.fn(),
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      render(<StudioModeSwitch studioMode="gemini" onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Gemini' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'GPT' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Local Qwen' })).toBeInTheDocument();
    });

    it('marks localQwen as checked when active and desktopLocalQwen bridge exists', () => {
      window.desktopLocalQwen = {
        getStatus: vi.fn(),
        startServer: vi.fn(),
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      render(<StudioModeSwitch studioMode="localQwen" onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Local Qwen' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: 'Gemini' })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('radio', { name: 'GPT' })).toHaveAttribute('aria-checked', 'false');
    });

    it('calls onChange with localQwen when clicked and desktopLocalQwen bridge exists', async () => {
      window.desktopLocalQwen = {
        getStatus: vi.fn(),
        startServer: vi.fn(),
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<StudioModeSwitch studioMode="gemini" onChange={onChange} />);

      await user.click(screen.getByRole('radio', { name: 'Local Qwen' }));

      expect(onChange).toHaveBeenCalledWith('localQwen');
    });
  });
});
