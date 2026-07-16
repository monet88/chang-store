# Implementation Note

- Decision not in request: the fix covers shared upscale requests because they
  used the same invalid `imageSize` contract as Virtual Try-On edits.
- Decision not in request: model resolution support lives in `modelRegistry.ts`
  so the UI and provider service consume one source of truth.
- Deviation: the component reads that contract through
  `useModelImageResolutions` to preserve the repository's UI boundary rule that
  components do not import `src/config` directly.
- Tradeoff: unsupported stale selections are clamped to the model's first
  supported size instead of throwing a new client-side error.
- Review fix: upscale prompt wording now uses the model's effective output size,
  so Flash-Lite no longer receives a 1K config paired with a 2K text instruction.
- Review fix: selectable resolutions use native radio semantics and keyboard
  behavior; fixed-resolution models expose a labeled read-only model limit.
- Security: the API key pasted in chat was not written to files, environment
  variables, commands, or logs.
- Follow-up: Harness backlog #8 tracks repo-wide hook dependency linting;
  backlog #9 tracks model-aware resolution for text-to-image generation.
- Friction: the Harness docs-sync checker reports broad pre-existing snapshot
  drift and a missing executable bit on `scripts/harness`; resolving those
  unrelated records is outside this provider bugfix.
- Live proof: the ignored local `.env` gateway key authenticated successfully,
  and three independent Flash-Lite Virtual Try-On requests returned valid JPEG
  images. Two concurrent connections timed out locally and passed when retried
  sequentially, so gateway/model validation is proven while local burst
  transport remains a low-level environmental risk.