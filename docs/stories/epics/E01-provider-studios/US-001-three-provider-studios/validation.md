# Validation

## Proof Strategy

The story is done only when provider contracts are proven by service tests, Gemini isolation is proven by regression tests, and the documented quality gates pass after implementation.

## Test Plan

| Area | Evidence |
| --- | --- |
| Studio shell | Component tests for switcher, sidebar feature subset, and UtilityDock provider-mode behavior |
| Provider settings | `ApiProviderContext` tests for env defaults, localStorage override, reset, and base URL allowlist |
| Grok service | Fetch tests for JSON `image`/`images` object shapes, max 3 sources, `n` validation, retry, and response parsing |
| GPT Image service | Fetch tests for JSON generation, repeated `image[]` multipart edit fields, omitted multipart `Content-Type`, retry, and response parsing |
| Hook behavior | Hook tests for prompt validation, loading/error state, local-only results, and AbortController cleanup |
| Boundaries | Tests proving provider code does not import Gemini prompt builders or bypass service boundaries |
| Docs | Updated architecture, product, deployment, API, roadmap, system architecture, and changelog docs |

## Fixtures

Use image fixtures under `docs/image-test/` for upload workflows:

- `people.jpg`
- `outfit.jpg`
- `shoes.jpg`

## Commands

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
scripts/bin/harness-cli.exe query matrix
```

## Acceptance Evidence

Planning remediation:

- Plan corrected to official xAI and OpenAI request contracts.
- Provider settings ownership moved to `ApiProviderContext`.
- API notes shortened and cleaned of local token examples.
- Harness story row added for `US-001-three-provider-studios`.

Implementation evidence: add command output summaries here after code lands.
