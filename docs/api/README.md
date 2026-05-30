# API Reference Notes

This project is Gemini-only at runtime today. The provider notes in this
directory are planning references for the three-provider studio plan and are not
runtime implementation docs until that feature ships.

## Current Source of Truth

- Gemini SDK usage: `src/services/gemini/`
- Image service facade: `src/services/imageEditingService.ts`
- Text service facade: `src/services/textService.ts`
- Model registry: `src/config/modelRegistry.ts`
- Deployment env vars: `docs/deployment-guide.md`
- Grok planning notes: `docs/api/grok-image-api-guide.md`
- GPT Image 2 planning notes: `docs/api/gpt-image-2-api-guide.md`

## Update Rule

Only add API reference docs here when they are short, current, and directly tied
to code used by this app. Prefer linking to vendor docs over copying long specs.
Before implementing provider code, recheck the official vendor docs and update
the relevant planning note if the contract changed.
