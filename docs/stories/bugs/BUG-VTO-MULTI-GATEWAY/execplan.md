# Exec Plan

## Goal

Prevent invalid Gemini image-size options from reaching the Vertex gateway in
Virtual Try-On and other shared Gemini image operations.

## Scope

In scope:

- Reproduce the invalid Flash-Lite request with a deterministic service test.
- Record per-model output-size support in the model registry.
- Clamp or omit unsupported `imageSize` values in edit and upscale requests.
- Make the shared resolution selector consume the same registry contract.
- Run focused and repository quality gates.

Out of scope:

- Live gateway changes.
- Provider studio behavior for Grok or GPT Image.
- API-key persistence or credential handling changes.

## Risk Classification

Risk flags:

- External systems.
- Existing behavior.
- Weak proof.
- Public contracts.

Hard gates:

- External provider behavior.

## Work Phases

1. Reproduce the request shape in a focused service test.
2. Verify the model contract against official Google documentation.
3. Implement a model-aware resolution contract and request guard.
4. Align the shared selector with the registry.
5. Run focused tests, typecheck, lint, full tests, and build.
6. Record Harness evidence and residual live-smoke risk.

## Stop Conditions

Pause for human confirmation if the fix requires a gateway contract change,
credential use, or weakened validation.