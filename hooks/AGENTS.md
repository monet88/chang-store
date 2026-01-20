# HOOKS KNOWLEDGE BASE

## OVERVIEW
Hooks are the logic layer: state, validation, and service orchestration for each feature.

## STRUCTURE
```
hooks/
├── useImageEditor.ts
├── useLookbookGenerator.ts
├── useVideoGenerator.ts
├── useVirtualTryOn.ts
└── (other feature hooks)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|------|
| Image editing logic | `hooks/useImageEditor.ts` | Canvas editing + service calls |
| Lookbook flow | `hooks/useLookbookGenerator.ts` | Draft persistence + variations |
| Video generation | `hooks/useVideoGenerator.ts` | Scene suggestion + status updates |
| Try-on flow | `hooks/useVirtualTryOn.ts` | Validation + upscale hooks |
| Gallery sync | `hooks/useGoogleDriveSync.ts` | Drive sync + upload queue |

## CONVENTIONS
- Hooks own loading/error state and return handlers + state.
- Use `useLanguage()` for i18n errors and `useApi()` for provider config.
- Validate inputs before calling services.
- Video features must use AIVideoAuto models via `getModelsForFeature`.

## ANTI-PATTERNS
- No JSX or UI logic in hooks.
- No direct external API calls; route via `services/`.
- Do not store API keys in hook state; use `ApiProviderContext`.

## NOTES
- Some hooks persist drafts in localStorage (e.g., lookbook generator).
