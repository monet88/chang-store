import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'workspace.utility.title': 'Studio utilities',
        'workspace.utility.description': 'Open your archive, saved prompts, and workspace settings.',
        'workspace.utility.settings': 'Settings',
        'workspace.utility.expand': 'Expand studio utilities',
        'workspace.utility.collapse': 'Collapse studio utilities',
        'tooltips.headerSettings': 'Open settings',
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../src/components/GalleryButton', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      gallery-action
    </button>
  ),
}));

vi.mock('../../src/components/PromptLibraryFAB', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      prompt-action
    </button>
  ),
}));

import UtilityDock from '../../src/components/UtilityDock';

describe('UtilityDock', () => {
  it('stays collapsed by default, expands vertically, and fires callbacks', async () => {
    const user = userEvent.setup();
    const onOpenGallery = vi.fn();
    const onOpenPromptLibrary = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <UtilityDock
        onOpenGallery={onOpenGallery}
        onOpenPromptLibrary={onOpenPromptLibrary}
        onOpenSettings={onOpenSettings}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Expand studio utilities' });

    expect(screen.getByText('Studio utilities')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Open your archive, saved prompts, and workspace settings.')).not.toBeInTheDocument();
    expect(screen.queryByText('gallery-action')).not.toBeInTheDocument();
    expect(screen.queryByText('prompt-action')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Collapse studio utilities' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Open your archive, saved prompts, and workspace settings.')).toBeInTheDocument();
    expect(screen.getByText('gallery-action')).toBeInTheDocument();
    expect(screen.getByText('prompt-action')).toBeInTheDocument();
    expect(screen.getAllByText('Settings')[0]).toBeInTheDocument();

    await user.click(screen.getByText('gallery-action'));
    await user.click(screen.getByText('prompt-action'));
    await user.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(onOpenGallery).toHaveBeenCalledTimes(1);
    expect(onOpenPromptLibrary).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
