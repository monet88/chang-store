import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'navigation.createLooks.label': 'Create looks',
        'navigation.createLooks.description': 'Create description',
        'navigation.editImages.label': 'Edit images',
        'navigation.editImages.description': 'Edit description',
        'navigation.outputStudio.label': 'Output studio',
        'navigation.outputStudio.description': 'Output description',
        'tabs.tryOn': 'Virtual Try-On',
        'tabs.lookbook': 'Lookbook AI',
        'tabs.clothingTransfer': 'Clothing Transfer',
        'tabs.patternGenerator': 'Pattern Generator',
        'tabs.aiEditor': 'AI Editor',
        'tabs.background': 'Backgrounds',
        'tabs.pose': 'Pose AI',
        'tabs.watermarkRemover': 'Watermark Remover',
        'tabs.photoAlbum': 'Photo Album',
      };

      return translations[key] ?? key;
    },
  }),
}));

import Tabs from '../../src/components/Tabs';
import { Feature } from '../../src/types';

describe('Tabs', () => {
  it('renders migrated workflow groups and switches features', async () => {
    const user = userEvent.setup();
    const setActiveFeature = vi.fn();

    render(
      <Tabs
        activeFeature={Feature.TryOn}
        setActiveFeature={setActiveFeature}
      />,
    );

    expect(screen.getByText('Create looks')).toBeInTheDocument();
    expect(screen.getByText('Edit images')).toBeInTheDocument();
    expect(screen.getByText('Output studio')).toBeInTheDocument();

    const tabButtons = screen.getAllByRole('button');
    expect(tabButtons).toHaveLength(9);

    await user.click(screen.getByRole('button', { name: /Lookbook AI/i }));
    expect(setActiveFeature).toHaveBeenCalledWith(Feature.Lookbook);

    await user.click(screen.getByRole('button', { name: /Photo Album/i }));
    expect(setActiveFeature).toHaveBeenCalledWith(Feature.PhotoAlbum);
  });
});
