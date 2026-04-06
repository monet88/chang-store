import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatternGenerator from '../../src/components/PatternGenerator';
import { usePatternGenerator } from '../../src/hooks/usePatternGenerator';

vi.mock('../../src/hooks/usePatternGenerator');
vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
vi.mock('../../src/components/MultiImageUploader', () => ({
  default: () => <div data-testid="multi-image-uploader" />,
}));
vi.mock('../../src/components/HoverableImage', () => ({
  default: ({ altText }: { altText: string }) => <img alt={altText} />,
}));
vi.mock('../../src/components/shared/ResultPlaceholder', () => ({
  default: () => <div data-testid="result-placeholder" />,
}));
vi.mock('../../src/components/Spinner', () => ({
  default: () => <span data-testid="spinner" />,
}));

const setSelectedPatternIndexMock = vi.fn();

const patternOne = { base64: 'pattern-one', mimeType: 'image/png' };
const patternTwo = { base64: 'pattern-two', mimeType: 'image/png' };

const defaultHookReturn = {
  referenceImages: [],
  generatedPatterns: [],
  numImages: 1,
  selectedPatternIndex: 0,
  showTilingPreview: false,
  isLoading: false,
  loadingMessage: '',
  error: null,
  refinePrompt: '',
  isRefining: false,
  canGenerate: false,
  canRefine: false,
  selectedPattern: null,
  setReferenceImages: vi.fn(),
  setNumImages: vi.fn(),
  setSelectedPatternIndex: setSelectedPatternIndexMock,
  setShowTilingPreview: vi.fn(),
  setRefinePrompt: vi.fn(),
  setError: vi.fn(),
  handleGenerate: vi.fn(),
  handleRefine: vi.fn(),
  handleDownloadSelected: vi.fn(),
  handleDownloadAllZip: vi.fn(),
};

describe('PatternGenerator component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSelectedPatternIndexMock.mockReset();
    vi.mocked(usePatternGenerator).mockReturnValue(defaultHookReturn);
  });

  it('renders placeholder when no generated patterns', () => {
    render(<PatternGenerator />);

    expect(screen.getByTestId('result-placeholder')).toBeInTheDocument();
  });

  it('generate button is disabled when canGenerate is false', () => {
    render(<PatternGenerator />);

    expect(screen.getByRole('button', { name: 'patternGenerator.generateButton' })).toBeDisabled();
  });

  it('generate button is enabled when canGenerate is true', () => {
    vi.mocked(usePatternGenerator).mockReturnValue({
      ...defaultHookReturn,
      canGenerate: true,
    });

    render(<PatternGenerator />);

    expect(screen.getByRole('button', { name: 'patternGenerator.generateButton' })).toBeEnabled();
  });

  it('Download All .zip button is not rendered when only 1 pattern', () => {
    vi.mocked(usePatternGenerator).mockReturnValue({
      ...defaultHookReturn,
      generatedPatterns: [patternOne],
      selectedPattern: patternOne,
    });

    render(<PatternGenerator />);

    expect(screen.queryByRole('button', { name: 'patternGenerator.downloadAll' })).toBeNull();
  });

  it('Download All .zip button is enabled when 2+ patterns', () => {
    vi.mocked(usePatternGenerator).mockReturnValue({
      ...defaultHookReturn,
      generatedPatterns: [patternOne, patternTwo],
      selectedPattern: patternOne,
    });

    render(<PatternGenerator />);

    expect(screen.getByRole('button', { name: 'patternGenerator.downloadAll' })).toBeEnabled();
  });

  it('clicking a pattern thumbnail calls setSelectedPatternIndex', async () => {
    const user = userEvent.setup();
    vi.mocked(usePatternGenerator).mockReturnValue({
      ...defaultHookReturn,
      generatedPatterns: [patternOne, patternTwo],
      selectedPattern: patternOne,
    });

    render(<PatternGenerator />);

    const secondPatternButton = screen.getByAltText('Pattern 2').closest('button');
    expect(secondPatternButton).not.toBeNull();

    await user.click(secondPatternButton!);

    expect(setSelectedPatternIndexMock).toHaveBeenCalledWith(1);
  });

  it('tiling preview shows 4 images when showTilingPreview is true', () => {
    vi.mocked(usePatternGenerator).mockReturnValue({
      ...defaultHookReturn,
      generatedPatterns: [patternOne, patternTwo],
      selectedPattern: patternOne,
      showTilingPreview: true,
    });

    render(<PatternGenerator />);

    expect(screen.getAllByAltText(/Selected pattern preview/i)).toHaveLength(4);
  });
});
