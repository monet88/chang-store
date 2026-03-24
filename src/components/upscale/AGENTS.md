# UPSCALE - Step-Based UI Sub-components

## OVERVIEW
11 components implementing Upscale's two-mode workflow: **Studio** (multi-phase analysis → prompt → enhance) and **Quick** (one-shot). Parent: `src/components/Upscale.tsx`. Logic: `src/hooks/useUpscale.ts`.

## STRUCTURE
```
upscale/
├── UpscaleStudioStepShell.tsx    # Step container/progress shell
├── UpscaleAnalyzeStep.tsx        # Phase 1: image quality analysis
├── UpscaleAnalysisReportCard.tsx # Phase 1 result display
├── UpscaleEnhanceStep.tsx        # Phase 2: upscaling with prompt
├── UpscaleOutputPanel.tsx        # Result display + download
├── UpscalePromptPackage.tsx      # Prompt preview/edit UI
├── UpscaleGuidanceCard.tsx       # Contextual help card
├── UpscaleModeSwitch.tsx         # Toggle Studio ↔ Quick mode
├── UpscalePreviewSimulation.tsx  # Before/after preview
├── UpscaleQuickPanel.tsx         # Quick mode one-shot UI
└── UpscaleSessionImageRail.tsx   # Session image history rail
```

## WHERE TO LOOK
| Task | File |
|------|------|
| Add analysis step UI | `UpscaleAnalyzeStep.tsx` + `UpscaleAnalysisReportCard.tsx` |
| Modify enhance step | `UpscaleEnhanceStep.tsx` |
| Mode switching logic | `UpscaleModeSwitch.tsx` (UI only — state in `useUpscale`) |
| Result output | `UpscaleOutputPanel.tsx` |
| Session history | `UpscaleSessionImageRail.tsx` |

## CONVENTIONS
- All state/logic lives in `useUpscale.ts` — these are display-only
- Props flow down from `Upscale.tsx` (parent orchestrator)
- Step components receive step-specific slices of hook state
- No local state except UI-only concerns (hover, tooltip visibility)

## ANTI-PATTERNS
- Never add business logic here — belongs in `useUpscale.ts`
- Never import from services — all data flows through props from parent
