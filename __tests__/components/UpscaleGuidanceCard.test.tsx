import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockUseLanguage } from '../__mocks__/contexts';

vi.mock('../../src/contexts/LanguageContext', () => mockUseLanguage());

import UpscaleGuidanceCard from '../../src/components/upscale/UpscaleGuidanceCard';

describe('UpscaleGuidanceCard', () => {
  it('shows Gemini API key guidance when studio support is unavailable', () => {
    render(
      <UpscaleGuidanceCard
        hasReport={false}
        hasResult={false}
        studioSupportStatus="no_api_key"
      />,
    );

    expect(screen.getByText('upscale.guidanceTitle')).toBeInTheDocument();
    expect(screen.getByText('upscale.studioNoApiKey')).toBeInTheDocument();
  });

  it('shows the step-by-step Gemini workflow when studio support is available', () => {
    render(
      <UpscaleGuidanceCard
        hasReport={false}
        hasResult={false}
        studioSupportStatus="supported"
      />,
    );

    expect(screen.getByText('upscale.guidanceStep1')).toBeInTheDocument();
    expect(screen.getByText('upscale.guidanceStep2')).toBeInTheDocument();
    expect(screen.getByText('upscale.guidanceStep3')).toBeInTheDocument();
    expect(screen.getByText('upscale.guidanceStep4')).toBeInTheDocument();
    expect(screen.getByText(/upscale\.guidanceNextAnalyze/)).toBeInTheDocument();
  });
});
