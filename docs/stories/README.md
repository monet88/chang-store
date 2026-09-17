# Stories

Stories are bounded work packets. They connect product intent, implementation
scope, validation, and durable Harness state.

## Active or selected stories

| Story | Scope | Lane | Packet | Status |
| --- | --- | --- | --- | --- |
| US-001-three-provider-studios | Provider studio contract | high-risk | epics/E01-provider-studios/US-001-three-provider-studios/ | planned |
| US-002-docs-backfill-resync | Backup docs and current-code reconciliation | normal | epics/E02-docs-harness-sync/US-002-docs-backfill-resync.md | implemented |
| US-003-identity-transfer | Gemini Identity Transfer batch feature | normal | epics/E03-identity-transfer/US-003-identity-transfer.md | implemented |
| BUG-VTO-MULTI-GATEWAY | Multi-person gateway validation | normal | bugs/BUG-VTO-MULTI-GATEWAY/ | current branch packet |
| US-006-gateway-image-model-routing | Lớp 1+2: capability-driven image-model catalog + gateway profiles with `/v1/models` validation | high-risk | epics/E04-provider-gateways/US-006-gateway-image-model-routing/ | planned |

## Normal story

Use docs/templates/story.md for normal feature work.

Suggested path:

~~~text
docs/stories/epics/E01-domain-name/US-001-short-story-title.md
~~~

## High-risk story

Use docs/templates/high-risk-story/ when intake classifies work as high-risk.

Suggested path:

~~~text
docs/stories/epics/E02-risky-domain/US-012-risky-story-title/
  execplan.md
  overview.md
  design.md
  validation.md
~~~

## Status flow

~~~text
planned -> in_progress -> implemented
                  |
                  v
               changed
                  |
                  v
               retired
~~~

Durable story state is authoritative in harness.db; update the Markdown
packet and the Windows Harness CLI together.
