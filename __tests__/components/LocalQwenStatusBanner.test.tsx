import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocalQwenStatusBanner } from '@/components/studios/LocalQwenStatusBanner';
import type { DesktopLocalQwenStatus } from '@/platform/desktopLocalQwen';

const translations: Record<string, string> = {
  'studio.localQwenStatus.starting': 'Starting ComfyUI...',
  'studio.localQwenStatus.startingSubtext': 'Initializing local ComfyUI runtime on 127.0.0.1:8188...',
  'studio.localQwenStatus.ready': 'ComfyUI Ready',
  'studio.localQwenStatus.readySubtext': 'Qwen-Image 2.1 ready',
  'studio.localQwenStatus.appOwned': 'App-owned',
  'studio.localQwenStatus.external': 'External',
  'studio.localQwenStatus.generating': 'Generating',
  'studio.localQwenStatus.generatingSubtext': 'Sampling with local Qwen-Image 2.1 on ComfyUI...',
  'studio.localQwenStatus.stopped': 'ComfyUI Stopped',
  'studio.localQwenStatus.stoppedSubtext': 'Local ComfyUI is not running on 127.0.0.1:8188.',
  'studio.localQwenStatus.retry': 'Retry',
  'studio.localQwenStatus.openSettings': 'Open Settings',
  'studio.localQwenStatus.cancel': 'Cancel',
  'studio.localQwenStatus.cancelling': 'Cancelling...',
  'studio.localQwenStatus.startServer': 'Start ComfyUI',
};

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe('LocalQwenStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('state rendering', () => {
    it('renders starting state with animated indicator and subtext', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'starting',
        isAppOwned: true,
        port: 8188,
      };

      render(<LocalQwenStatusBanner status={status} />);

      expect(screen.getByText('Starting ComfyUI...')).toBeInTheDocument();
      expect(screen.getByText('Initializing local ComfyUI runtime on 127.0.0.1:8188...')).toBeInTheDocument();
    });

    it('renders ready state with ownership badge and open settings button', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'ready',
        isAppOwned: true,
        port: 8188,
      };
      const onOpenSettings = vi.fn();

      render(<LocalQwenStatusBanner status={status} onOpenSettings={onOpenSettings} />);

      expect(screen.getByText('ComfyUI Ready')).toBeInTheDocument();
      expect(screen.getByText('App-owned')).toBeInTheDocument();

      const settingsBtn = screen.getByText('Open Settings');
      fireEvent.click(settingsBtn);
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('renders external badge when server is externally owned', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'ready',
        isAppOwned: false,
        port: 8188,
      };

      render(<LocalQwenStatusBanner status={status} />);

      expect(screen.getByText('External')).toBeInTheDocument();
    });

    it('renders generating state with step progress and enabled cancel button', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'generating',
        isAppOwned: true,
        port: 8188,
        progress: {
          step: 7,
          maxSteps: 16,
        },
      };
      const onCancelJob = vi.fn();

      render(<LocalQwenStatusBanner status={status} onCancelJob={onCancelJob} />);

      expect(screen.getByText('Generating')).toBeInTheDocument();
      expect(screen.getByText('Step 7 / 16')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('cancel-local-qwen-job');
      expect(cancelBtn).toBeEnabled();
      expect(cancelBtn).toHaveTextContent('Cancel');

      fireEvent.click(cancelBtn);
      expect(onCancelJob).toHaveBeenCalledTimes(1);
    });

    it('disables cancel button and shows cancelling text when cancellation is in progress', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'generating',
        isAppOwned: true,
        port: 8188,
        progress: {
          step: 10,
          maxSteps: 16,
        },
      };

      render(<LocalQwenStatusBanner status={status} isCancelling={true} />);

      const cancelBtn = screen.getByTestId('cancel-local-qwen-job');
      expect(cancelBtn).toBeDisabled();
      expect(cancelBtn).toHaveTextContent('Cancelling...');
    });

    it('renders stopped state with start ComfyUI button', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'stopped',
        isAppOwned: false,
        port: 8188,
      };
      const onStartServer = vi.fn();

      render(<LocalQwenStatusBanner status={status} onStartServer={onStartServer} />);

      expect(screen.getByText('ComfyUI Stopped')).toBeInTheDocument();
      const startBtn = screen.getByTestId('start-local-comfyui-button');
      expect(startBtn).toBeInTheDocument();

      fireEvent.click(startBtn);
      expect(onStartServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling and actionable guidance', () => {
    it('displays actionable guidance and action buttons for OOM error without cloud fallback', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'error',
        isAppOwned: true,
        port: 8188,
        error: 'torch.cuda.OutOfMemoryError: CUDA out of memory',
      };
      const onRetry = vi.fn();
      const onOpenSettings = vi.fn();

      render(
        <LocalQwenStatusBanner
          status={status}
          onRetry={onRetry}
          onOpenSettings={onOpenSettings}
        />,
      );

      expect(screen.getByText('GPU Out of Memory')).toBeInTheDocument();
      expect(screen.getByText(/reducing the resolution to 512 in Settings/i)).toBeInTheDocument();

      // Retry and Open Settings buttons
      const retryBtn = screen.getByTestId('local-qwen-retry-button');
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);

      const settingsBtn = screen.getByTestId('local-qwen-open-settings-button');
      fireEvent.click(settingsBtn);
      expect(onOpenSettings).toHaveBeenCalledTimes(1);

      // Verify NEVER falls back to cloud
      expect(screen.queryByText(/Gemini/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/GPT/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Cloud fallback/i)).not.toBeInTheDocument();
    });

    it('displays actionable guidance for missing model error', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'error',
        isAppOwned: true,
        port: 8188,
        error: 'UnetLoaderGGUF: qwen-image-2.1-Q4_K_M.gguf not found',
      };

      render(<LocalQwenStatusBanner status={status} />);

      expect(screen.getByText('Missing Model Files')).toBeInTheDocument();
      expect(screen.getByText(/Required model files are missing/i)).toBeInTheDocument();
    });

    it('displays actionable guidance for startup failure', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'error',
        isAppOwned: false,
        port: 8188,
        error: 'ComfyUI directory not found: D:\ComfyUI_windows_portable',
      };

      render(<LocalQwenStatusBanner status={status} />);

      expect(screen.getByText('ComfyUI Startup Error')).toBeInTheDocument();
      expect(screen.getByText(/Check the ComfyUI folder path in Settings/i)).toBeInTheDocument();
    });

    it('displays cancellation status when job was cancelled', () => {
      const status: DesktopLocalQwenStatus = {
        state: 'error',
        isAppOwned: true,
        port: 8188,
        error: 'Generation cancelled by user',
      };

      render(<LocalQwenStatusBanner status={status} />);

      expect(screen.getByText('Generation Cancelled')).toBeInTheDocument();
      expect(screen.getByText(/Generation was cancelled. You can retry/i)).toBeInTheDocument();
    });
  });
});
