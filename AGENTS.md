# Repository Guidelines

## Project Structure & Module Organization
- This is a Vite + React + TypeScript SPA. Entry points are `index.html`, `index.tsx`, and `App.tsx` in the repo root.
- UI components live in `components/`; shared logic in `hooks/`, global state in `contexts/`, and cross-cutting helpers in `utils/`.
- API and external integrations belong in `services/`. Text, copy, and localization assets live in `text/` and `locales/`.

## Build, Test, and Development Commands
- Install dependencies: `npm install`
- Run dev server (default on `http://localhost:5173`): `npm run dev`
- Production build: `npm run build`
- Preview built app locally: `npm run preview`
- No test runner is configured yet; add one (e.g., Vitest) before introducing automated tests.

## Coding Style & Naming Conventions
- Use TypeScript with JSX (`.tsx`) and 2-space indentation.
- Name React components with PascalCase (e.g., `ProductGrid.tsx`) and hooks with `use`-prefix in `hooks/` (e.g., `useCart.ts`).
- Keep components presentational in `components/` and move side-effectful or reusable logic into `hooks/`, `contexts/`, or `services/`.
- Use the `@/` alias for root-relative imports instead of long `../` chains.

## Testing Guidelines
- When adding tests, prefer a modern TS-friendly runner (e.g., Vitest + React Testing Library).
- Place tests next to the code under test using `*.test.ts` / `*.test.tsx` naming.
- Aim to cover critical flows (API calls in `services/`, shared hooks, and complex components) before edge cases.

## Commit & Pull Request Guidelines
- Follow a lightweight Conventional Commits style, as in existing history: `feat: Set up project structure and dependencies`.
- Use short, present-tense summaries (e.g., `feat: add cart sidebar`, `fix: handle empty catalog`).
- For PRs, include: purpose, key changes, any breaking behavior, and manual test steps or screenshots for UI changes.

## Security & Configuration
- Store secrets (e.g., `GEMINI_API_KEY`) in `.env.local` only; never commit them.
- Ensure new configuration flags and environment variables are documented in `README.md` or inline docs.
