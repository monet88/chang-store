# Product Docs

Product truth for chang-store, derived from the current React/Vite codebase.
These files describe user-visible behavior and feature contracts at operational
depth so agents can plan or review work without reverse-engineering every hook.

## Index

| File | Scope |
| --- | --- |
| `overview.md` | Product summary, tech stack, architecture summary, persistence |
| `provider-studios.md` | Three-provider studio split (Gemini / Grok / GPT Image) |
| `try-on.md` | Virtual Try-On and Wardrobe Mode |
| `lookbook.md` | Lookbook Generator |
| `background.md` | Background Replacer |
| `pose.md` | Pose Changer |
| `photo-album.md` | Photo Album Creator |
| `ai-editor.md` | AI Editor and @mention image references |
| `watermark-remover.md` | Batch Watermark Remover |
| `clothing-transfer.md` | Clothing Transfer |
| `pattern-generator.md` | Pattern Generator |

## Source Hierarchy

When product docs conflict with code, verify the current implementation first:

1. `src/types.ts` — current `Feature` enum and shared types.
2. `src/App.tsx` — feature routing and provider nesting.
3. Paired feature hook in `src/hooks/` — behavior source of truth.
4. Paired feature component in `src/components/` — UI surface.
5. Product doc in this directory — operational contract to update.

## Update Rule

When user-visible behavior changes:

1. Update the affected product doc.
2. Update `docs/README.md` if a product doc is added/removed.
3. Update or create a story packet under `docs/stories/` when the change is
   normal/high-risk lane.
4. Update durable proof status with `scripts/harness story add` or
   `scripts/harness story update` when tracking work through Harness.
5. Record a decision in `docs/decisions/` if the change affects architecture,
   scope, risk, or a previously settled product rule.

## Validation Checklist

Before treating these docs as current:

- Feature list matches `src/types.ts`.
- Routing and component names match `src/App.tsx`.
- Key files exist.
- Service boundaries match `docs/ARCHITECTURE.md` or list known debt.
- i18n keys are updated in both `src/locales/en.ts` and `src/locales/vi.ts` for
  user-facing text changes.
