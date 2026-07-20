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
- Scope addition: the Virtual Try-On prompt now explicitly preserves face
  identity, facial features, age, body type, and subject-image lighting; the
  builder tests were updated to assert the new wording.
- Scope addition: fixed-resolution model-limit copy now comes from the English
  and Vietnamese locale dictionaries instead of a hardcoded UI string.
- Tooling decision: Windows Harness operations use the repo-local executable
  `scripts/bin/harness-cli.exe` directly; `scripts/harness` remains the
  POSIX/Git Bash launcher only.
- Tooling decision: the Windows executable is tracked in the repository so a
  fresh clone has the required native entrypoint; the command registry now
  documents only subcommands exposed by this binary, with CodeGraph as the
  sole semantic code-intelligence source.
- Cleanup decision: generated Repomix output and retired GitNexus-specific
  artifacts/rules were removed; historical audit records remain unchanged.
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

- Review fix (items 1-4): shared `resolveImageSizeConfig` /
  `resolveEffectiveImageResolution` live in `modelRegistry.ts`;
  `useModelImageResolutions` owns stale-state normalization and fixed/effective
  flags so `ResolutionSelector` only renders; Flash-Lite edit omits no longer
  drop `imageSize` (always `1K`); this follow-up stays in app/test files only
  and does not touch harness tooling.
