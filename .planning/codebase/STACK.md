# STACK

## Runtime

- Browser-only React SPA. Main entrypoints are `src/index.tsx`, `src/App.tsx`, and `index.html`.
- React 19.2 with `react-dom` 19.2.
- TypeScript 5.8 with ESM (`"type": "module"` in `package.json`).
- Vite 6 with `@vitejs/plugin-react-swc` for dev/build.

## UI and Styling

- Tailwind CSS 4 is present in `package.json` with PostCSS via `postcss.config.js`.
- Global CSS lives in `src/index.css`.
- A large amount of page-level styling is still embedded in `index.html`.
- The app font is loaded from Google Fonts (`Be Vietnam Pro`) in `index.html`.

## Core Runtime Dependencies

- `@google/genai` for Gemini image/text/video APIs.
- `axios` is installed, but most current provider code uses `fetch`.
- `jszip` is used for batch image download/export flows.
- `lodash-es` is used for debounce and other tree-shakeable utilities.

## Tooling

- ESLint 9 in `eslint.config.js`.
- Vitest 4 with jsdom in `vitest.config.ts`.
- React Testing Library, `@testing-library/jest-dom`, and `@testing-library/user-event`.
- Coverage provider is V8 with thresholds configured in `vitest.config.ts`.

## Build Configuration

- Dev server runs on port `3000` in `vite.config.ts`.
- Path alias `@` points to `src/` directory in both `vite.config.ts` and `vitest.config.ts`.
- Production build manually splits `react`, `@google/genai`, and `axios` into vendor chunks.
- Production build strips `console.log`, `console.debug`, and `console.info`, but keeps `console.warn` and `console.error`.

## Environment and Config Surfaces

- Gemini API key is injected to browser code through `vite.config.ts` as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.
- Google Identity Services client ID is injected through `vite.config.ts` as `process.env.GOOGLE_CLIENT_ID`.
- Local provider defaults read `import.meta.env.VITE_LOCAL_PROVIDER_BASE_URL` and `import.meta.env.VITE_LOCAL_PROVIDER_API_KEY` in `src/contexts/ApiProviderContext.tsx`.
- User overrides are persisted in `localStorage` by `src/contexts/ApiProviderContext.tsx` and `src/contexts/GoogleDriveContext.tsx`.

## Model Routing Model

- Gemini and Imagen models are treated as default cloud models.
- Local provider models use the prefix `local--`.
- Anti provider models use the prefix `anti--`.
- Routing is centralized in `src/services/imageEditingService.ts`.

## Current Source Layout Notes

- All application source lives under `src/` in `src/components/`, `src/hooks/`, `src/contexts/`, `src/services/`, `src/utils/`, and `src/locales/`.
- Shared domain types live in `src/types.ts`.

## Key Files

- `package.json` - runtime and tooling dependencies.
- `vite.config.ts` - env injection, aliases, code splitting, console stripping.
- `vitest.config.ts` - test environment, coverage thresholds, aliasing.
- `eslint.config.js` - lint rules and ignored paths.
- `src/types.ts` - feature enum, image types, resolution and aspect-ratio types.
