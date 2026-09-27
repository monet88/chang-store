import React from 'react';

interface LocalQwenModelBadgeProps {
  /** Resolved unet state: `true` Uncensored (UC), `false` Standard. */
  state: boolean;
  uncensoredLabel: string;
  standardLabel: string;
  /** `compact` for dense header rows, `comfortable` for labelled field rows. */
  size?: 'compact' | 'comfortable';
}

/**
 * Uncensored (UC) / Standard badge. The two surfaces that show it (status
 * banner and settings modal) differ only in padding and label keys, so the
 * markup lives here once.
 */
export const LocalQwenModelBadge: React.FC<LocalQwenModelBadgeProps> = ({
  state,
  uncensoredLabel,
  standardLabel,
  size = 'compact',
}) => (
  <span
    className={[
      'rounded border py-0.5 text-[10px] font-semibold',
      size === 'compact' ? 'px-1.5' : 'px-2',
      state
        ? 'border-purple-500/40 bg-purple-950/70 text-purple-300'
        : 'border-zinc-700 bg-zinc-800 text-zinc-300',
    ].join(' ')}
  >
    {state ? uncensoredLabel : standardLabel}
  </span>
);

export default LocalQwenModelBadge;
