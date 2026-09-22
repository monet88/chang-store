import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LocalQwenSettingsSection } from '@/components/modals/LocalQwenSettingsSection';
import { loadLocalQwenSettings, saveLocalQwenSettings } from '@/config/localQwenSettings';

const translations: Record<string, string> = {
  'settingsModal.localQwen.title': 'Local Qwen (ComfyUI)',
  'settingsModal.localQwen.description': 'Configure local Qwen parameters.',
  'settingsModal.localQwen.folderLabel': 'ComfyUI Folder Path',
  'settingsModal.localQwen.folderPlaceholder': 'D:\\ComfyUI_windows_portable',
  'settingsModal.localQwen.autoDetected': 'Auto-detected portable installation',
  'settingsModal.localQwen.autoDetectButton': 'Auto-detect',
  'settingsModal.localQwen.resolutionLabel': 'Resolution',
  'settingsModal.localQwen.warning1024':
    'Native 1024px requires ~7.4GB VRAM and leaves little headroom on 8GB GPUs.',
  'settingsModal.localQwen.stepsLabel': 'Steps (1–50)',
  'settingsModal.localQwen.cfgLabel': 'CFG (0.1–10.0)',
  'settingsModal.localQwen.samplerLabel': 'Sampler',
  'settingsModal.localQwen.schedulerLabel': 'Scheduler',
};

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe('LocalQwenSettingsSection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all configuration fields with default values', () => {
    render(<LocalQwenSettingsSection />);

    expect(screen.getByText('Local Qwen (ComfyUI)')).toBeInTheDocument();
    expect(screen.getByLabelText('ComfyUI Folder Path')).toBeInTheDocument();
    expect(screen.getByText('512px')).toBeInTheDocument();
    expect(screen.getByText('768px')).toBeInTheDocument();
    expect(screen.getByText('1024px')).toBeInTheDocument();
    expect(screen.getByLabelText('Steps (1–50)')).toHaveValue(16);
    expect(screen.getByLabelText('CFG (0.1–10.0)')).toHaveValue(1.0);
    expect(screen.getByLabelText('Sampler')).toHaveValue('Euler');
    expect(screen.getByLabelText('Scheduler')).toHaveValue('Simple');
  });

  it('shows low-VRAM warning when 1024px resolution is selected', () => {
    render(<LocalQwenSettingsSection />);

    expect(screen.queryByTestId('local-qwen-1024-warning')).not.toBeInTheDocument();

    const btn1024 = screen.getByText('1024px');
    fireEvent.click(btn1024);

    expect(screen.getByTestId('local-qwen-1024-warning')).toBeInTheDocument();
    expect(
      screen.getByText('Native 1024px requires ~7.4GB VRAM and leaves little headroom on 8GB GPUs.'),
    ).toBeInTheDocument();

    // Clicking 512px hides warning again
    fireEvent.click(screen.getByText('512px'));
    expect(screen.queryByTestId('local-qwen-1024-warning')).not.toBeInTheDocument();
  });

  it('persists changes to steps, cfg, sampler, scheduler, and path', () => {
    render(<LocalQwenSettingsSection />);

    fireEvent.change(screen.getByLabelText('Steps (1–50)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('CFG (0.1–10.0)'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('Sampler'), { target: { value: 'DPM++ 2M' } });
    fireEvent.change(screen.getByLabelText('Scheduler'), { target: { value: 'Karras' } });
    fireEvent.change(screen.getByLabelText('ComfyUI Folder Path'), {
      target: { value: 'D:\\MyComfyUI' },
    });

    const saved = loadLocalQwenSettings();
    expect(saved.steps).toBe(25);
    expect(saved.cfg).toBe(2.5);
    expect(saved.sampler).toBe('DPM++ 2M');
    expect(saved.scheduler).toBe('Karras');
    expect(saved.comfyUiPath).toBe('D:\\MyComfyUI');
  });

  it('auto-detect button restores known portable install path and labels detected only when folder exists', async () => {
    const verifyFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: { exists: true, hasComfyUiMain: true },
    });
    window.desktopLocalQwen = {
      verifyFolder,
    } as unknown as typeof window.desktopLocalQwen;

    saveLocalQwenSettings({ comfyUiPath: 'C:\\CustomPath' });
    render(<LocalQwenSettingsSection />);

    const input = screen.getByLabelText('ComfyUI Folder Path');
    expect(input).toHaveValue('C:\\CustomPath');

    const autoDetectBtn = screen.getByText('Auto-detect');
    fireEvent.click(autoDetectBtn);

    expect(input).toHaveValue('D:\\ComfyUI_windows_portable');
    expect(await screen.findByText('Auto-detected portable installation')).toBeInTheDocument();
  });

  it('does not label detected when the known folder does not actually exist on disk', async () => {
    const verifyFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: { exists: false, hasComfyUiMain: false },
    });
    window.desktopLocalQwen = {
      verifyFolder,
    } as unknown as typeof window.desktopLocalQwen;

    saveLocalQwenSettings({ comfyUiPath: 'D:\\ComfyUI_windows_portable' });
    render(<LocalQwenSettingsSection />);

    expect(screen.queryByText('Auto-detected portable installation')).not.toBeInTheDocument();
  });
  it('does not label detected when the directory exists but ComfyUI main.py is missing', async () => {
    const verifyFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: { exists: true, hasComfyUiMain: false },
    });
    window.desktopLocalQwen = {
      verifyFolder,
    } as unknown as typeof window.desktopLocalQwen;

    saveLocalQwenSettings({ comfyUiPath: 'D:\\ComfyUI_windows_portable' });
    render(<LocalQwenSettingsSection />);

    expect(screen.queryByText('Auto-detected portable installation')).not.toBeInTheDocument();
  });

  it('does not label detected in browser mode without desktopLocalQwen API', () => {
    delete window.desktopLocalQwen;

    saveLocalQwenSettings({ comfyUiPath: 'D:\\ComfyUI_windows_portable' });
    render(<LocalQwenSettingsSection />);

    expect(screen.queryByText('Auto-detected portable installation')).not.toBeInTheDocument();
  });
});
