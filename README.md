# Chang-Store: AI-Powered Virtual Fashion Studio

Chang-Store is a React 19 + TypeScript + Vite SPA that serves as a virtual fashion studio powered by Google Gemini for AI image editing and generation.

## Features

| Feature | Status | Pipeline |
|---------|--------|----------|
| Virtual Try-On | Live | Job queue |
| Lookbook Generator | Live | Job queue |
| Clothing Transfer | Live | Job queue |
| Photo Album Creator | Live | Job queue |
| Pose Changer | Gated (pending job migration) | -- |
| Background Replacer | Gated (pending job migration) | -- |
| AI Editor | Gated (pending job migration) | -- |
| Watermark Remover | Gated (pending job migration) | -- |
| Pattern Generator | Gated (pending job migration) | -- |

## Tech Stack

- **Frontend**: React 19.2, TypeScript 5.8, Vite 6.4, Tailwind CSS 4.1
- **Backend API**: Vercel Functions handlers (`api/`) with a Vite dev-api-bridge for local dev
- **AI**: Google Gemini SDK (`@google/genai`) -- Gemini-only, no multi-provider
- **Database**: Neon Postgres (Serverless) for auth sessions, rate limiting, and job queue
- **Blob Storage**: Vercel Blob for job input/output assets (optional, gated by `VITE_ENABLE_BLOB_STORAGE`)
- **Testing**: Vitest 4, React Testing Library, jsdom
- **CI**: GitHub Actions (Node 22, type-check, lint, test, build)
- **Deploy**: Vercel

## Quick Start

```bash
cp .env.example .env.local
# Edit .env.local with your GEMINI_API_KEY

npm install
npm run dev      # http://localhost:3000
npm run test     # run test suite
npm run build    # production build
npx tsc --noEmit # type-check
npm run lint     # ESLint
```

Optional: enable the backend by setting feature flags and database env vars (see `.env.example`).

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |
| `GOOGLE_CLIENT_ID` | For Drive sync | Google OAuth 2.0 Client ID |
| `AUTH_SECRET` | Production | HMAC-SHA256 secret for session cookies |
| `AUTH_SESSION_TTL_HOURS` | No (default 72) | Session duration in hours |
| `AUTH_SEEDED_USERS_JSON` | No | JSON array of seeded user records |
| `VITE_ENABLE_AUTH` | No (default false) | Enable seeded-auth login/logout |
| `VITE_ENABLE_JOB_QUEUE` | No (default false) | Enable durable job queue (requires auth) |
| `DATABASE_URL` | For backend | Neon Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | For backend | Vercel Blob read-write token |
| `VITE_ENABLE_BLOB_STORAGE` | No (default false) | Enable Vercel Blob storage |

## Architecture

```
Component (thin UI) --> Hook (state + logic) --> Service Facade --> Gemini API
                                                      |
                                              Neon Postgres (auth, jobs)
                                              Vercel Blob (assets)
```

- **No React Router** -- `App.tsx` switches on the `Feature` enum with `React.lazy`
- **Provider order** (each depends on parent): `LanguageProvider -> ToastProvider -> ApiProvider -> AuthProvider -> ImageGalleryProvider -> ImageViewerProvider -> AuthGate -> AppContent`
- **Feature entry points**: `src/components/` thin wrappers, paired with `src/hooks/` for all logic
- **Service routing**: `src/services/imageEditingService.ts` fans into `src/services/gemini/`
- **Backend API**: `api/` directory with Vercel-style `{ fetch }` handlers; Vite plugin bridges `/api` in dev
- **Auth**: Stateless HMAC-SHA256 session cookie (`chang_store_session`), scrypt password hashing, CSRF double-submit cookie pattern
- **Job queue**: Zod-validated idempotent jobs in Neon Postgres, fire-and-forget Gemini execution, Vercel Blob for outputs
- **Model registry**: `src/config/modelRegistry.ts` centralizes AI model capability selection

## Known Risks

1. **GEMINI_API_KEY exposed in client bundle** -- Vite `define` embeds it in the client build. A backend proxy is needed before production use with real user traffic.
2. **Durable workflow stubs** -- `workflows/canary.ts` and `workflows/feature-runner.ts` support both Vercel Workflow and Inngest paths, but actual execution is currently fire-and-forget from the API handler. Jobs that crash mid-execution are swept as stale after 30 minutes.
3. **5 features gated** -- Pose, Background, AI Editor, Watermark Remover, and Pattern Generator are functional in the client-only path but gated behind the job pipeline migration in backend mode.
4. **Missing Content Security Policy** -- No CSP headers configured in `vercel.json` (only COOP header). This is a security gap for production.
5. **No CSRF on GET** -- CSRF tokens protect POST/PUT/DELETE only; `SameSite=Lax` on session cookie provides some protection.

## Directory Map

| Directory | Role |
|-----------|------|
| `src/components/` | UI layer -- thin wrappers, feature screens, shared UI, and `modals/` |
| `src/hooks/` | Feature logic + state (one hook per feature) |
| `src/services/` | API facades (stateless), incl. `gemini/` |
| `src/contexts/` | Global state providers |
| `src/utils/` | Pure helpers, prompt builders |
| `src/config/` | Model capability registry |
| `src/locales/` | i18n: `en.ts` (source of truth) + `vi.ts` |
| `api/` | Vercel Functions API handlers |
| `server/` | Shared backend: db, auth, validation, adapters, gemini executor |
| `workflows/` | Durable workflow runners (canary, feature-runner, helpers) |
| `migrations/` | SQL migration files for Neon Postgres |
| `__tests__/` | Test files mirroring `src/` |

## Documentation

- [Project Overview & PDR](./docs/project-overview-pdr.md)
- [System Architecture](./docs/system-architecture.md)
- [Code Standards](./docs/code-standards.md)
- [Codebase Summary](./docs/codebase-summary.md)
- [Project Roadmap](./docs/project-roadmap.md)
- [Legacy Architecture (GitNexus)](./docs/ARCHITECTURE.md)
- [Legacy Roadmap](./docs/ROADMAP.md)
- [Changelog](./docs/CHANGELOG.md)

## Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (port 3000) |
| `npm run dev:turbo` | Dev server with forced re-optimization |
| `npm run build` | Production build |
| `npm run build:analyze` | Production build with bundle analysis |
| `npm run preview` | Preview production build |
| `npm run test` | Vitest run-once |
| `npm run test:ui` | Vitest UI mode |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript type-check |
