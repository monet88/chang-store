---
title: "Lookbook AI - Iterative Image Refinement"
description: "Add prompt input below result image for iterative refinement using Gemini multi-turn chat context"
status: pending
priority: P1
effort: 6h
issue: null
branch: main
tags: [feature, frontend, ai, lookbook]
created: 2026-01-14
---

# Lookbook AI - Iterative Image Refinement

## Overview

Add input prompt below generated lookbook image, allowing users to refine/edit results iteratively. Leverages Gemini API's multi-turn chat feature to maintain context across refinements.

## Problem Statement

Current flow: Generate → Not satisfied → Re-generate from scratch (loses all context)

Desired flow: Generate → Refine with prompt → Refine again → ... (context preserved)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Chat Service Layer | Pending | 2h | [phase-01](./phase-01-chat-service.md) |
| 2 | Hook & State Management | Pending | 2h | [phase-02](./phase-02-hook-state.md) |
| 3 | UI Components | Pending | 1.5h | [phase-03](./phase-03-ui-components.md) |
| 4 | i18n & Polish | Pending | 0.5h | [phase-04](./phase-04-i18n-polish.md) |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      LookbookOutput.tsx                      │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Generated Image                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 💬 Refinement History (collapsible)                    │  │
│  │   • "Made background darker" ✓                         │  │
│  │   • "Added warmer lighting" ✓                          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────┐ ┌─────────┐ ┌───────┐  │
│  │ "Add softer shadows..."          │ │ Refine  │ │ Reset │  │
│  └──────────────────────────────────┘ └─────────┘ └───────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input → useLookbookGenerator.handleRefine() 
           → ImageChatService.sendRefinement()
           → Gemini Chat API (with context)
           → New Image → Update State
```

## Key Technical Decisions

### 1. Gemini Chat API Usage
```typescript
// Create persistent chat session
const chat = ai.chats.create({
  model: 'gemini-3-pro-image-preview',
  config: { responseModalities: [Modality.IMAGE] }
});

// Each refinement maintains context
await chat.sendMessage({
  message: [
    { inlineData: { data: currentImage.base64, mimeType } },
    { text: "Make the background darker" }
  ]
});
```

### 2. Session Lifecycle
- Chat session created after initial image generation
- Session persists until: new generation, tab change, or manual reset
- History stored in hook state for UI display

### 3. Image Context Strategy
- Always send current (latest) image with each refinement
- Gemini uses chat history for semantic context
- Visual context comes from the attached image

## Dependencies

- `@google/genai` SDK (already installed)
- Gemini 3 Pro Image model access

## Success Criteria

1. User can type refinement prompt after image generation
2. Refinements maintain context of previous edits
3. History shows past refinements with collapsible UI
4. Reset button clears session and returns to original
5. Loading state during refinement
6. Error handling for failed refinements

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits | Medium | Add debounce, show warning |
| Session timeout | Low | Auto-recreate session on error |
| Large image payloads | Medium | Compress before sending |
| Context window overflow | Low | Limit history to 10 items |

## Out of Scope

- Undo/redo individual refinements
- Branching refinement paths
- Saving refinement history to storage
