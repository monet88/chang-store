import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JobStatusBadge from '../../src/components/JobStatusBadge';
import type { Job } from '../../src/types';

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

function makeJob(progressTotal: number): Job {
  return {
    id: 'job-1',
    user_id: 'user-1',
    feature: 'try-on',
    status: 'running',
    idempotency_key: 'key-1',
    input_payload_json: {},
    workflow_run_id: null,
    progress_total: progressTotal,
    progress_done: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    error_code: null,
    error_message: null,
  };
}

describe('JobStatusBadge', () => {
  it('does not render progress when total progress is unknown', () => {
    render(<JobStatusBadge job={makeJob(0)} isPolling />);

    expect(screen.queryByText('0/1')).not.toBeInTheDocument();
  });

  it('renders progress when total progress is known', () => {
    render(<JobStatusBadge job={makeJob(3)} isPolling />);

    expect(screen.getByText('0/3')).toBeInTheDocument();
  });
});
