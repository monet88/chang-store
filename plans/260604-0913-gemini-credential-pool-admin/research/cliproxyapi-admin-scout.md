# CLIProxyAPI Admin Scout

## Local Reference Links

- Repo root: [.ref/CLIProxyAPI](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI)
- Overview: [README.md](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/README.md)
- Auth-file management surface: [internal/api/handlers/management/auth_files.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/internal/api/handlers/management/auth_files.go)
- Vertex import flow: [internal/api/handlers/management/vertex_import.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/internal/api/handlers/management/vertex_import.go)
- Model-definition management: [internal/api/handlers/management/model_definitions.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/internal/api/handlers/management/model_definitions.go)
- Local file-store reference: [sdk/auth/filestore.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/sdk/auth/filestore.go)

## Summary

CLIProxyAPI is useful prior art for credential and model management UX, but it is broader than Chang Store needs. Borrow the redacted credential cards, import/validate/list/enable/delete/test flow, static model catalog, and success/failure health counters. Avoid the broad multi-provider management framework.

## Worth Borrowing

- Credential lifecycle: import -> validate -> normalize -> save -> list -> enable/disable -> delete.
- Redacted metadata shape: project, email, location, disabled/enabled, label, success/failure, recent request buckets.
- Model catalog as a server-defined API instead of UI hardcoding.
- Model catalog edits need a defined source-of-truth schema before admin endpoints exist.
- Admin protection separate from normal API keys.
- No raw credential JSON in list/detail responses.

## Avoid

- Full Claude/Codex/Anthropic/Kimi/xAI provider dashboard.
- Generic management API call console.
- Arbitrary proxy/base-url controls.
- Storing service-account JSON in browser state or local storage.
- Treating files written only inside a disposable container layer as durable persistence.
- Writing credential/model store state without reloading the live runtime pool.

## Security Notes

Service-account JSON is a secret. Admin import must validate `type: "service_account"`, `project_id`, `client_email`, and `private_key`; reject OAuth installed/web client JSON; sanitize IDs and filenames; and never log or echo raw private keys.

The CLIProxyAPI-style local file store fits local Docker and Linux VM/VPS deployment when backed by a mounted persistent host directory. It should not be treated as durable on Cloud Run. For this MVP, Cloud Run mutable import is out of scope and file-store mutations should be hard-disabled when `K_SERVICE` is present.
