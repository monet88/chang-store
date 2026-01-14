# Phase 3: UI Components

## Context Links
- [LookbookOutput component](../../components/LookbookOutput.tsx)
- [Phase 2: Hook State](./phase-02-hook-state.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 1.5h

Create refinement UI below generated image.

## Requirements

### Functional
- Text input for refinement prompt
- "Refine" button with loading state
- "Reset" button to clear session
- Collapsible refinement history
- Disabled state when no image

### Non-Functional
- Match existing UI style (zinc/amber colors)
- Responsive design
- Keyboard support (Enter to submit)

## UI Design

```
┌────────────────────────────────────────────────────────────┐
│                    [Generated Image]                       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▶ Refinement History (2)                             │  │ ← Collapsible
│  │   • "Made background darker" - 2m ago                │  │
│  │   • "Added warmer lighting" - 5m ago                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────┐ ┌────────┐ ┌───────┐   │
│  │ Describe changes...           │ │ Refine │ │ Reset │   │
│  └────────────────────────────────┘ └────────┘ └───────┘   │
└────────────────────────────────────────────────────────────┘
```

## Related Code Files

### Create
| File | Description |
|------|-------------|
| `components/shared/RefinementInput.tsx` | New refinement UI component |

### Modify
| File | Description |
|------|-------------|
| `components/LookbookOutput.tsx` | Integrate RefinementInput |
| `components/LookbookGenerator.tsx` | Pass new props |

## Implementation Steps

### Step 1: Create RefinementInput component

```typescript
// components/shared/RefinementInput.tsx

import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { RefinementHistoryItem } from '../../services/imageEditingService';
import Spinner from '../Spinner';

interface RefinementInputProps {
  onRefine: (prompt: string) => void;
  onReset: () => void;
  history: RefinementHistoryItem[];
  isRefining: boolean;
  disabled: boolean;
}

export const RefinementInput: React.FC<RefinementInputProps> = ({
  onRefine,
  onReset,
  history,
  isRefining,
  disabled
}) => {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const handleSubmit = () => {
    if (prompt.trim() && !isRefining && !disabled) {
      onRefine(prompt.trim());
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('common.justNow');
    if (minutes < 60) return t('common.minutesAgo', { count: minutes });
    return t('common.hoursAgo', { count: Math.floor(minutes / 60) });
  };

  return (
    <div className="mt-4 space-y-3">
      {/* History (collapsible) */}
      {history.length > 0 && (
        <div className="bg-zinc-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <span>
              {t('lookbook.refinementHistory')} ({history.length})
            </span>
            <span className={`transform transition-transform ${historyExpanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
          </button>
          {historyExpanded && (
            <div className="px-3 pb-2 space-y-1">
              {history.map((item, i) => (
                <div key={i} className="text-xs text-zinc-500 flex justify-between">
                  <span className="truncate flex-1">• {item.prompt}</span>
                  <span className="ml-2 whitespace-nowrap">{formatTimeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('lookbook.refinementPlaceholder')}
          disabled={disabled || isRefining}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || isRefining || !prompt.trim()}
          className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg text-sm hover:bg-amber-500 transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isRefining ? <Spinner /> : t('lookbook.refineButton')}
        </button>
        {history.length > 0 && (
          <button
            onClick={onReset}
            disabled={isRefining}
            className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600 transition-colors disabled:opacity-50"
            title={t('lookbook.resetRefinement')}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
};
```

### Step 2: Update LookbookOutput props

```typescript
// Add to LookbookOutputProps interface
interface LookbookOutputProps {
  // ... existing props ...
  
  // New refinement props
  refinementHistory: RefinementHistoryItem[];
  isRefining: boolean;
  onRefineImage: (prompt: string) => void;
  onResetRefinement: () => void;
}
```

### Step 3: Integrate in LookbookOutput

Add after HoverableImage in main tab:

```typescript
{/* Main Tab */}
{activeTab === 'main' && (
  <div className="animate-fade-in">
    <HoverableImage
      image={lookbook.main}
      altText={t('lookbook.tabGeneratedImage')}
      onUpscale={() => onUpscale(lookbook.main, 'main')}
      isUpscaling={upscalingStates['main']}
    />
    
    {/* Refinement Input */}
    <RefinementInput
      onRefine={onRefineImage}
      onReset={onResetRefinement}
      history={refinementHistory}
      isRefining={isRefining}
      disabled={!lookbook}
    />
  </div>
)}
```

### Step 4: Update LookbookGenerator

Pass new props from hook to LookbookOutput:

```typescript
<LookbookOutput
  // ... existing props ...
  refinementHistory={refinementHistory}
  isRefining={isRefining}
  onRefineImage={handleRefineImage}
  onResetRefinement={handleResetRefinement}
/>
```

## Todo List

- [ ] Create `components/shared/RefinementInput.tsx`
- [ ] Add collapsible history UI
- [ ] Add input with Enter key support
- [ ] Add Refine button with loading
- [ ] Add Reset button
- [ ] Update `LookbookOutputProps` interface
- [ ] Import and use `RefinementInput` in LookbookOutput
- [ ] Update `LookbookGenerator.tsx` to pass props

## Success Criteria

- [ ] Input visible below generated image
- [ ] Enter key submits refinement
- [ ] Loading spinner during refinement
- [ ] History shows past refinements
- [ ] History is collapsible
- [ ] Reset button appears after first refinement
- [ ] Disabled when no image

## Next Steps

After completion, proceed to Phase 4: i18n & Polish
