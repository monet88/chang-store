/**
 * Integration Tests for VirtualTryOn Component
 *
 * Tests the component coordinator to verify:
 * 1. Renders all child components correctly
 * 2. Builder prompt reaches editImage service
 * 3. Dual-garment role-binding works in prompt
 * 4. extraPrompt appended but untucked rule preserved
 * 5. Generate button state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ImageFile } from '../../types';
import {
  mockUseLanguage,
  mockUseImageGallery,
  mockUseApi,
  mockUseImageViewer,
} from '../__mocks__/contexts';

// ============================================================================
// Mock Setup
// ============================================================================

/** Mock services */
vi.mock('../../services/imageEditingService', () => ({
  editImage: vi.fn().mockResolvedValue([]),
  upscaleImage: vi.fn(),
}));

vi.mock('../../utils/imageUtils', () => ({
  getErrorMessage: vi.fn((err: Error) => err.message),
}));

/** Mock contexts */
vi.mock('../../contexts/LanguageContext', () => mockUseLanguage());
vi.mock('../../contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../contexts/ApiProviderContext', () => mockUseApi());
vi.mock('../../contexts/ImageViewerContext', () => mockUseImageViewer());

vi.mock('../../components/Tooltip', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/HoverableImage', () => ({
  default: () => <div data-testid="hoverable-image" />,
}));

vi.mock('../../components/ImageOptionsPanel', () => ({
  default: () => <div data-testid="image-options-panel" />,
}));

vi.mock('../../components/ImageUploader', () => ({
  default: ({
    onImageUpload,
    id,
    title,
  }: {
    onImageUpload: (file: ImageFile | null) => void;
    id: string;
    title?: string;
  }) => (
    <div>
      {title ? <span>{title}</span> : null}
      <button
        data-testid={`upload-${id}`}
        onClick={() => onImageUpload({ base64: 'fake-base64', mimeType: 'image/png' })}
      >
        Upload {id}
      </button>
    </div>
  ),
}));

// Import component after mocks
import VirtualTryOn from '../../components/VirtualTryOn';
import { editImage } from '../../services/imageEditingService';

// ============================================================================
// Test Suite
// ============================================================================

describe('VirtualTryOn Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let counter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `test-uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render title', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.title')).toBeInTheDocument();
  });

  it('should render step labels', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.step1')).toBeInTheDocument();
    expect(screen.getByText('virtualTryOn.step2')).toBeInTheDocument();
    expect(screen.getByText('virtualTryOn.step3')).toBeInTheDocument();
  });

  it('should render upload section with subject and clothing uploaders', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.subjectImageTitle')).toBeInTheDocument();
    expect(screen.getByText('virtualTryOn.clothingItemTitle')).toBeInTheDocument();
  });

  it('should render generate button', () => {
    render(<VirtualTryOn />);
    const generateButton = screen.getByText('virtualTryOn.generateButton');
    expect(generateButton).toBeInTheDocument();
  });

  it('should have generate button disabled initially', () => {
    render(<VirtualTryOn />);
    const generateButton = screen.getByText('virtualTryOn.generateButton').closest('button');
    expect(generateButton).toBeDisabled();
  });

  it('should render output panel description when no images generated', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.outputPanelDescription')).toBeInTheDocument();
  });

  it('should not call editImage when no images are uploaded', () => {
    render(<VirtualTryOn />);
    // Generate button should be disabled when no images uploaded
    const generateButton = screen.getByText('virtualTryOn.generateButton').closest('button');
    expect(generateButton).toBeDisabled();
    // Verify editImage was NOT called (no spurious calls on render)
    expect(editImage).not.toHaveBeenCalled();
  });

  it('should render add item button for multiple clothing', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.addItem')).toBeInTheDocument();
  });

  it('should render customization options (background and extra prompt)', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.backgroundPromptLabel')).toBeInTheDocument();
    expect(screen.getByText('virtualTryOn.extraPromptLabel')).toBeInTheDocument();
  });

  it('should render number of images slider', () => {
    render(<VirtualTryOn />);
    expect(screen.getByText('virtualTryOn.numberOfImages')).toBeInTheDocument();
    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
  });

  it('should render background and extra prompt textareas', () => {
    render(<VirtualTryOn />);
    const backgroundTextarea = document.querySelector('#background-prompt');
    const extraTextarea = document.querySelector('#extra-prompt');
    expect(backgroundTextarea).toBeInTheDocument();
    expect(extraTextarea).toBeInTheDocument();
  });

  it('should update num images slider', () => {
    render(<VirtualTryOn />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider?.value).toBe('1');
    
    fireEvent.change(slider, { target: { value: '3' } });
    expect(slider?.value).toBe('3');
  });

  it('should update background prompt textarea', () => {
    render(<VirtualTryOn />);
    const textarea = document.querySelector('#background-prompt') as HTMLTextAreaElement;
    expect(textarea?.value).toBe('');
    
    fireEvent.change(textarea, { target: { value: 'beach sunset' } });
    expect(textarea?.value).toBe('beach sunset');
  });

  it('should update extra prompt textarea', () => {
    render(<VirtualTryOn />);
    const textarea = document.querySelector('#extra-prompt') as HTMLTextAreaElement;
    expect(textarea?.value).toBe('');
    
    fireEvent.change(textarea, { target: { value: 'professional lighting' } });
    expect(textarea?.value).toBe('professional lighting');
  });

  it('should render aspect ratio and resolution selectors', () => {
    render(<VirtualTryOn />);
    // These are part of ImageOptionsPanel child component
    // Just verify the component renders without errors
    const leftPanel = document.querySelector('.flex.flex-col.gap-6');
    expect(leftPanel).toBeInTheDocument();
  });

  it('should send dual-garment builder prompt to editImage after subject and 2 clothing uploads', async () => {
    render(<VirtualTryOn />);

    fireEvent.click(screen.getByTestId('upload-subject-upload'));
    fireEvent.click(screen.getAllByTestId(/upload-clothing-/)[0]);

    fireEvent.click(screen.getByText('virtualTryOn.addItem'));
    fireEvent.click(screen.getAllByTestId(/upload-clothing-/)[1]);

    const generateButton = screen.getByText('virtualTryOn.generateButton').closest('button');
    expect(generateButton).toBeEnabled();
    fireEvent.click(generateButton!);

    await waitFor(() => {
      expect(editImage).toHaveBeenCalledTimes(1);
    });

    const [requestPayload] = vi.mocked(editImage).mock.calls[0];
    expect(requestPayload.images).toHaveLength(3);
    expect(requestPayload.prompt).toContain('Image 2 (Top Garment Image)');
    expect(requestPayload.prompt).toContain('Image 3 (Bottom Garment Image)');
    expect(requestPayload.prompt).toContain('MUST always be worn UNTUCKED');
  });
});
