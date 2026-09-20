import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Feature } from '../../../src/types';
import { mockUseImageEngine, mockUseLanguage } from '../../__mocks__/contexts';

vi.mock('@/contexts/LanguageContext', () => mockUseLanguage());
vi.mock('@/components/VirtualTryOn', () => ({ default: () => <div data-testid="view-try-on" /> }));
vi.mock('@/components/LookbookGenerator', () => ({ default: () => <div data-testid="view-lookbook" /> }));
vi.mock('@/components/ClothingTransfer', () => ({ default: () => <div data-testid="view-clothing-transfer" /> }));
vi.mock('@/components/studios/GptAIEditor', () => ({ default: () => <div data-testid="view-ai-editor" /> }));
vi.mock('@/components/IdentityTransfer', () => ({ default: () => <div data-testid="view-identity-transfer" /> }));

vi.mock('@/contexts/ImageEngineContext', () => mockUseImageEngine({
  id: 'gptImage',
  model: 'gpt-image-2',
  setModel: vi.fn(),
  modelOptions: [
    { modelId: 'gpt-image-2', label: 'GPT Image 2' },
    { modelId: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', disabled: true },
  ],
}));

import GptStudio from '@/components/studios/GptStudio';

const onSendToFeature = vi.fn();

describe('GptStudio', () => {
  it.each([
    [Feature.TryOn, 'view-try-on'],
    [Feature.Lookbook, 'view-lookbook'],
    [Feature.ClothingTransfer, 'view-clothing-transfer'],
    [Feature.AIEditor, 'view-ai-editor'],
    [Feature.IdentityTransfer, 'view-identity-transfer'],
  ])('renders the active feature for %s', (feature, testId) => {
    render(<GptStudio activeFeature={feature} onSendToFeature={onSendToFeature} />);

    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('offers the models the active gateway serves', () => {
    render(<GptStudio activeFeature={Feature.TryOn} onSendToFeature={onSendToFeature} />);

    const selector = screen.getByRole('combobox');
    expect(selector).toHaveValue('gpt-image-2');
    expect(screen.getByRole('option', { name: /Sunburst/ })).toBeDisabled();
  });
});
