import React from 'react';
import { type SelectableModel } from '../types';
import { ModelOptionGroups } from './ModelOptionGroups';

interface GlobalModelSelectorProps {
  label: string;
  ariaLabel: string;
  selectedModel: string;
  options: SelectableModel[];
  onChange: (modelId: string) => void;
}

// ⚡ Bolt: Wrapped pure UI component in React.memo() to prevent unnecessary
// re-renders when parent components (like App.tsx) re-render frequently,
// since its props (like options arrays and callbacks) are referentially stable.
export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> = React.memo(({
  label,
  ariaLabel,
  selectedModel,
  options,
  onChange,
}) => (
  <div className="w-full max-w-md rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</label>
      <div className="relative">
        <select
          aria-label={ariaLabel}
          value={selectedModel}
          onChange={(event) => onChange(event.target.value)}
          className="workspace-input min-h-[46px] w-full appearance-none px-4 py-3 pr-10 text-sm text-zinc-100"
        >
          <ModelOptionGroups options={options} />
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-500">⌄</span>
      </div>
    </div>
  </div>
));

GlobalModelSelector.displayName = 'GlobalModelSelector';
