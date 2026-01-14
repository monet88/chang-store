# Phase 1: Chat Service Layer

## Context Links
- [Gemini API Chat Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [Current image service](../../services/gemini/image.ts)
- [API client](../../services/apiClient.ts)

## Overview
- **Priority**: P1 (Foundation)
- **Status**: Pending
- **Effort**: 2h

Create service layer for multi-turn image editing using Gemini Chat API.

## Key Insights

From Gemini API research:
- `ai.chats.create()` maintains conversation history automatically
- Each `sendMessage()` call includes previous context
- Images sent as `Part` objects with `inlineData`
- Gemini 3 Pro supports image output in chat mode

## Requirements

### Functional
- Create chat session for image refinement
- Send refinement prompts with current image
- Receive refined image as response
- Track refinement history
- Reset/clear session

### Non-Functional
- Stateless service (session managed by caller)
- Error handling with i18n keys
- Type-safe interfaces

## Architecture

```typescript
// services/gemini/chat.ts

interface RefinementHistoryItem {
  prompt: string;
  timestamp: number;
}

interface ImageChatSession {
  sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile>;
  getHistory(): RefinementHistoryItem[];
  reset(): void;
}

function createImageChatSession(model: string): ImageChatSession
```

## Related Code Files

### Create
| File | Description |
|------|-------------|
| `services/gemini/chat.ts` | New chat service module |

### Modify
| File | Description |
|------|-------------|
| `services/imageEditingService.ts` | Export chat functions |

## Implementation Steps

### Step 1: Create chat.ts service

```typescript
// services/gemini/chat.ts

import { Part, Modality } from "@google/genai";
import { ImageFile } from '../../types';
import { getGeminiClient } from '../apiClient';

export interface RefinementHistoryItem {
  prompt: string;
  timestamp: number;
}

export interface ImageChatSession {
  sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile>;
  getHistory(): RefinementHistoryItem[];
  reset(): void;
}

export function createImageChatSession(model: string = 'gemini-3-pro-image-preview'): ImageChatSession {
  const ai = getGeminiClient();
  let chat = ai.chats.create({
    model,
    config: {
      responseModalities: [Modality.IMAGE],
    }
  });
  let history: RefinementHistoryItem[] = [];

  return {
    async sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile> {
      const imagePart: Part = {
        inlineData: {
          data: currentImage.base64,
          mimeType: currentImage.mimeType,
        }
      };
      const textPart: Part = { text: prompt };

      const response = await chat.sendMessage({
        message: [imagePart, textPart]
      });

      // Extract image from response
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error('error.api.noContent');
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          history.push({ prompt, timestamp: Date.now() });
          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          };
        }
      }

      throw new Error('error.api.noImageInParts');
    },

    getHistory(): RefinementHistoryItem[] {
      return [...history];
    },

    reset(): void {
      chat = ai.chats.create({
        model,
        config: {
          responseModalities: [Modality.IMAGE],
        }
      });
      history = [];
    }
  };
}
```

### Step 2: Export from imageEditingService.ts

Add export:
```typescript
export { createImageChatSession, type ImageChatSession, type RefinementHistoryItem } from './gemini/chat';
```

## Todo List

- [ ] Create `services/gemini/chat.ts`
- [ ] Implement `createImageChatSession` function
- [ ] Add error handling with safety block detection
- [ ] Export from `imageEditingService.ts`
- [ ] Test with manual API call

## Success Criteria

- [ ] Chat session can be created
- [ ] Refinement returns new image
- [ ] History tracks all refinements
- [ ] Reset clears session and history
- [ ] Errors use i18n keys

## Security Considerations

- No API keys stored in service
- Uses existing `getGeminiClient()` pattern
- Error messages don't expose internals

## Next Steps

After completion, proceed to Phase 2: Hook & State Management
