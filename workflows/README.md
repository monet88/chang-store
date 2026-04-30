# Workflow Kill-Switch: Inngest Fallback

Slice 3 uses Vercel Workflow as the primary durable execution provider. If Vercel Workflow is unavailable (beta instability, production incidents, or local dev without Vercel CLI), the system falls back to Inngest polling-based execution.

## Enabling the fallback

Set `INNGEST_FALLBACK=true` in the Vercel environment or `.env.local`.

## Testing the canary

The canary workflow (`workflows/canary.ts`) validates active provider health before any real job runs. Call `initializeRunner()` — it runs `runCanary()` internally and throws if both providers are unavailable.

## Rollback to Vercel Workflow

1. Set `VERCEL_WORKFLOW_ENABLED=true`
2. Set `INNGEST_FALLBACK=false`
3. Redeploy

## When to use the fallback

- Vercel Workflow beta blocks or timeouts
- Production incidents requiring immediate mitigation
- Local development without the Vercel CLI
- Canary failure on Vercel Workflow path

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VERCEL_WORKFLOW_ENABLED` | `false` | Enable Vercel Workflow provider |
| `INNGEST_FALLBACK` | `false` | Force Inngest polling-based fallback |
