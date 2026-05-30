# API Reference Notes

This project is Gemini-only at runtime. Historical bulk provider reference files
were removed during the Harness documentation restructure to avoid stale,
token-heavy docs in the main repo.

## Current Source of Truth

- Gemini SDK usage: `src/services/gemini/`
- Image service facade: `src/services/imageEditingService.ts`
- Text service facade: `src/services/textService.ts`
- Model registry: `src/config/modelRegistry.ts`
- Deployment env vars: `docs/deployment-guide.md`

## Update Rule

Only add API reference docs here when they are short, current, and directly tied
to code used by this app. Prefer linking to vendor docs over copying long specs.
