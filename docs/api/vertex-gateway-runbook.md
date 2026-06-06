# Vertex Gateway Runbook

## Purpose

Operational notes for the `gateway/` service deployed on `vertex.monet.uno`.

## Current Production Shape

- Public URL: `https://vertex.monet.uno`
- Public docs: `https://vertex.monet.uno/docs`
- TLS termination: host `nginx` on the VPS
- Backend container: `vertex-gateway`
- Backend bind: `127.0.0.1:19089 -> container:8080`
- VPS host: `chang-gateway-vm`
- TLS cert: `/etc/letsencrypt/live/monet.uno/fullchain.pem`

## Important Files On VPS

- Deploy bundle root: `/home/monet/vertex-gateway`
- Compose file: `/home/monet/vertex-gateway/docker-compose.yml`
- Runtime env: `/home/monet/vertex-gateway/gateway/.env`
- Gateway config: `/home/monet/vertex-gateway/gateway/config.yaml`
- Service account files: `/home/monet/vertex-gateway/gateway/accounts/`
- Nginx vhost: `/etc/nginx/sites-available/vertex.monet.uno`
- Enabled symlink: `/etc/nginx/sites-enabled/vertex.monet.uno`

## Current Runtime Values

- Gateway API key: `monet-4292`
- Local upstream port: `19089`
- Google credentials path in container: `/run/vertex-accounts/active.json`
- Google project: `project-b82b6a5a-13c8-42e4-a56`
- Google location: `global`

## Redeploy

From the VPS:

```bash
cd /home/monet/vertex-gateway
sudo docker compose up -d --build
sudo nginx -t
sudo systemctl reload nginx
```

## Logs And Status

Container:

```bash
sudo docker ps --format '{{.Names}} {{.Ports}}'
sudo docker logs --tail 200 vertex-gateway
```

Host nginx:

```bash
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx -n 100 --no-pager
sudo nginx -t
```

Ports:

```bash
sudo ss -ltnp | egrep '(:19089|:443|:80|:8333)'
```

## Smoke Tests

Health:

```bash
curl -s https://vertex.monet.uno/healthz
curl -s https://vertex.monet.uno/readyz
```

Developer docs:

```bash
open https://vertex.monet.uno/docs
```

Docs page notes:

- Public route, no gateway API key required
- Includes copy buttons for cURL and JavaScript examples
- Includes streaming example snippets for client implementers

OpenAI-compatible models:

```bash
curl -s https://vertex.monet.uno/openai/v1/models \
  -H "Authorization: Bearer monet-4292"
```

Gemini-compatible models:

```bash
curl -s https://vertex.monet.uno/gemini/v1beta/models \
  -H "Authorization: Bearer monet-4292"
```

OpenAI-compatible chat:

```bash
curl -s https://vertex.monet.uno/openai/v1/chat/completions \
  -H "Authorization: Bearer monet-4292" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Reply with exactly: OPENAI_OK"}],
    "max_tokens": 64
  }'
```

Gemini-compatible text:

```bash
curl -s https://vertex.monet.uno/gemini/v1beta/models/gemini-2.5-flash:generateContent \
  -H "Authorization: Bearer monet-4292" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "Reply with exactly: GEMINI_OK"}]}]
  }'
```

OpenAI-compatible image generation:

```bash
curl -s https://vertex.monet.uno/openai/v1/images/generations \
  -H "Authorization: Bearer monet-4292" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash-image",
    "prompt": "Generate a tiny red square icon on white background",
    "size": "1024x1024"
  }'
```

## Known Notes

- `GET /gemini/v1beta/models` requires the gateway API key.
- `GET /docs` is public HTML for developers and does not require the gateway API key.
- `vertex.monet.uno` is exposed via host nginx, not Docker nginx.
- Existing CLI proxy remains separate at `vps.monet.uno` and `vps.monet.uno:8333`.
- Certbot renew hook already reloads host nginx after cert renewal.
