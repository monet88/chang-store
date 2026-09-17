# API Reference Notes

This project ships three image studios at runtime: Gemini (default), Grok, and
GPT Image. Gemini uses the Google GenAI SDK; the Grok and GPT Image studios call
provider REST endpoints directly through provider-specific services. The notes
in this directory document the provider request contracts these services rely
on.

## Current Source of Truth

- Gemini SDK usage: `src/services/gemini/`
- Image service facade: `src/services/imageEditingService.ts`
- Text service facade: `src/services/textService.ts`
- Gemini model registry: `src/config/modelRegistry.ts`
- Grok studio service + registry: `src/services/providers/grok/grokImageService.ts`, `src/config/grokModelRegistry.ts`
- GPT Image studio service + registry: `src/services/providers/gpt-image/gptImageService.ts`, `src/config/gptImageModelRegistry.ts`
- Shared provider utilities: `src/services/providers/shared/`
- Provider settings: `src/contexts/ApiProviderContext.tsx`
- Deployment env vars: `docs/deployment-guide.md`
- Grok contract notes: `docs/api/grok-image-api-guide.md`
- GPT Image 2 contract notes: `docs/api/gpt-image-2-api-guide.md`
- CPA gateway contract notes (`https://cliproxy.monet.uno`, the active and only Gemini route): `docs/api/cliproxy-vertex-ai-api-guide.md`
- XomPet OpenAI-compatible Images contract notes (`https://api.xompet.io.vn`, the image-lane reference gateway for `gpt-image-2.5-sunburst`), measured 2026-09-17: `docs/api/xompet-image-api-guide.md`
- Retired backend gateway contract notes (`https://vertex.monet.uno`, no longer used by the app): `docs/api/vertex-gateway-api-guide.md`
- Direct Vertex AI TTS + embedding notes (service account / SDK): `docs/api/vertex-tts-embedding-guide.md`

## Update Rule

Only add API reference docs here when they are short, current, and directly tied
to code used by this app. Prefer linking to vendor docs over copying long specs.
Before implementing provider code, recheck the official vendor docs and update
the relevant planning note if the contract changed.
