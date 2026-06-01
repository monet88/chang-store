# Stories

Stories are work packets. They turn product intent into bounded implementation
and validation work.

## Active Stories

| Story | Epic | Lane | Packet | Status |
| --- | --- | --- | --- | --- |
| US-001-three-provider-studios | E01 Provider Studios | high-risk | `epics/E01-provider-studios/US-001-three-provider-studios/` | planned |
| US-002-docs-backfill-resync | E02 Docs/Harness Sync | normal | `epics/E02-docs-harness-sync/US-002-docs-backfill-resync.md` | implemented |

## Normal Story

Use `docs/templates/story.md` for normal feature work.

Suggested path:

```text
docs/stories/epics/E01-domain-name/US-001-short-story-title.md
```

## High-Risk Story

Use `docs/templates/high-risk-story/` when the feature intake classifies work as
high-risk.

Suggested path:

```text
docs/stories/epics/E02-risky-domain/US-012-risky-story-title/
  execplan.md
  overview.md
  design.md
  validation.md
```

## Status Flow

```text
planned -> in_progress -> implemented
                  |
                  v
               changed
                  |
                  v
               retired
```
