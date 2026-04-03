import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const editImageMock = vi.fn();
const upscaleImageMock = vi.fn();
const generatePoseDescriptionMock = vi.fn();

const testImage = { base64: 'subject-image', mimeType: 'image/png' };

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'pose.browseLibraryButton') return 'Browse Library';
      if (key === 'pose.generateMultipleButton') return `Generate ${params?.count} Poses`;
      if (key === 'pose.generateOneButton') return 'Generate 1 Pose';
      if (key === 'pose.generateButton') return 'Generate Pose';
      if (key === 'pose.generatedPoseAlt') return `Generated pose ${params?.index}`;
      if (key === 'pose.subjectUploadTitle') return 'Subject Image';
      if (key === 'pose.referenceUploadTitle') return 'Pose Reference';
      if (key === 'pose.customPoseLabel') return 'Custom pose';
      if (key === 'cameraView.options.default') return 'Default';
      if (key === 'cameraView.options.fullBody') return 'Full Body';
      if (key === 'cameraView.options.halfBody') return 'Half Body';
      if (key === 'cameraView.options.kneesUp') return 'Knees Up';
      if (key === 'framingInstructions.fullBody') return 'Full body framing';
      if (key === 'pose.generatingStatusMultiple') return `Generating ${params?.progress}/${params?.total}`;
      return key;
    },
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
    textGenerateModel: 'gemini-2.5-pro',
  }),
}));

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: (...args: unknown[]) => editImageMock(...args),
  upscaleImage: (...args: unknown[]) => upscaleImageMock(...args),
}));

vi.mock('../../src/services/textService', () => ({
  generatePoseDescription: (...args: unknown[]) => generatePoseDescriptionMock(...args),
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

import PoseChanger from '../../src/components/PoseChanger';

describe('PoseChanger component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regenerates only the selected pose result instead of rerunning the full batch', async () => {
    editImageMock
      .mockResolvedValueOnce([{ base64: 'result-1', mimeType: 'image/png' }])
      .mockResolvedValueOnce([{ base64: 'result-2', mimeType: 'image/png' }])
      .mockResolvedValueOnce([{ base64: 'result-1b', mimeType: 'image/png' }]);

    const user = userEvent.setup();
    const onOpenPoseLibrary = vi.fn((onConfirm: (poses: string[]) => void) => {
      onConfirm(['pose one', 'pose two']);
    });

    render(<PoseChanger onOpenPoseLibrary={onOpenPoseLibrary} />);

    await user.click(screen.getByRole('button', { name: 'Subject Image::pose-subject-upload' }));
    await user.click(screen.getByRole('button', { name: 'Browse Library' }));
    await user.click(screen.getByRole('button', { name: 'Generate 2 Poses' }));

    await waitFor(() => expect(editImageMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Generated pose 1')).toBeInTheDocument();
    expect(screen.getByText('Generated pose 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'regenerate-Generated pose 1' }));

    await waitFor(() => expect(editImageMock).toHaveBeenCalledTimes(3));
    expect(editImageMock.mock.calls[2]?.[0]).toMatchObject({
      images: [testImage],
      numberOfImages: 1,
    });
    expect(editImageMock.mock.calls[2]?.[0]?.prompt).toContain('"pose one"');
  });
});
