import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdentityTransferPresets } from '@/components/IdentityTransferPresets';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'vi',
    t: (key: string) => key,
  }),
}));

describe('IdentityTransferPresets', () => {
  it('renders categories and preset items for the default category', () => {
    render(<IdentityTransferPresets value="" onChange={vi.fn()} />);

    expect(screen.getByText('Vóc dáng')).toBeInTheDocument();
    expect(screen.getByText('Kiểu tóc')).toBeInTheDocument();
    expect(screen.getByText('Makeup')).toBeInTheDocument();
    expect(screen.getByText('Kính & Phụ kiện')).toBeInTheDocument();

    expect(screen.getByText(/Đồng hồ cát thon gọn/)).toBeInTheDocument();
    expect(screen.getByText(/Vòng 1 nảy nở/)).toBeInTheDocument();
  });

  it('switches category when category button is clicked', () => {
    render(<IdentityTransferPresets value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Kiểu tóc'));
    expect(screen.getByText(/Tóc xoăn sóng bồng bềnh/)).toBeInTheDocument();
    expect(screen.getByText(/Tóc suôn thẳng mượt mà/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Kính & Phụ kiện'));
    expect(screen.getByText(/Kính gọng kim loại thanh mảnh/)).toBeInTheDocument();
    expect(screen.getByText(/Kính râm thời thượng/)).toBeInTheDocument();
  });

  it('appends preset prompt when clicked', () => {
    const onChange = vi.fn();
    render(<IdentityTransferPresets value="" onChange={onChange} />);

    fireEvent.click(screen.getByText(/Vòng 1 nảy nở/));
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('Enlarge and enhance the bust size'),
    );
  });

  it('appends to existing value with a comma separator', () => {
    const onChange = vi.fn();
    render(<IdentityTransferPresets value="existing note" onChange={onChange} />);

    fireEvent.click(screen.getByText(/Vòng 1 nảy nở/));
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('existing note, Enlarge and enhance the bust size'),
    );
  });

  it('removes preset prompt when clicked again if already present', () => {
    const bustPrompt =
      'Enlarge and enhance the bust size to be noticeably fuller, larger, and voluptuous with natural cleavage, fitting snugly against the top.';
    const onChange = vi.fn();
    render(
      <IdentityTransferPresets
        value={`keep lighting natural, ${bustPrompt}`}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText(/Vòng 1 nảy nở/));
    expect(onChange).toHaveBeenCalledWith('keep lighting natural');
  });
});
