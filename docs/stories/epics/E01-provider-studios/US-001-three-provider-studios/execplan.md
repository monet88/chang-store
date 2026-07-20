# Exec Plan

## Goal

Implement isolated Gemini, Grok, and GPT Image studios without regressing the current Gemini workspace.

## Scope

- Phase 1: studio shell, header switcher, sidebar swap, provider-mode UtilityDock behavior.
- Phase 2: shared provider settings panel, result grid, retry utility, response parser, typed errors, prompt validation, and context-backed provider settings.
- Phase 3: Grok studio and service contract.
- Phase 4: GPT Image studio and service contract.
- Phase 5: tests, docs, Harness evidence, and quality gates.

## Risk Classification

High-risk because the work changes app navigation, introduces browser-exposed external provider keys, and adds provider-specific network contracts that can fail silently if modeled incorrectly.

## Work Phases

1. Complete plan remediation and story packet.
2. Recheck official provider docs before implementation starts.
3. Implement one phase at a time and validate each phase before continuing.
4. Keep Gemini code paths isolated and covered by regression tests.
5. Update docs only after implementation behavior is verified.

## Stop Conditions

- Official provider docs contradict the current request contract.
- `ApiProviderContext` cannot safely own provider settings without broader architecture changes.
- Provider response cannot produce local `ImageFile[]` without a proxy or URL conversion path.
- Any quality gate fails because of a real behavioral issue.
- CodeGraph blast-radius analysis reports HIGH or CRITICAL risk for a symbol that must be changed.
