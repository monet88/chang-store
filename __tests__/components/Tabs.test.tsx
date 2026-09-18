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
        'tabs.identityTransfer': 'Identity Transfer',
        'studio.provider.featuresLabel': 'Features',
        'studio.provider.featuresDescription': 'Features description',
      };

      return translations[key] ?? key;
    },
  }),
}));

import Tabs from '../../src/components/Tabs';
import { Feature } from '../../src/types';

describe('Tabs', () => {
  it('renders workflow groups and switches features', async () => {
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
    expect(tabButtons).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: /Identity Transfer/i }));
    expect(setActiveFeature).toHaveBeenCalledWith(Feature.IdentityTransfer);

    await user.click(screen.getByRole('button', { name: /Lookbook AI/i }));
    expect(setActiveFeature).toHaveBeenCalledWith(Feature.Lookbook);

    await user.click(screen.getByRole('button', { name: /Watermark Remover/i }));
    expect(setActiveFeature).toHaveBeenCalledWith(Feature.WatermarkRemover);
  });

  it('lists the five GPT studio workflows and no Gemini-only one', () => {
    render(<Tabs activeFeature={Feature.TryOn} setActiveFeature={vi.fn()} studioMode="gptImage" />);

    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual([
      'Virtual Try-On',
      'Lookbook AI',
      'Clothing Transfer',
      'Identity Transfer',
      'AI Editor',
    ]);
  });
});
