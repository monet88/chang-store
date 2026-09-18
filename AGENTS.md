# Agent Instructions

## Agent skills

### Issue tracker

GitHub issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` at root). See `docs/agents/domain.md`.

### Gateway and provider contracts

`docs/api/` holds one measured contract per gateway, named `docs/api/<gateway>-api-guide.md`.

Before wiring a new gateway, provider, or model route:

1. List the contracts already in `docs/api/` and check whether that gateway is documented. When
   it is, reuse that contract instead of writing a second one beside it.
2. When it is not, add `docs/api/<gateway>-api-guide.md` **in the same change that wires it** —
   base URL, auth, endpoints, accepted model ids, measured quirks with dates, and a re-verify
   recipe.
3. Never leave a route in the code that no contract describes, and never delete a contract while
   a live route or another doc still points at it.
