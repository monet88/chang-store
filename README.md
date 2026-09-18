# Chang Store

AI-powered virtual fashion studio built with React 19, TypeScript, and Vite.
Chang Store lets users generate fashion imagery: virtual try-ons, lookbooks,
background swaps, pose changes, photo albums, image edits, watermark removal,
clothing transfer, identity transfer, and textile pattern generation. The default
studio runs Google Gemini; the GPT Image studio (OpenAI-compatible) runs five of
those workflows on the same views with its own size and quality controls.

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
| Identity Transfer | Apply shared face/body identity references across destination images |
| Pattern Generator | Generate and refine textile/fabric patterns |

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Google Gemini SDK (`@google/genai`)
- GPT Image (OpenAI) REST in the GPT studio
- IndexedDB via `idb-keyval`

## Architecture

```text
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

No React Router. `src/App.tsx` switches on the `Feature` enum and lazy-loads
feature components. `AppContent` also holds a `StudioMode`
(`gemini | gptImage`); `ImageEngineContext` gives every feature view the image
transport of the active studio, so the same workflows run on either engine.

Key docs:

- `AGENTS.md` — project-specific agent instructions and Harness entrypoints.
- `docs/product/overview.md` — product overview.
- `docs/product/provider-studios.md` — the studio split and the engine seam.
- `docs/product/identity-transfer.md` — Identity Transfer role and batch contract.
- `docs/ARCHITECTURE.md` — actual app architecture.

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on port 3549. Ports are pinned (`server.strictPort`), so a
second instance fails fast instead of drifting to another port. On Windows, `npm`
is a batch shim; launch Vite directly when a `cmd.exe` wrapper is not available:

```bash
node node_modules/vite/bin/vite.js
```

## Environment Variables

Vite only exposes env vars with `VITE_` prefix. This project also supports
non-prefixed provider keys through explicit injection in `vite.config.ts`.

Core Gemini studio:

```bash
GEMINI_API_KEY=your_key_here
# or
VITE_GEMINI_API_KEY=your_key_here
```

Optional GPT Image lane:

```bash
GPT_IMAGE_API_KEY=your_openai_key_here
# Optional custom/local proxies
GPT_IMAGE_BASE_URL=https://api.openai.com/v1
```

A fresh install with no stored image profile seeds one from those values, and an
empty base URL fails closed rather than defaulting to a vendor address.

For production deployments, set the same variables in the hosting dashboard.

If you switch this checkout between Linux and Windows, rebuild dependencies for
the active OS before running Vite/Vitest/tsx flows.

## Quality Gates

Run before shipping changes:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

## Documentation

- Product contracts: `docs/product/`
- API reference policy: one measured contract per gateway in `docs/api/`

## License

Private project unless a license is added.
