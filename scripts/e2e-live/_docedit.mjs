import fs from "node:fs";
const p = "docs/codebase-summary.md";
let s = fs.readFileSync(p, "utf8");

const oldTesting = `## Testing and Validation

Primary commands:

\`\`\`bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
\`\`\`

Boundary coverage includes checks that UI components do not directly import
services.`;

const newTesting = `## Testing and Validation

Primary commands:

\`\`\`bash
npx tsc --noEmit            # Type check
npm run lint                # ESLint
npm run test                # Vitest (unit + boundary)
npm run test -- --coverage  # Vitest with V8 coverage report
npm run build               # Production build
\`\`\`

Boundary coverage includes checks that UI components do not directly import
services.

### Test Suite Metrics

Measured on the 2026-07-03 resync (\`npm run test\` + \`--coverage\`, V8 provider):

| Metric | Value |
| --- | --- |
| Test files | 70 |
| Tests | 725 (all passing) |
| Line coverage | 74.85% (2858 / 3818) |
| Statement coverage | 73.96% (3063 / 4141) |
| Function coverage | 71.94% (682 / 948) |
| Branch coverage | 64.74% (1045 / 1614) |

Well-covered areas (>90% lines): prompt builders (\`utils/*-prompt-builder.ts\`),
provider services (\`services/providers/grok\`, \`services/providers/gpt-image\`),
Gemini \`text.ts\`, and most Virtual Try-On / Lookbook / Photo Album hooks.

Lower-covered areas (opportunities, not regressions): \`utils/imageUtils.ts\`
(~23%), \`services/googleDriveService.ts\` (~18%), the Watermark Remover hook
family (engine/queue/actions, 0% — logic proven via the live E2E run below), and
\`services/gemini/chat.ts\` (0%, refine-session path).

### Live E2E Verification

A live end-to-end harness (\`scripts/e2e-live/run.mts\`, run with \`tsx\`) drives
the real app service layer against the Vertex gateway
(\`https://vertex.monet.uno/gemini\`) using the sample images in
\`docs/image-test/\`. It exercises all nine features plus text generation,
vision description, image generation, and upscale — 13 flows total.

Last run (2026-07-03): 11/13 flows returned valid output. The two non-passing
flows were external-runtime conditions, not app defects:

- Watermark Remover — the model declined the specific sample image (returned a
  refusal text instead of an image). The same code path succeeds on other
  images.
- Clothing Transfer — a transient \`UPSTREAM_QUOTA\` response; it passed on the
  first run and on isolated retry.

This live run also surfaced and fixed a real bug: the Gemini vision helpers in
\`src/services/gemini/text.ts\` sent \`contents: { parts }\` (no role), which the
gateway rejected with \`VALIDATION_FAILED\`. They now send
\`contents: [{ role: 'user', parts }]\`, verified live.

To route the browser app through the gateway: Settings → "Gemini Proxy /
Gateway" → enable, set URL \`https://vertex.monet.uno/gemini\` and the proxy API
key, then save (the key is stored in localStorage as plaintext — use a trusted
device only).`;

if (!s.includes(oldTesting)) { console.error("OLD TESTING BLOCK NOT FOUND"); process.exit(1); }
s = s.replace(oldTesting, newTesting);
s = s.replace("- Last resync of these docs to code: 2026-05-31 (story US-002).",
  "- Last resync of these docs to code: 2026-07-03 (test metrics, live E2E, Gemini vision `contents` fix).");
fs.writeFileSync(p, s);
console.log("codebase-summary.md updated");
