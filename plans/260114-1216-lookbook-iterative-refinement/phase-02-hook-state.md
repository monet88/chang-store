# Phase 2: Hook & State Management

## Context Links
- [Current hook](../../hooks/useLookbookGenerator.ts)
- [Phase 1: Chat Service](./phase-01-chat-service.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 2h

Extend `useLookbookGenerator` hook with refinement state and handlers.

## Requirements

### Functional
- Create chat session after initial generation
- Handle refinement requests
- Track refinement history in state
- Reset session on new generation or manual reset
- Loading state for refinement

### Non-Functional
- Minimal re-renders
- Clean separation from existing generation logic

## Architecture

```typescript
// New state in useLookbookGenerator

// Chat session (null until first generation)
const [chatSession, setChatSession] = useState<ImageChatSession | null>(null);

// Refinement history for UI
const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryItem[]>([]);

// Loading state
const [isRefining, setIsRefining] = useState(false);
```

## Related Code Files

### Modify
| File | Description |
|------|-------------|
| `hooks/useLookbookGenerator.ts` | Add refinement state & handlers |

## Implementation Steps

### Step 1: Add imports

```typescript
import { 
  createImageChatSession, 
  ImageChatSession, 
  RefinementHistoryItem 
} from '../services/imageEditingService';
```

### Step 2: Add state variables

```typescript
// After existing state declarations
const [chatSession, setChatSession] = useState<ImageChatSession | null>(null);
const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryItem[]>([]);
const [isRefining, setIsRefining] = useState(false);
```

### Step 3: Modify handleGenerate

After successful generation, create chat session:

```typescript
const handleGenerate = async () => {
  // ... existing logic ...
  
  try {
    const results = await editImage({ /* ... */ });
    if (results.length > 0) {
      setGeneratedLookbook({ main: results[0], variations: [], closeups: [] });
      setActiveOutputTab('main');
      
      // Create new chat session for refinement
      const session = createImageChatSession(imageEditModel);
      setChatSession(session);
      setRefinementHistory([]);
    }
  } catch (err) {
    // ... existing error handling ...
  }
};
```

### Step 4: Add handleRefineImage handler

```typescript
const handleRefineImage = async (prompt: string) => {
  if (!chatSession || !generatedLookbook) {
    setError(t('lookbook.refineError'));
    return;
  }

  setIsRefining(true);
  setError(null);

  try {
    const refinedImage = await chatSession.sendRefinement(
      prompt,
      generatedLookbook.main
    );

    // Update lookbook with refined image
    setGeneratedLookbook(prev => prev ? {
      ...prev,
      main: refinedImage,
      // Clear variations/closeups as they're based on old image
      variations: [],
      closeups: []
    } : null);

    // Update history from session
    setRefinementHistory(chatSession.getHistory());
    
  } catch (err) {
    setError(getErrorMessage(err, t));
  } finally {
    setIsRefining(false);
  }
};
```

### Step 5: Add handleResetRefinement handler

```typescript
const handleResetRefinement = () => {
  if (chatSession) {
    chatSession.reset();
    setChatSession(null);
    setRefinementHistory([]);
  }
};
```

### Step 6: Update return object

```typescript
return {
  // ... existing returns ...
  
  // New refinement exports
  chatSession,
  refinementHistory,
  isRefining,
  handleRefineImage,
  handleResetRefinement,
};
```

## Todo List

- [ ] Add imports for chat service
- [ ] Add state: `chatSession`, `refinementHistory`, `isRefining`
- [ ] Modify `handleGenerate` to create session after success
- [ ] Add `handleRefineImage` handler
- [ ] Add `handleResetRefinement` handler
- [ ] Export new state and handlers
- [ ] Add i18n key `lookbook.refineError`

## Success Criteria

- [ ] Chat session created after generation
- [ ] Refinement updates main image
- [ ] History tracked correctly
- [ ] Reset clears session
- [ ] Loading state works
- [ ] Errors display properly

## Edge Cases

| Case | Behavior |
|------|----------|
| Refine without image | Show error, do nothing |
| Refine during loading | Button disabled |
| Reset without session | No-op |
| Tab change during refine | Allow (async continues) |

## Next Steps

After completion, proceed to Phase 3: UI Components
