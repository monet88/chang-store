import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AiScanPanel from '@/components/AiScanPanel';
import { AiScanProvider, useAiScan } from '@/contexts/AiScanContext';
import type { ImageFile } from '@/types';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key: string) => key }),
}));

const SOURCE: ImageFile = { base64: 'c291cmNl', mimeType: 'image/png' };
const OTHER_SOURCE: ImageFile = { base64: 'b3RoZXI=', mimeType: 'image/png' };

/**
 * Another job of the same batch: it scans its OWN source set while the panel
 * under test watches its own.
 */
const ScanTrigger = ({ sources }: { sources: ImageFile[] }) => {
  const { scan } = useAiScan();

  useEffect(() => {
    void scan(sources);
  }, [scan, sources]);

  return null;
};

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

  it('keeps showing its own blueprint while another source set is analyzed', async () => {
    const analyze = vi.fn(async (image: ImageFile) => {
      if (image === OTHER_SOURCE) return new Promise<string>(() => {});
      return 'PANEL BLUEPRINT: silk satin on a dry hand.';
    });

    render(
      <AiScanProvider analyze={analyze}>
        <AiScanPanel sources={[SOURCE]} />
        <ScanTrigger sources={[OTHER_SOURCE]} />
      </AiScanProvider>,
    );

    // The other job is still analyzing; this panel is done and stays done.
    await waitFor(() => expect(screen.getByText('studio.aiScan.ready')).toBeInTheDocument());
    expect(screen.queryByText('studio.aiScan.analyzing')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'studio.aiScan.view' }));
    expect(screen.getByText('PANEL BLUEPRINT: silk satin on a dry hand.')).toBeInTheDocument();
  });

  it('never reports another source set\'s failure as its own', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const analyze = vi.fn(async (image: ImageFile) => {
      if (image === OTHER_SOURCE) throw new Error('foreign source failed');
      return 'PANEL BLUEPRINT: matte twill.';
    });

    render(
      <AiScanProvider analyze={analyze}>
        <AiScanPanel sources={[SOURCE]} />
        <ScanTrigger sources={[OTHER_SOURCE]} />
      </AiScanProvider>,
    );

    await waitFor(() => expect(screen.getByText('studio.aiScan.ready')).toBeInTheDocument());
    expect(screen.queryByText('studio.aiScan.unavailable')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'studio.aiScan.view' }));
    expect(screen.getByText('PANEL BLUEPRINT: matte twill.')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('drops the previous blueprint while the new sources are analyzed', async () => {
    let resolveSecond: (value: string) => void = () => {};
    const analyze = vi.fn(async (image: ImageFile) => {
      if (image === SOURCE) return 'FIRST BLUEPRINT';
      return new Promise<string>((resolve) => { resolveSecond = resolve; });
    });

    const { rerender } = render(
      <AiScanProvider analyze={analyze}>
        <AiScanPanel sources={[SOURCE]} />
      </AiScanProvider>,
    );

    await waitFor(() => expect(screen.getByText('studio.aiScan.ready')).toBeInTheDocument());

    rerender(
      <AiScanProvider analyze={analyze}>
        <AiScanPanel sources={[OTHER_SOURCE]} />
      </AiScanProvider>,
    );

    // The superseded set's blueprint is gone, not shown next to the analysis of
    // the images the user just replaced.
    expect(screen.getByText('studio.aiScan.analyzing')).toBeInTheDocument();
    expect(screen.queryByText('FIRST BLUEPRINT')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond('SECOND BLUEPRINT');
    });

    await waitFor(() => expect(screen.getByText('studio.aiScan.ready')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'studio.aiScan.view' }));
    expect(screen.getByText('SECOND BLUEPRINT')).toBeInTheDocument();
  });

  it('clears the badge when the sources are emptied', async () => {
    const analyze = vi.fn().mockResolvedValue('FIRST BLUEPRINT');

    const { rerender } = renderPanel(analyze, [SOURCE]);
    await waitFor(() => expect(screen.getByText('studio.aiScan.ready')).toBeInTheDocument());

    rerender(
      <AiScanProvider analyze={analyze}>
        <AiScanPanel sources={[]} />
      </AiScanProvider>,
    );

    expect(screen.queryByText('studio.aiScan.ready')).not.toBeInTheDocument();
    expect(screen.queryByText('studio.aiScan.analyzing')).not.toBeInTheDocument();
  });
});
