# Three Provider Studios

Story: `US-001-three-provider-studios`
Lane: high-risk

## Current Behavior

Chang Store is a Gemini-only React/Vite SPA. The app opens directly into the existing Gemini workspace, uses the Gemini model registry, and routes image operations through the Gemini service facade.

## Target Behavior

Add a header-level studio switcher with three studios:

- Gemini: existing workspace and default app entry.
- Grok: isolated provider studio for five fashion workflows.
- GPT Image: isolated provider studio for five fashion workflows.

Provider studios must keep results local-only, avoid Gallery writes, avoid Gemini prompt builders, and use provider-specific request contracts.

## Affected Users

- Fashion creators testing alternative image providers.
- Operators configuring provider keys and base URLs.
- Developers maintaining Gemini isolation while adding provider-specific service paths.

## Affected Product Docs

- `docs/ARCHITECTURE.md`
- `docs/product/overview.md`
- `docs/deployment-guide.md`
- `docs/api/README.md`
- `docs/project-roadmap.md`
- `docs/system-architecture.md`
- `docs/CHANGELOG.md`

## Non-Goals

- No backend proxy in v1.
- No cross-studio result persistence.
- No PhotoAlbum transfer from provider studios.
- No unification of Gemini, Grok, and GPT Image model registries.
- No implementation until official provider contracts and Harness story evidence are current.
