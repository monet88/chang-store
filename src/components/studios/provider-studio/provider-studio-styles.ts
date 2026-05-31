/**
 * Shared Tailwind class vocabulary for provider studios, mirroring Gemini's
 * `VirtualTryOn.tsx` constants so the two studios match the Gemini visual
 * language exactly. Single source of truth — no ad-hoc class drift. Tailwind
 * only (per AGENTS.md): no inline styles, no CSS modules.
 */
export const panelClass = 'rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8';
export const eyebrowClass = 'text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400';
export const sectionTitleClass = 'text-2xl font-medium tracking-[-0.03em] text-zinc-50';
export const helperClass = 'text-base leading-7 text-zinc-300';
export const labelClass = 'text-sm font-medium text-zinc-300';
export const fieldClass =
  'rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none';
export const textareaClass =
  'w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-base leading-7 text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';
