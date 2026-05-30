# Chang Store

AI-powered virtual fashion studio built with React 19, TypeScript, and Vite.
Chang Store lets users generate fashion imagery with Gemini: virtual try-ons,
lookbooks, background swaps, pose changes, photo albums, image edits, watermark
removal, clothing transfer, and textile pattern generation.

## Features

| Feature | Purpose |
| --- | --- |
| Virtual Try-On | Dress subject photos in uploaded clothing items |
| Lookbook Generator | Create editorial and product-style fashion spreads |
| Background Replacer | Replace image backgrounds with prompts or presets |
| Pose Changer | Re-pose subjects from references, prompts, or library poses |
| Photo Album | Batch-create themed photo sets |
| AI Editor | Prompt-driven image editing with `@img` references |
| Watermark Remover | Batch-remove watermarks with retry/download flows |
| Clothing Transfer | Transfer worn outfits from source to target photos |
| Pattern Generator | Generate and refine textile/fabric patterns |

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Google Gemini SDK (`@google/genai`)
- IndexedDB via `idb-keyval`
- Optional Google Drive sync

## Architecture

```text
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

No React Router. `src/App.tsx` switches on the `Feature` enum and lazy-loads
feature components.

Key docs:

- `AGENTS.md` — project-specific agent instructions and Harness entrypoints.
- `docs/README.md` — documentation map.
- `docs/product/overview.md` — product overview.
- `docs/ARCHITECTURE.md` — actual app architecture.
- `docs/code-standards.md` — code conventions and quality gates.

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on port 3000.

## Environment Variables

Vite only exposes env vars with `VITE_` prefix. This project also supports
non-prefixed `GEMINI_API_KEY` through explicit injection in `vite.config.ts`.

Set one of:

```bash
GEMINI_API_KEY=your_key_here
# or
VITE_GEMINI_API_KEY=your_key_here
```

For production deployments, set the same variable in the hosting dashboard.
See `docs/deployment-guide.md`.

## Quality Gates

Run before shipping changes:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

For docs-only changes, run the relevant docs/Harness checks instead.

## Harness

This repo uses Harness for agent-ready project operations:

- `docs/HARNESS.md` — collaboration model.
- `docs/FEATURE_INTAKE.md` — classify work by lane.
- `docs/CONTEXT_RULES.md` — context selection rules.
- `docs/TRACE_SPEC.md` — trace and friction capture.
- `scripts/harness` — local Harness CLI entrypoint.

Initialize local durable Harness state when needed:

```bash
scripts/harness init
scripts/harness import brownfield
scripts/harness query matrix
```

`harness.db` and the prebuilt binary under `scripts/bin/` are local generated
artifacts and are ignored by git.

## Documentation

- Product contracts: `docs/product/`
- Stories and backlog: `docs/stories/`
- Decisions: `docs/decisions/`
- Templates: `docs/templates/`
- API reference policy: `docs/api/README.md`

## License

Private project unless a license is added.
