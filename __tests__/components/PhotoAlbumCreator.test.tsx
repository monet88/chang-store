import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const editImageMock = vi.fn();

const testImage = { base64: 'model-image', mimeType: 'image/png' };

const poseLabels = {
  pose_1: 'Pose 1',
  pose_2: 'Pose 2',
};

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'photoAlbum.poseLabels' && params?.returnObjects) return poseLabels;
      if (key === 'photoAlbum.frames' && params?.returnObjects) return { none: 'None' };
      if (key === 'photoAlbum.backgroundLabels' && params?.returnObjects) return { none: 'None' };
      if (key === 'photoAlbum.hairStyles' && params?.returnObjects) return { long_straight_black: 'Long Straight Black' };
      if (key === 'photoAlbum.skinTones' && params?.returnObjects) return { fair_smooth: 'Fair Smooth' };
      if (key === 'photoAlbum.originalPhoto') return 'Original Photo';
      if (key === 'photoAlbum.mode.fullModel') return 'Full Model';
      if (key === 'photoAlbum.mode.faceAndOutfit') return 'Face and Outfit';
      if (key === 'photoAlbum.generateButton') return `Generate (${params?.count})`;
      if (key === 'photoAlbum.outputTitle') return 'Album Output';
      if (key === 'photoAlbum.startOver') return 'Start Over';
      if (key === 'photoAlbum.description') return 'Description';
      if (key === 'photoAlbum.title') return 'Create Photo Album';
      if (key === 'photoAlbum.choosePoses') return 'Choose Poses';
      if (key === 'photoAlbum.selectAll') return 'Select All';
      if (key === 'photoAlbum.clearSelection') return 'Clear Selection';
      if (key === 'photoAlbum.addons') return 'Add-ons';
      if (key === 'photoAlbum.chooseHair') return 'Hair';
      if (key === 'photoAlbum.chooseFrame') return 'Frame';
      if (key === 'photoAlbum.chooseBackground') return 'Background';
      if (key === 'photoAlbum.additionalNotes') return 'Notes';
      if (key === 'photoAlbum.additionalNotesPlaceholder') return 'Notes placeholder';
      if (key === 'photoAlbum.footwearInstructions') return 'Keep original footwear';
      if (key === 'photoAlbum.generatingStatus') return `Generating ${params?.progress}/${params?.total}`;
      if (key === 'framingInstructions.fullBody') return 'Full body framing';
      return key;
    },
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
  }),
}));

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: (...args: unknown[]) => editImageMock(...args),
}));

vi.mock('../../src/components/ImageUploader', () => ({
  default: ({ id, title, onImageUpload }: { id: string; title: string; onImageUpload: (image: typeof testImage) => void }) => (
    <button type="button" onClick={() => onImageUpload(testImage)}>
      {title}::{id}
    </button>
  ),
}));

vi.mock('../../src/components/Spinner', () => ({
  default: () => <div>spinner</div>,
  ErrorDisplay: ({ title, message }: { title: string; message: string }) => (
    <div>
      {title}:{message}
    </div>
  ),
  ProgressBar: ({ progress, total }: { progress: number; total: number }) => <div>{progress}/{total}</div>,
}));

vi.mock('../../src/components/HoverableImage', () => ({
  default: ({
    altText,
    onRegenerate,
  }: {
    altText: string;
    onRegenerate?: () => void;
  }) => (
    <div>
      <span>{altText}</span>
      {onRegenerate && (
        <button type="button" aria-label={`regenerate-${altText}`} onClick={onRegenerate}>
          regenerate
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../src/components/ImageOptionsPanel', () => ({
  default: () => <div>image-options</div>,
}));

vi.mock('../../src/components/shared/ResultPlaceholder', () => ({
  default: ({ description }: { description: string }) => <div>{description}</div>,
}));

import { PhotoAlbumCreator } from '../../src/components/PhotoAlbumCreator';

describe('PhotoAlbumCreator component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regenerates only the selected album pose result', async () => {
    editImageMock
      .mockResolvedValueOnce([{ base64: 'album-1', mimeType: 'image/png' }])
      .mockResolvedValueOnce([{ base64: 'album-2', mimeType: 'image/png' }])
      .mockResolvedValueOnce([{ base64: 'album-1b', mimeType: 'image/png' }]);

    const user = userEvent.setup();

    render(<PhotoAlbumCreator />);

    await user.click(screen.getByRole('button', { name: 'Original Photo::pa-original' }));
    await user.click(screen.getByLabelText('Pose 1'));
    await user.click(screen.getByLabelText('Pose 2'));
    await user.click(screen.getByRole('button', { name: 'Generate (2)' }));

    await waitFor(() => expect(editImageMock).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('Pose 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pose 2').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'regenerate-Pose 1' }));

    await waitFor(() => expect(editImageMock).toHaveBeenCalledTimes(3));
    expect(editImageMock.mock.calls[2]?.[0]).toMatchObject({
      images: [testImage],
      numberOfImages: 1,
    });
    expect(editImageMock.mock.calls[2]?.[0]?.prompt).toContain('Standing straight, facing camera, arms relaxed');
  });
});
