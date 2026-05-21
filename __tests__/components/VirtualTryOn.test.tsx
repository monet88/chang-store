import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const useVirtualTryOnMock = vi.fn();

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/hooks/useVirtualTryOn', () => ({
  useVirtualTryOn: () => useVirtualTryOnMock(),
}));

vi.mock('../../src/components/ImageUploader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../../src/components/MultiImageUploader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../../src/components/Spinner', () => ({
  default: () => <div>spinner</div>,
}));

vi.mock('../../src/components/HoverableImage', () => ({
  default: ({ altText }: { altText: string }) => <div>{altText}</div>,
}));

vi.mock('../../src/components/Tooltip', () => ({
  default: ({ children }: { children: unknown }) => <>{children}</>,
}));

vi.mock('../../src/components/shared/ResultPlaceholder', () => ({
  default: ({ description }: { description: string }) => <div>{description}</div>,
}));

vi.mock('../../src/components/ImageOptionsPanel', () => ({
  default: () => <div>image-options</div>,
}));

vi.mock('../../src/components/WardrobeSetCard', () => ({
  default: ({ setIndex, items, onAddItem, onRemoveItem, onUpdateItem, onRemoveSet }: any) => (
    <div data-testid={`wardrobe-set-${setIndex}`}>
      <h4>Set {setIndex + 1}</h4>
      <button onClick={onAddItem}>Add Item</button>
      <button onClick={onRemoveSet}>Remove Set</button>
      {items.map((item: any) => (
        <div key={item.id} data-testid={`wardrobe-item-${item.id}`}>
          <button onClick={() => onRemoveItem(item.id)}>Remove Item</button>
          <button onClick={() => onUpdateItem(item.id, { image: { base64: 'test', mimeType: 'image/png' } })}>
            Update Item
          </button>
        </div>
      ))}
    </div>
  ),
}));

import VirtualTryOn from '../../src/components/VirtualTryOn';

const baseHookState = {
  mode: 'multi-model' as const,
  setMode: vi.fn(),
  isAnyGenerating: false,
  wardrobe: {
    sets: [],
    subject: null,
    extraPrompt: '',
    setExtraPrompt: vi.fn(),
    backgroundPrompt: '',
    setBackgroundPrompt: vi.fn(),
    results: [],
    isGenerating: false,
    error: null,
    loadingMessage: '',
    addSet: vi.fn(),
    removeSet: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn(),
    setSubject: vi.fn(),
    clearSubject: vi.fn(),
    generate: vi.fn(),
    download: vi.fn(),
    maxSets: 4,
    maxItemsPerSet: 4,
  },
  subjectItems: [],
  subjectImages: [],
  clothingItems: [{ id: 1, image: null, sourceItemType: 'clothing', sourcePrompt: '' }],
  backgroundPrompt: '',
  setBackgroundPrompt: vi.fn(),
  extraPrompt: '',
  setExtraPrompt: vi.fn(),
  handleSourceItemTypeChange: vi.fn(),
  handleSourcePromptChange: vi.fn(),
  numImages: 1,
  setNumImages: vi.fn(),
  aspectRatio: 'Default',
  setAspectRatio: vi.fn(),
  resolution: '1K',
  setResolution: vi.fn(),
  isLoading: false,
  upscalingStates: {},
  loadingMessage: '',
  error: null,
  setError: vi.fn(),
  completedCount: 0,
  failedCount: 0,
  canGenerate: false,
  clearSubjectImages: vi.fn(),
  handleGenerateImage: vi.fn(),
  handleRegenerateSingle: vi.fn(),
  handleUpscale: vi.fn(),
  handleRefine: vi.fn(),
  handleSubjectImagesUpload: vi.fn(),
  handleClothingUpload: vi.fn(),
  addClothingUploader: vi.fn(),
  removeClothingUploader: vi.fn(),
  handleDownloadAll: vi.fn(),
  anyUpscaling: false,
  imageEditModel: 'gemini-2.5-flash-image',
  refinePrompts: {},
  setRefinePrompts: vi.fn(),
  isRefining: {},
  isMultiPersonMode: false,
  setIsMultiPersonMode: vi.fn(),
  markerPosition: null,
  setMarkerPosition: vi.fn(),
  clearMarker: vi.fn(),
};

describe('VirtualTryOn component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVirtualTryOnMock.mockReturnValue(baseHookState);
  });

  it('renders the multi-subject uploader and disables generate when batch input is incomplete', () => {
    render(<VirtualTryOn />);

    expect(screen.getAllByText('virtualTryOn.subjectImagesTitle').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'virtualTryOn.generateButton' })).toBeDisabled();
    expect(screen.getAllByText('virtualTryOn.outputPanelDescription').length).toBeGreaterThan(0);
  });

  it('renders source controls below each source image and forwards changes', () => {
    render(<VirtualTryOn />);

    const select = screen.getByLabelText('virtualTryOn.sourceItemTypeLabel');
    expect(select).toHaveValue('clothing');

    fireEvent.change(select, { target: { value: 'bag' } });
    expect(baseHookState.handleSourceItemTypeChange).toHaveBeenCalledWith(1, 'bag');

    fireEvent.change(screen.getByLabelText('virtualTryOn.sourcePromptLabel'), {
      target: { value: 'wide pants, no hand in pocket' },
    });
    expect(baseHookState.handleSourcePromptChange).toHaveBeenCalledWith(1, 'wide pants, no hand in pocket');
  });

  it('keeps add source image enabled for non-clothing source items', () => {
    useVirtualTryOnMock.mockReturnValue({
      ...baseHookState,
      clothingItems: [{ id: 1, image: null, sourceItemType: 'bag', sourcePrompt: '' }],
    });

    render(<VirtualTryOn />);

    expect(screen.getByRole('button', { name: 'virtualTryOn.addItem' })).toBeEnabled();
  });

  it('uses a compact grid when multiple source images are present', () => {
    useVirtualTryOnMock.mockReturnValue({
      ...baseHookState,
      clothingItems: [
        { id: 1, image: null, sourceItemType: 'clothing', sourcePrompt: '' },
        { id: 2, image: null, sourceItemType: 'shoes', sourcePrompt: '' },
      ],
    });

    render(<VirtualTryOn />);

    expect(screen.getByTestId('source-items-grid')).toHaveClass('grid', 'sm:grid-cols-2');
  });

  it('renders batch results when subject items exist', () => {
    useVirtualTryOnMock.mockReturnValue({
      ...baseHookState,
      canGenerate: true,
      subjectItems: [
        {
          id: 'vto-1',
          subjectImage: { base64: 'subject', mimeType: 'image/png' },
          status: 'completed',
          results: [{ base64: 'result', mimeType: 'image/png' }],
        },
      ],
      subjectImages: [{ base64: 'subject', mimeType: 'image/png' }],
      completedCount: 1,
    });

    render(<VirtualTryOn />);

    expect(screen.getByRole('button', { name: 'virtualTryOn.generateButton' })).toBeEnabled();
    expect(screen.getByText('virtualTryOn.batchResultsTitle')).toBeInTheDocument();
    // Flat grid: result image rendered directly (no session rail)
    expect(screen.getByText(/generatedImage.altText/)).toBeInTheDocument();
  });

  it('keeps the multi-person target marker transparent to pointer events', () => {
    useVirtualTryOnMock.mockReturnValue({
      ...baseHookState,
      isMultiPersonMode: true,
      subjectImages: [{ base64: 'subject', mimeType: 'image/png' }],
      markerPosition: { x: 40, y: 80, relX: 0.25, relY: 0.5 },
    });

    const { container } = render(<VirtualTryOn />);

    expect(container.querySelector('#multi-person-marker')).toHaveClass('pointer-events-none');
  });

  describe('Wardrobe Mode', () => {
    it('renders mode toggle buttons', () => {
      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: 'virtualTryOn.modeMultiModel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'virtualTryOn.modeWardrobe' })).toBeInTheDocument();
    });

    it('switches to wardrobe mode when toggle is clicked', () => {
      const setModeMock = vi.fn();
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        setMode: setModeMock,
      });

      render(<VirtualTryOn />);

      const wardrobeButton = screen.getByRole('button', { name: 'virtualTryOn.modeWardrobe' });
      fireEvent.click(wardrobeButton);

      expect(setModeMock).toHaveBeenCalledWith('wardrobe');
    });

    it('renders single model uploader in wardrobe mode (not multi-subject)', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: null,
          sets: [{ id: 'ws-1', items: [] }],
        },
      });

      render(<VirtualTryOn />);

      // Should show single subject uploader, not multi-subject
      expect(screen.queryByText('virtualTryOn.subjectImagesTitle')).not.toBeInTheDocument();
      expect(screen.getAllByText('virtualTryOn.wardrobeSubjectLabel').length).toBeGreaterThan(0);
    });

    it('renders wardrobe set cards in wardrobe mode', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: { base64: 'subject', mimeType: 'image/png' },
          sets: [
            { id: 'ws-1', items: [] },
            { id: 'ws-2', items: [] },
          ],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByTestId('wardrobe-set-0')).toBeInTheDocument();
      expect(screen.getByTestId('wardrobe-set-1')).toBeInTheDocument();
    });

    it('renders add set button in wardrobe mode', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          sets: [{ id: 'ws-1', items: [] }],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: /virtualTryOn\.addSet/ })).toBeInTheDocument();
    });

    it('disables add set button when max sets reached', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          sets: [
            { id: 'ws-1', items: [] },
            { id: 'ws-2', items: [] },
            { id: 'ws-3', items: [] },
            { id: 'ws-4', items: [] },
          ],
          maxSets: 4,
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: /virtualTryOn\.maxSetsReached/ })).toBeDisabled();
    });

    it('calls addSet when add set button is clicked', () => {
      const addSetMock = vi.fn();
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          sets: [{ id: 'ws-1', items: [] }],
          addSet: addSetMock,
        },
      });

      render(<VirtualTryOn />);

      fireEvent.click(screen.getByRole('button', { name: /virtualTryOn\.addSet/ }));

      expect(addSetMock).toHaveBeenCalled();
    });

    it('disables generate button when no subject in wardrobe mode', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: null,
          sets: [{ id: 'ws-1', items: [{ id: 1, image: { base64: 'outfit', mimeType: 'image/png' }, sourceItemType: 'clothing', sourcePrompt: '' }] }],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: 'virtualTryOn.generateAllSets' })).toBeDisabled();
    });

    it('disables generate button when sets are empty in wardrobe mode', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: { base64: 'subject', mimeType: 'image/png' },
          sets: [{ id: 'ws-1', items: [] }],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: 'virtualTryOn.generateAllSets' })).toBeDisabled();
    });

    it('enables generate button when subject and items exist in wardrobe mode', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: { base64: 'subject', mimeType: 'image/png' },
          sets: [{ id: 'ws-1', items: [{ id: 1, image: { base64: 'outfit', mimeType: 'image/png' }, sourceItemType: 'clothing', sourcePrompt: '' }] }],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: 'virtualTryOn.generateAllSets' })).toBeEnabled();
    });

    it('calls generate when generate button is clicked in wardrobe mode', () => {
      const generateMock = vi.fn();
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: { base64: 'subject', mimeType: 'image/png' },
          sets: [{ id: 'ws-1', items: [{ id: 1, image: { base64: 'outfit', mimeType: 'image/png' }, sourceItemType: 'clothing', sourcePrompt: '' }] }],
          generate: generateMock,
        },
      });

      render(<VirtualTryOn />);

      fireEvent.click(screen.getByRole('button', { name: 'virtualTryOn.generateAllSets' }));

      expect(generateMock).toHaveBeenCalled();
    });

    it('renders wardrobe results grouped by set', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: { base64: 'subject', mimeType: 'image/png' },
          sets: [
            { id: 'ws-1', items: [{ id: 1, image: { base64: 'outfit-a', mimeType: 'image/png' }, sourceItemType: 'clothing', sourcePrompt: '' }] },
            { id: 'ws-2', items: [{ id: 2, image: { base64: 'outfit-b', mimeType: 'image/png' }, sourceItemType: 'clothing', sourcePrompt: '' }] },
          ],
          results: [
            { setId: 'ws-1', status: 'completed', results: [{ base64: 'result-1', mimeType: 'image/png' }] },
            { setId: 'ws-2', status: 'completed', results: [{ base64: 'result-2', mimeType: 'image/png' }] },
          ],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getAllByText('virtualTryOn.wardrobeResultsTitle').length).toBeGreaterThan(0);
    });

    it('shows loading message during wardrobe generation', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          isGenerating: true,
          loadingMessage: 'Generating outfit 1 of 2...',
          results: [{ setId: 'ws-1', status: 'processing', results: [] }],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByText('Generating outfit 1 of 2...')).toBeInTheDocument();
    });

    it('shows error message in wardrobe mode', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          error: 'Generation failed',
          results: [{ setId: 'ws-1', status: 'error', results: [], error: 'Set 1 error' }],
        },
      });

      render(<VirtualTryOn />);

      expect(screen.getByText('Generation failed')).toBeInTheDocument();
    });

    it('calls download when download button is clicked in wardrobe mode', () => {
      const downloadMock = vi.fn();
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'wardrobe',
        wardrobe: {
          ...baseHookState.wardrobe,
          subject: { base64: 'subject', mimeType: 'image/png' },
          sets: [{ id: 'ws-1', items: [{ id: 1, image: { base64: 'outfit', mimeType: 'image/png' }, sourceItemType: 'clothing', sourcePrompt: '' }] }],
          results: [{ setId: 'ws-1', status: 'completed', results: [{ base64: 'result', mimeType: 'image/png' }] }],
          download: downloadMock,
        },
      });

      render(<VirtualTryOn />);

      const downloadButton = screen.getByRole('button', { name: 'common.downloadBatch' });
      fireEvent.click(downloadButton);

      expect(downloadMock).toHaveBeenCalled();
    });

    it('keeps multi-model mode tests passing (regression)', () => {
      useVirtualTryOnMock.mockReturnValue({
        ...baseHookState,
        mode: 'multi-model',
        canGenerate: true,
        subjectItems: [
          {
            id: 'vto-1',
            subjectImage: { base64: 'subject', mimeType: 'image/png' },
            status: 'completed',
            results: [{ base64: 'result', mimeType: 'image/png' }],
          },
        ],
        subjectImages: [{ base64: 'subject', mimeType: 'image/png' }],
        completedCount: 1,
      });

      render(<VirtualTryOn />);

      expect(screen.getByRole('button', { name: 'virtualTryOn.generateButton' })).toBeEnabled();
      expect(screen.getByText('virtualTryOn.batchResultsTitle')).toBeInTheDocument();
    });
  });
});
