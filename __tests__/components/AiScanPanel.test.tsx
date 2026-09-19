import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiScanPanel from '@/components/AiScanPanel';
import { AiScanProvider } from '@/contexts/AiScanContext';
import type { ImageFile } from '@/types';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key: string) => key }),
}));

const SOURCE: ImageFile = { base64: 'c291cmNl', mimeType: 'image/png' };

const renderPanel = (
  analyze: (image: ImageFile, model?: string) => Promise<string>,
  sources: ImageFile[] = [SOURCE],
  initialEnabled?: boolean,
) =>
  render(
    <AiScanProvider analyze={analyze} initialEnabled={initialEnabled}>
      <AiScanPanel sources={sources} />
    </AiScanProvider>,
  );

describe('AiScanPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the switch as ON by default', () => {
    renderPanel(vi.fn().mockResolvedValue('blueprint'));

    const toggle = screen.getByRole('switch', { name: 'studio.aiScan.label' });

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('studio.aiScan.on')).toBeInTheDocument();
  });

  it('persists the preference when switched off', () => {
    renderPanel(vi.fn().mockResolvedValue('blueprint'));

    fireEvent.click(screen.getByRole('switch', { name: 'studio.aiScan.label' }));

    expect(screen.getByRole('switch', { name: 'studio.aiScan.label' })).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('ai_scan_enabled')).toBe('false');
  });

  it('shows the analysis state, then the blueprint behind a toggle', async () => {
    let resolveAnalyze: (value: string) => void = () => {};
    const analyze = vi.fn(
      () => new Promise<string>((resolve) => { resolveAnalyze = resolve; }),
    );
    renderPanel(analyze);

    expect(screen.getByText('studio.aiScan.analyzing')).toBeInTheDocument();

    resolveAnalyze('WEAVE & MATERIAL: plissé accordion pleats.');
    await waitFor(() => expect(screen.getByText('studio.aiScan.ready')).toBeInTheDocument());

    expect(screen.queryByText('WEAVE & MATERIAL: plissé accordion pleats.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'studio.aiScan.view' }));
    expect(screen.getByText('WEAVE & MATERIAL: plissé accordion pleats.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'studio.aiScan.hide' }));
    expect(screen.queryByText('WEAVE & MATERIAL: plissé accordion pleats.')).not.toBeInTheDocument();
  });

  it('reports an unavailable scan instead of blocking the feature', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPanel(vi.fn().mockRejectedValue(new Error('gateway 502')));

    await waitFor(() => expect(screen.getByText('studio.aiScan.unavailable')).toBeInTheDocument());

    consoleSpy.mockRestore();
  });

  it('does not analyze while the layer is off', () => {
    const analyze = vi.fn().mockResolvedValue('blueprint');
    renderPanel(analyze, [SOURCE], false);

    expect(analyze).not.toHaveBeenCalled();
    expect(screen.queryByText('studio.aiScan.ready')).not.toBeInTheDocument();
  });

  it('analyzes nothing when the feature has no source image yet', () => {
    const analyze = vi.fn().mockResolvedValue('blueprint');
    renderPanel(analyze, []);

    expect(analyze).not.toHaveBeenCalled();
    expect(screen.queryByText('studio.aiScan.ready')).not.toBeInTheDocument();
  });
});
