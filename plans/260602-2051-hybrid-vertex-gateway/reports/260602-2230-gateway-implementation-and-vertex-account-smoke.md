# Gateway Implementation and Vertex Account Smoke

## Status
- Gateway scaffold implemented under `gateway/`.
- Local compile/test/build gates pass.
- Live Vertex smoke with `/media/monet/SSD Web/CodeBase/vertex-account-2.json` passes.

## Implemented
- Node 22 TypeScript gateway package with `dev`, `compile`, `start`, and `test` scripts.
- Health/readiness endpoints: `GET /healthz`, `GET /readyz`.
- Gateway auth via `Authorization: Bearer <key>` or `x-api-key`.
- Explicit route allowlist for `/gemini/v1beta`, `/vertex/v1`, `/vtx/v1`, and `/api/images/*`.
- Custom image routes with normalized `{ success, images[] }` responses.
- Request IDs, structured error envelopes, CORS allowlist, JSON byte cap, image count/decoded-byte caps, timeout, retry, and concurrency helpers.
- Google Vertex client factory now follows the CLIProxyAPI service-account pattern: read service account JSON, use `project_id`, `client_email`, and `private_key` server-side, never browser-side.

## Validation
- `npm --prefix gateway run compile`: pass after checking `vertex-account-2.json`.
- `npm run gateway:compile`: pass.
- `npm run gateway:test`: pass, 4 files / 9 tests.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- `npm run test`: pass, 71 files / 719 tests.
- `npm run build`: pass.

## Vertex Account Smoke
- Rejected file checked first: `/media/monet/SSD Web/CodeBase/vertex-account.json`.
- Observed JSON shape: top-level `installed`; no top-level `type`, `project_id`, `client_email`, or `private_key`.
- CLIProxyAPI reference requires a Google service account key JSON for Vertex import and validates `private_key`, `project_id`, and `client_email` before saving the auth record.
- Gateway now rejects OAuth installed/web client JSON at startup with a clear config error.
- Working file checked next: `/media/monet/SSD Web/CodeBase/vertex-account-2.json`.
- Observed JSON shape: `type: "service_account"` with top-level `project_id`, `client_email`, and `private_key`.
- Smoke env: `PORT=19087`, `GATEWAY_API_KEYS=local-test-key`, `GOOGLE_APPLICATION_CREDENTIALS=/media/monet/SSD Web/CodeBase/vertex-account-2.json`, `GOOGLE_VERTEX_LOCATION=us-central1`.
- `GET /healthz`: `200`, `{ ok: true }`.
- `GET /readyz`: `200`, service-account JSON mode, Vertex location `us-central1`.
- `POST /api/session/validate` with `gemini-2.5-flash` and prompt `Reply with exactly: ok`: `200`, response text `ok`.

## Vertex Model Smoke Matrix
- Credential file: `/media/monet/SSD Web/CodeBase/vertex-account-2.json`.
- Gateway env for the model matrix: `GOOGLE_VERTEX_LOCATION=global`.
- Text smoke route: `POST /api/session/validate` with prompt `Reply with exactly: ok`.
- Image smoke route: `POST /api/images/generate` with one `1:1` inline PNG request.

| Model | Text smoke | Image generate | Result |
| --- | --- | --- | --- |
| `gemini-2.5-flash` | `200`, response text `ok` | Not tested | Pass |
| `gemini-2.5-pro` | `200`, response text `ok` | Not tested | Pass |
| `gemini-2.5-flash-image` | `200`, response text `ok` | `200`, inline PNG returned | Pass |
| `gemini-3-pro-image` | `200` | `200`, inline PNG returned | Pass |
| `gemini-3.1-flash-image` | `200` | `200`, inline PNG returned | Pass |
| `gemini-3.5-flash` | `200`, response text `ok` | Not tested | Pass |
| `gemini-3.1-flash-lite` | `200`, response text `ok` | Not tested | Pass |
| `gemini-3-flash-preview` | `200`, response text `ok` | Not tested | Pass |
| `gemini-3.1-pro-preview` | `200`, response text `ok` | Not tested | Pass |
| `gemini-3-flash` | `404 NOT_FOUND` via gateway `500` | Not tested | Fail |
| `gemini-3.1-pro` | `404 NOT_FOUND` via gateway `500` | Not tested | Fail |
| `imagen-4.0-fast-generate-001` | Not tested | `404 NOT_FOUND` via gateway `500` | Fail |

Notes:
- `us-central1` produced region-limited `404 NOT_FOUND` for some model aliases, so `global` is the reliable location for this account/project.
- The `*-preview` aliases for `gemini-3-flash-preview` and `gemini-3.1-pro-preview` passed, while the non-preview `gemini-3-flash` and `gemini-3.1-pro` aliases did not pass for this account/project.
- `imagen-4.0-fast-generate-001` did not pass through this gateway/account in `global`; Vertex reported that the publisher model was not found or the project lacks access.

## Resolved Blocker
- The provided `vertex-account.json` is an OAuth client JSON, not a Vertex service account key JSON.
- `vertex-account-2.json` resolves this because it is a service account key JSON with server-side signing material.

## Remaining Notes
- Keep service account JSON server-side only; do not expose it through Vite/browser env.
- The app test suite still prints existing React `act(...)`, IndexedDB, and Google Drive config warnings, but all tests pass.
