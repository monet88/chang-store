/**
 * Integration Tests for Upscale Component
 *
 * Tests the thin workspace coordinator to verify:
 * 1. Renders all child components correctly
 * 2. Mode switching works via the UI
 * 3. Session image rail appears after upload
 * 4. Quick Upscale and AI Studio panels swap correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Import component after mocks
import Upscale from '../../components/Upscale';

// ============================================================================
// Test Suite
// ============================================================================

describe('Upscale Component', () => {
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

  it('should render title and description', () => {
    render(<Upscale />);

    expect(screen.getByText('upscale.title')).toBeInTheDocument();
    expect(screen.getByText('upscale.description')).toBeInTheDocument();
  });

  it('should render mode switch with Quick Upscale and AI Studio', () => {
    render(<Upscale />);

    expect(screen.getByText('upscale.modeQuick')).toBeInTheDocument();
    expect(screen.getByText('upscale.modeStudio')).toBeInTheDocument();
  });

  it('should start in Quick Upscale mode', () => {
    render(<Upscale />);

    const quickButton = screen.getByText('upscale.modeQuick').closest('button');
    expect(quickButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should switch to AI Studio mode when clicked', () => {
    render(<Upscale />);

    const studioButton = screen.getByText('upscale.modeStudio').closest('button');
    fireEvent.click(studioButton!);

    expect(studioButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should show upload prompt when no images', () => {
    render(<Upscale />);

    // Quick Upscale panel should show the uploader
    expect(screen.getByText('upscale.uploadTitle')).toBeInTheDocument();
  });

  it('should show output placeholder when no result', () => {
    render(<Upscale />);

    expect(screen.getByText('upscale.outputPanelDescription')).toBeInTheDocument();
  });

  it('should show AI Studio step shell when in studio mode', () => {
    render(<Upscale />);

    // Switch to studio
    const studioButton = screen.getByText('upscale.modeStudio').closest('button');
    fireEvent.click(studioButton!);

    // AI Studio steps should appear
    expect(screen.getByText('upscale.studioUploadFirst')).toBeInTheDocument();
  });

  it('should show studio steps header in studio mode', () => {
    render(<Upscale />);

    const studioButton = screen.getByText('upscale.modeStudio').closest('button');
    fireEvent.click(studioButton!);

    // Step labels should be visible (at least on sm+ screens)
    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('✨')).toBeInTheDocument();
    expect(screen.getByText('📦')).toBeInTheDocument();
  });
});
