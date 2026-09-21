import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GatewayProfileRow } from '@/components/modals/GatewayProfileRow';
import type { GatewayProfile } from '@/config/gatewayProfiles';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const PROFILE: GatewayProfile = {
  id: 'image-1',
  label: 'Image',
  baseUrl: 'https://gateway.example.com/v1',
  apiKey: '__desktop_gateway_credential__',
  lane: 'image',
  driver: 'openai-images',
  enabled: true,
};

describe('GatewayProfileRow', () => {
  it('keeps a local API-key draft and commits it once on blur', () => {
    const onPatch = vi.fn();
    render(
      <GatewayProfileRow
        profile={PROFILE}
        isActive={false}
        onPatch={onPatch}
        onRemove={vi.fn()}
        onProbe={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('settingsModal.gatewayProfiles.apiKeyField');
    fireEvent.change(input, { target: { value: 'new-secret' } });
    expect(input).toHaveValue('new-secret');
    expect(onPatch).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ apiKey: 'new-secret' });
  });
});
