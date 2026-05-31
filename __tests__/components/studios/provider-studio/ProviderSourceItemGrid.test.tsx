import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageFile } from '../../../../src/types';

vi.mock('../../../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

// Stub the heavy ImageUploader (gallery modal / compression) with a minimal
// control that exposes an "upload" trigger and the title for assertions.
vi.mock('../../../../src/components/ImageUploader', () => ({
  default: ({ image, onImageUpload, title, id }: {
    image: ImageFile | null;
    onImageUpload: (f: ImageFile | null) => void;
    title: string;
    id: string;
  }) => (
    <div data-testid={id}>
      <span>{title}</span>
      <span>{image ? `has:${image.base64}` : 'empty'}</span>
      <button type="button" onClick={() => onImageUpload({ base64: 'NEW', mimeType: 'image/png' })}>
        upload-{id}
      </button>
    </div>
  ),
}));

import ProviderSourceItemGrid from '../../../../src/components/studios/provider-studio/ProviderSourceItemGrid';

const img = (tag: string): ImageFile => ({ base64: tag, mimeType: 'image/png' });

const baseProps = {
  idPrefix: 'grok',
  subjectLabelKey: 'studio.workflows.tryOn.upload',
  maxImages: 5,
  showType: true,
  showNote: true,
  sourceItemTypes: [],
  sourceItemNotes: [],
  onSetSubject: vi.fn(),
  onAddItem: vi.fn(),
  onRemoveItem: vi.fn(),
  onReplaceItem: vi.fn(),
  onTypeChange: vi.fn(),
  onNoteChange: vi.fn(),
};

describe('ProviderSourceItemGrid', () => {
  it('hides the add slot until a subject is uploaded', () => {
    render(<ProviderSourceItemGrid {...baseProps} images={[]} />);
    expect(screen.queryByRole('button', { name: 'upload-grok-source-add' })).not.toBeInTheDocument();
  });

  it('shows the add slot once a subject exists and forwards add', async () => {
    const onAddItem = vi.fn();
    const user = userEvent.setup();
    render(<ProviderSourceItemGrid {...baseProps} images={[img('subject')]} onAddItem={onAddItem} />);

    await user.click(screen.getByRole('button', { name: 'upload-grok-source-add' }));
    expect(onAddItem).toHaveBeenCalledWith({ base64: 'NEW', mimeType: 'image/png' });
  });

  it('renders a card per source image and forwards remove', async () => {
    const onRemoveItem = vi.fn();
    const user = userEvent.setup();
    render(
      <ProviderSourceItemGrid
        {...baseProps}
        images={[img('subject'), img('src0')]}
        sourceItemTypes={['shoes']}
        sourceItemNotes={['white']}
        onRemoveItem={onRemoveItem}
      />,
    );

    // One source card → one remove button (label carries index param).
    await user.click(screen.getByRole('button', { name: /sourceItems\.removeItem/ }));
    expect(onRemoveItem).toHaveBeenCalledWith(0);
  });

  it('hides the add slot at max images', () => {
    render(
      <ProviderSourceItemGrid
        {...baseProps}
        maxImages={2}
        images={[img('subject'), img('src0')]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'upload-grok-source-add' })).not.toBeInTheDocument();
  });
});
