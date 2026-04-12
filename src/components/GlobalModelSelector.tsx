import React from 'react';
import { type RegisteredModel } from '../config/modelRegistry';

interface GlobalModelSelectorProps {
  label: string;
  ariaLabel: string;
  selectedModel: string;
  options: RegisteredModel[];
  onChange: (modelId: string) => void;
}

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> = ({
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
          {options.map((option) => (
            <option key={option.modelId} value={option.modelId}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-500">⌄</span>
      </div>
    </div>
  </div>
);
