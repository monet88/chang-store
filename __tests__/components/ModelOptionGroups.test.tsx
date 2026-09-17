import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ModelOptionGroups } from '@/components/ModelOptionGroups';
import type { SelectableModel } from '@/types';

const translations: Record<string, string> = {
  'modelSelector.unverified': 'Not verified',
  'error.gateway.modelNotServed': 'Not served by this gateway',
};

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

const renderGroups = (options: SelectableModel[]): HTMLSelectElement =>
  render(
    <select aria-label="model">
      <ModelOptionGroups options={options} />
    </select>,
  ).getByLabelText('model') as HTMLSelectElement;

describe('ModelOptionGroups', () => {
  it('renders served models as plain options, so a picker without discovery looks unchanged', () => {
    const select = renderGroups([{ modelId: 'gpt-image-2', label: 'GPT Image 2' }]);

    expect(select.querySelectorAll('optgroup')).toHaveLength(0);
    expect(select.querySelector('option')).toMatchObject({ value: 'gpt-image-2', disabled: false });
  });

  it('keeps unverified models selectable but apart from the served ones', () => {
    const select = renderGroups([
      { modelId: 'gpt-image-2', label: 'GPT Image 2' },
      { modelId: 'brand-new-model', label: 'brand-new-model', unverified: true },
    ]);

    const group = select.querySelector('optgroup');
    expect(group?.getAttribute('label')).toBe('Not verified');
    expect(group?.querySelector('option')).toMatchObject({ value: 'brand-new-model', disabled: false });
  });

  it('lists a model the gateway does not serve as a disabled option', () => {
    const select = renderGroups([
      { modelId: 'gpt-image-2', label: 'GPT Image 2' },
      { modelId: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', disabled: true },
    ]);

    const group = select.querySelector('optgroup');
    expect(group?.getAttribute('label')).toBe('Not served by this gateway');
    expect(group?.querySelector('option')).toMatchObject({ value: 'gpt-image-2.5-sunburst', disabled: true });
  });
});
