import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'navigation.workspaceEyebrow': 'Workspace',
        'navigation.toolsEyebrow': 'Tool clusters',
        'navigation.mediaFirstLabel': 'Media-first',
        'navigation.language': 'Language',
        'navigation.closeMenu': 'Close workspace menu',
        'header.title': 'Virtual Fashion Studio',
        'header.description': 'A cinematic AI workspace.',
        'studio.switch.label': 'Studio',
        'studio.switch.gemini': 'Gemini',
        'studio.switch.grok': 'Grok',
        'studio.switch.gptImage': 'GPT Image',
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../src/components/LanguageSwitcher', () => ({
  default: () => <div>language-switcher</div>,
}));

vi.mock('../../src/components/Tabs', () => ({
  default: () => <div>tabs</div>,
}));

import Header from '../../src/components/Header';
import { Feature } from '../../src/types';

describe('Header', () => {
  it('renders the editorial workspace rail and navigation surface', () => {
    render(
      <Header
        activeFeature={Feature.TryOn}
        setActiveFeature={vi.fn()}
        isOpen
        onClose={vi.fn()}
        studioMode="gemini"
        onStudioModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Virtual Fashion Studio')).toBeInTheDocument();
    expect(screen.getByText('A cinematic AI workspace.')).toBeInTheDocument();
    expect(screen.getByText('tabs')).toBeInTheDocument();
    expect(screen.getByText('language-switcher')).toBeInTheDocument();
  });
});
