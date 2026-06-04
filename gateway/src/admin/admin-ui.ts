const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const renderAdminUi = (): string => {
  const bootstrapState = {
    provider: 'gemini',
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gateway Admin</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f2efe8;
        --panel: #fffdf8;
        --ink: #1f1d1a;
        --muted: #6a655e;
        --line: #d8d0c1;
        --accent: #0e6d5a;
        --accent-soft: #d8efe9;
        --danger: #a3352d;
        --danger-soft: #f7ddd8;
        --warn: #8a5b12;
        --warn-soft: #f7ecd0;
        --shadow: 0 16px 36px rgba(34, 25, 12, 0.08);
        --radius: 18px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(14, 109, 90, 0.08), transparent 28%),
          linear-gradient(180deg, #f9f6ef 0%, var(--bg) 100%);
      }
      .shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px;
      }
      .hero {
        display: grid;
        grid-template-columns: 1.3fr 0.9fr;
        gap: 18px;
        margin-bottom: 18px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }
      .hero-card {
        padding: 24px;
        min-height: 180px;
      }
      .hero-card h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 0.98;
        letter-spacing: -0.04em;
      }
      .hero-card p {
        margin: 0;
        max-width: 60ch;
        color: var(--muted);
        font-size: 15px;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .kpi {
        padding: 18px;
      }
      .kpi .label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .kpi .value {
        display: block;
        margin-top: 10px;
        font-size: 30px;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: 340px minmax(0, 1fr);
        gap: 18px;
      }
      .stack {
        display: grid;
        gap: 18px;
      }
      .section {
        padding: 20px;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      .section p,
      .hint {
        color: var(--muted);
        font-size: 13px;
      }
      .field,
      .toolbar {
        display: grid;
        gap: 10px;
      }
      .toolbar {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        margin-bottom: 14px;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 13px;
        color: var(--muted);
      }
      input,
      textarea,
      select,
      button {
        font: inherit;
      }
      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 12px;
        background: #fff;
        color: var(--ink);
      }
      textarea {
        min-height: 120px;
        resize: vertical;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 10px 16px;
        background: var(--accent);
        color: white;
        cursor: pointer;
        transition: transform 120ms ease, opacity 120ms ease;
      }
      button.secondary {
        background: #ece5d8;
        color: var(--ink);
      }
      button.danger {
        background: var(--danger);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      button:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 6px 10px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 600;
      }
      .badge.warn {
        background: var(--warn-soft);
        color: var(--warn);
      }
      .badge.danger {
        background: var(--danger-soft);
        color: var(--danger);
      }
      .status {
        margin: 0 0 14px;
        padding: 12px 14px;
        border-radius: 14px;
        font-size: 13px;
        background: #f3f0e8;
        color: var(--muted);
      }
      .status.error {
        background: var(--danger-soft);
        color: var(--danger);
      }
      .status.success {
        background: var(--accent-soft);
        color: var(--accent);
      }
      .cards {
        display: grid;
        gap: 12px;
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        background: #fff;
      }
      .card h3 {
        margin: 0;
        font-size: 16px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 10px;
        margin-top: 12px;
        font-size: 12px;
      }
      .meta strong {
        display: block;
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 4px;
      }
      .spark {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 4px;
        margin-top: 10px;
      }
      .spark span {
        height: 10px;
        border-radius: 999px;
        background: #e8e0d4;
      }
      .spark span.ok { background: var(--accent); }
      .spark span.fail { background: var(--danger); }
      .tabs {
        display: inline-flex;
        gap: 8px;
        padding: 4px;
        border-radius: 999px;
        background: #ece5d8;
        margin-bottom: 12px;
      }
      .tab {
        padding: 8px 12px;
        border-radius: 999px;
        background: transparent;
        color: var(--muted);
      }
      .tab.active {
        background: white;
        color: var(--ink);
      }
      .two-up {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .mono {
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 12px;
      }
      .hidden { display: none !important; }
      @media (max-width: 960px) {
        .hero,
        .grid {
          grid-template-columns: 1fr;
        }
        .kpis,
        .two-up {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <section class="panel hero-card">
          <div class="row">
            <span class="badge">Gateway Admin</span>
            <span class="badge warn" id="store-mode-badge">Store: unknown</span>
            <span class="badge" id="mutation-badge">Mutations: unknown</span>
          </div>
          <h1>Credential Pool Operations Console</h1>
          <p>Internal control plane for Gemini credential targets, pool health, runtime reload, and model catalog. This page is served by the gateway itself and talks only to same-origin <span class="mono">/admin/api/*</span>.</p>
        </section>
        <section class="kpis">
          <div class="panel kpi"><span class="label">Configured</span><span class="value" id="kpi-configured">0</span></div>
          <div class="panel kpi"><span class="label">Healthy</span><span class="value" id="kpi-healthy">0</span></div>
          <div class="panel kpi"><span class="label">Cooldown</span><span class="value" id="kpi-cooldown">0</span></div>
          <div class="panel kpi"><span class="label">Runtime Mode</span><span class="value" id="kpi-mode">-</span></div>
        </section>
      </div>

      <div id="status" class="status">Enter an admin token to load live gateway state.</div>

      <div class="grid">
        <div class="stack">
          <section class="panel section">
            <h2>Login</h2>
            <div class="field">
              <label>Admin Token
                <input id="token-input" type="password" autocomplete="off" placeholder="Bearer token" />
              </label>
              <label class="row">
                <input id="remember-session" type="checkbox" style="width:auto" />
                <span>Remember in sessionStorage for this tab only</span>
              </label>
              <div class="row">
                <button id="login-btn" type="button">Connect</button>
                <button id="logout-btn" type="button" class="secondary">Forget</button>
              </div>
              <p class="hint">Token stays in memory by default. Never stored in URL, cookies, or persistent browser storage.</p>
            </div>
          </section>

          <section class="panel section">
            <h2>Import Credential</h2>
            <div class="field">
              <label>Project
                <input id="import-project" type="text" placeholder="project-id" />
              </label>
              <label>Location
                <input id="import-location" type="text" value="global" />
              </label>
              <label>Label
                <input id="import-label" type="text" placeholder="Project A" />
              </label>
              <label>Weight
                <input id="import-weight" type="number" min="1" value="1" />
              </label>
              <label>Service Account JSON
                <input id="import-file" type="file" accept="application/json,.json" />
              </label>
              <button id="import-btn" type="button">Import Credential</button>
              <p class="hint" id="import-hint">Import is enabled only when the API reports writable file-store mode.</p>
            </div>
          </section>

          <section class="panel section">
            <h2>Security</h2>
            <div class="meta">
              <div><strong>API Mode</strong><span id="security-mode">-</span></div>
              <div><strong>Mutations</strong><span id="security-mutations">-</span></div>
              <div><strong>Selection</strong><span id="security-selection">-</span></div>
              <div><strong>Runtime Version</strong><span id="security-version">-</span></div>
            </div>
            <div class="row" style="margin-top:12px">
              <button id="reload-btn" type="button" class="secondary">Force Reload</button>
            </div>
            <p class="hint">If this is Docker/VPS file-store mode, mount a persistent host directory. Do not rely on ephemeral container storage for credentials.</p>
          </section>
        </div>

        <div class="stack">
          <section class="panel section">
            <div class="row" style="justify-content:space-between">
              <h2 style="margin:0">Credential Targets</h2>
              <button id="refresh-btn" type="button" class="secondary">Refresh</button>
            </div>
            <div class="cards" id="credential-list"></div>
          </section>

          <section class="panel section">
            <h2>Credential Detail</h2>
            <div class="two-up">
              <label>Credential ID
                <input id="detail-id" type="text" readonly />
              </label>
              <label>Email
                <input id="detail-email" type="text" readonly />
              </label>
              <label>Label
                <input id="detail-label" type="text" />
              </label>
              <label>Location
                <input id="detail-location" type="text" />
              </label>
              <label>Weight
                <input id="detail-weight" type="number" min="1" />
              </label>
              <label>Status
                <select id="detail-enabled">
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
            </div>
            <label style="margin-top:12px">Model Allowlist
              <textarea id="detail-allowlist" placeholder="one model id per line"></textarea>
            </label>
            <label>Model Exclusions
              <textarea id="detail-exclusions" placeholder="one model id per line"></textarea>
            </label>
            <div class="row" style="margin-top:12px">
              <button id="save-detail-btn" type="button">Save Changes</button>
              <button id="test-detail-btn" type="button" class="secondary">Test Target</button>
              <button id="delete-detail-btn" type="button" class="danger">Delete</button>
            </div>
          </section>

          <section class="panel section">
            <h2>Model Catalog</h2>
            <div class="tabs">
              <button id="tab-gemini" type="button" class="tab active">Gemini</button>
              <button id="tab-openai" type="button" class="tab">OpenAI</button>
            </div>
            <div class="two-up">
              <label>Default Model
                <input id="model-default" type="text" />
              </label>
              <label>Aliases (JSON object)
                <textarea id="model-aliases" class="mono" placeholder='{"fast":"gemini-2.5-flash"}'></textarea>
              </label>
            </div>
            <label>Allowlist
              <textarea id="model-allowlist" placeholder="one model id per line"></textarea>
            </label>
            <label>Disabled
              <textarea id="model-disabled" placeholder="one model id per line"></textarea>
            </label>
            <div class="row" style="margin-top:12px">
              <button id="save-model-btn" type="button">Save Model Catalog</button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <script id="bootstrap-state" type="application/json">${escapeHtml(JSON.stringify(bootstrapState))}</script>
    <script>
      (() => {
        const bootstrap = JSON.parse(document.getElementById('bootstrap-state').textContent);
        const state = {
          token: sessionStorage.getItem('gateway_admin_token') || '',
          remember: Boolean(sessionStorage.getItem('gateway_admin_token')),
          provider: bootstrap.provider || 'gemini',
          snapshot: null,
          selectedCredentialId: null,
          writable: false,
        };

        const $ = (id) => document.getElementById(id);
        const status = $('status');
        const tokenInput = $('token-input');
        const rememberSession = $('remember-session');
        const credentialList = $('credential-list');
        const importFile = $('import-file');
        const importProject = $('import-project');
        const importLocation = $('import-location');
        const importLabel = $('import-label');
        const importWeight = $('import-weight');
        const importHint = $('import-hint');
        const ids = {
          configured: $('kpi-configured'),
          healthy: $('kpi-healthy'),
          cooldown: $('kpi-cooldown'),
          mode: $('kpi-mode'),
          storeBadge: $('store-mode-badge'),
          mutationBadge: $('mutation-badge'),
          securityMode: $('security-mode'),
          securityMutations: $('security-mutations'),
          securitySelection: $('security-selection'),
          securityVersion: $('security-version'),
          detailId: $('detail-id'),
          detailEmail: $('detail-email'),
          detailLabel: $('detail-label'),
          detailLocation: $('detail-location'),
          detailWeight: $('detail-weight'),
          detailEnabled: $('detail-enabled'),
          detailAllowlist: $('detail-allowlist'),
          detailExclusions: $('detail-exclusions'),
          modelDefault: $('model-default'),
          modelAliases: $('model-aliases'),
          modelAllowlist: $('model-allowlist'),
          modelDisabled: $('model-disabled'),
        };

        tokenInput.value = state.token;
        rememberSession.checked = state.remember;

        const setStatus = (message, tone = '') => {
          status.textContent = message;
          status.className = 'status' + (tone ? ' ' + tone : '');
        };

        const authHeaders = () => ({
          'Authorization': 'Bearer ' + state.token,
          'Content-Type': 'application/json',
        });

        const splitLines = (value) => value.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);

        const renderSpark = (recent = []) => {
          const spans = Array.from({ length: 10 }, (_, index) => {
            const event = recent[recent.length - 10 + index];
            if (!event) return '<span></span>';
            return '<span class="' + (event.ok ? 'ok' : 'fail') + '"></span>';
          });
          return '<div class="spark">' + spans.join('') + '</div>';
        };

        const renderCredentialList = () => {
          const snapshot = state.snapshot;
          if (!snapshot || !Array.isArray(snapshot.vertexPools) || snapshot.vertexPools.length === 0) {
            credentialList.innerHTML = '<div class="card"><p class="hint">No credential targets yet.</p></div>';
            return;
          }
          credentialList.innerHTML = snapshot.vertexPools.map((entry) => {
            const health = entry.health || { status: entry.enabled ? 'healthy' : 'disabled', success: 0, failure: 0, recent: [] };
            const badgeClass = health.status === 'cooldown' ? 'badge warn' : (entry.enabled ? 'badge' : 'badge danger');
            return '<div class="card">' +
              '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
                '<div>' +
                  '<h3>' + (entry.label || entry.id) + '</h3>' +
                  '<p class="hint mono" style="margin:6px 0 0">' + entry.id + '</p>' +
                '</div>' +
                '<span class="' + badgeClass + '">' + (health.status || 'unknown') + '</span>' +
              '</div>' +
              '<div class="meta">' +
                '<div><strong>Project</strong><span>' + (entry.project || '-') + '</span></div>' +
                '<div><strong>Email</strong><span class="mono">' + (entry.email || '-') + '</span></div>' +
                '<div><strong>Location</strong><span>' + (entry.location || '-') + '</span></div>' +
                '<div><strong>Weight</strong><span>' + (entry.weight || 1) + '</span></div>' +
                '<div><strong>Success</strong><span>' + (health.success || 0) + '</span></div>' +
                '<div><strong>Failure</strong><span>' + (health.failure || 0) + '</span></div>' +
              '</div>' +
              renderSpark(health.recent || []) +
              '<div class="row" style="margin-top:12px">' +
                '<button type="button" data-action="select" data-id="' + entry.id + '">Inspect</button>' +
                '<button type="button" class="secondary" data-action="test" data-id="' + entry.id + '">Test</button>' +
                '<button type="button" class="danger" data-action="delete" data-id="' + entry.id + '"' + (state.writable ? '' : ' disabled') + '>Delete</button>' +
              '</div>' +
            '</div>';
          }).join('');
        };

        const fillCredentialDetail = (entry) => {
          state.selectedCredentialId = entry ? entry.id : null;
          ids.detailId.value = entry?.id || '';
          ids.detailEmail.value = entry?.email || '';
          ids.detailLabel.value = entry?.label || '';
          ids.detailLocation.value = entry?.location || '';
          ids.detailWeight.value = String(entry?.weight || 1);
          ids.detailEnabled.value = String(entry?.enabled !== false);
          ids.detailAllowlist.value = (entry?.modelAllowlist || []).join('\\n');
          ids.detailExclusions.value = (entry?.modelExclusions || []).join('\\n');
        };

        const fillModelEditor = () => {
          const catalog = state.snapshot?.modelCatalog?.[state.provider] || { aliases: {}, allowlist: [], disabled: [] };
          ids.modelDefault.value = catalog.defaultModel || '';
          ids.modelAliases.value = JSON.stringify(catalog.aliases || {}, null, 2);
          ids.modelAllowlist.value = (catalog.allowlist || []).join('\\n');
          ids.modelDisabled.value = (catalog.disabled || []).join('\\n');
          $('tab-gemini').classList.toggle('active', state.provider === 'gemini');
          $('tab-openai').classList.toggle('active', state.provider === 'openai');
        };

        const updateSummary = () => {
          const runtime = state.snapshot?.runtime?.active;
          const mode = state.snapshot?.mode || state.snapshot?.runtime?.mode || '-';
          const mutable = Boolean(state.snapshot?.mutable);
          const targetCount = runtime?.targetCount || state.snapshot?.vertexPools?.length || 0;
          ids.configured.textContent = String(targetCount);
          ids.healthy.textContent = String(runtime?.healthyTargets || 0);
          ids.cooldown.textContent = String(runtime?.cooldownTargets || 0);
          ids.mode.textContent = String(state.snapshot?.runtime?.mode || mode);
          ids.storeBadge.textContent = 'Store: ' + mode;
          ids.mutationBadge.textContent = 'Mutations: ' + (mutable ? 'enabled' : 'read-only');
          ids.securityMode.textContent = mode;
          ids.securityMutations.textContent = mutable ? 'enabled' : 'read-only';
          ids.securitySelection.textContent = state.snapshot?.runtime?.active?.selection || '-';
          ids.securityVersion.textContent = String(state.snapshot?.runtime?.active?.version || '-');
          state.writable = mutable && mode === 'file-store';
          $('import-btn').disabled = !state.writable;
          $('save-detail-btn').disabled = !state.writable;
          $('delete-detail-btn').disabled = !state.writable;
          $('save-model-btn').disabled = !state.writable;
          importHint.textContent = state.writable
            ? 'Writable file-store is active. Import and delete are enabled.'
            : 'Mutations are disabled or the API is read-only static-config.';
        };

        const fetchJson = async (path, options = {}) => {
          if (!state.token) throw new Error('Connect with an admin token first.');
          const response = await fetch(path, {
            credentials: 'same-origin',
            ...options,
            headers: {
              ...(options.headers || {}),
              'Authorization': 'Bearer ' + state.token,
            },
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body?.error?.message || ('Request failed with ' + response.status));
          }
          return body;
        };

        const refreshAll = async () => {
          try {
            const [health, credentials, gemini, openai] = await Promise.all([
              fetchJson('/admin/api/health'),
              fetchJson('/admin/api/vertex-credentials'),
              fetchJson('/admin/api/models?provider=gemini'),
              fetchJson('/admin/api/models?provider=openai'),
            ]);
            state.snapshot = {
              ...credentials,
              runtime: health.runtime,
              modelCatalog: { gemini, openai },
            };
            renderCredentialList();
            updateSummary();
            const selected = state.snapshot.vertexPools.find((entry) => entry.id === state.selectedCredentialId) || state.snapshot.vertexPools[0];
            fillCredentialDetail(selected || null);
            fillModelEditor();
            setStatus('Gateway admin state loaded.', 'success');
          } catch (error) {
            setStatus(error.message || String(error), 'error');
          }
        };

        const rememberToken = () => {
          state.token = tokenInput.value.trim();
          state.remember = rememberSession.checked;
          if (state.remember && state.token) {
            sessionStorage.setItem('gateway_admin_token', state.token);
          } else {
            sessionStorage.removeItem('gateway_admin_token');
          }
        };

        $('login-btn').addEventListener('click', async () => {
          rememberToken();
          await refreshAll();
        });

        $('logout-btn').addEventListener('click', () => {
          state.token = '';
          tokenInput.value = '';
          sessionStorage.removeItem('gateway_admin_token');
          state.snapshot = null;
          state.selectedCredentialId = null;
          credentialList.innerHTML = '';
          fillCredentialDetail(null);
          setStatus('Admin token cleared.');
        });

        $('refresh-btn').addEventListener('click', refreshAll);
        $('reload-btn').addEventListener('click', async () => {
          try {
            await fetchJson('/admin/api/runtime/reload', { method: 'POST' });
            await refreshAll();
          } catch (error) {
            setStatus(error.message || String(error), 'error');
          }
        });

        $('import-btn').addEventListener('click', async () => {
          try {
            if (!state.writable) throw new Error('API is read-only. Import is disabled.');
            const file = importFile.files && importFile.files[0];
            if (!file) throw new Error('Choose a JSON file first.');
            const raw = await file.text();
            const credential = JSON.parse(raw);
            await fetchJson('/admin/api/vertex-credentials/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project: importProject.value.trim(),
                location: importLocation.value.trim(),
                label: importLabel.value.trim(),
                weight: Number(importWeight.value || '1'),
                credential,
              }),
            });
            importFile.value = '';
            importLabel.value = '';
            await refreshAll();
          } catch (error) {
            importFile.value = '';
            setStatus(error.message || String(error), 'error');
          }
        });

        credentialList.addEventListener('click', async (event) => {
          const target = event.target.closest('button[data-id]');
          if (!target) return;
          const id = target.getAttribute('data-id');
          const action = target.getAttribute('data-action');
          const entry = state.snapshot?.vertexPools?.find((item) => item.id === id);
          if (!entry) return;
          if (action === 'select') {
            fillCredentialDetail(entry);
            return;
          }
          if (action === 'test') {
            try {
              await fetchJson('/admin/api/vertex-credentials/' + encodeURIComponent(id) + '/test', { method: 'POST' });
              await refreshAll();
            } catch (error) {
              setStatus(error.message || String(error), 'error');
            }
            return;
          }
          if (action === 'delete') {
            try {
              if (!state.writable) throw new Error('API is read-only. Delete is disabled.');
              await fetchJson('/admin/api/vertex-credentials/' + encodeURIComponent(id), { method: 'DELETE' });
              await refreshAll();
            } catch (error) {
              setStatus(error.message || String(error), 'error');
            }
          }
        });

        $('save-detail-btn').addEventListener('click', async () => {
          try {
            if (!state.selectedCredentialId) throw new Error('Select a credential first.');
            await fetchJson('/admin/api/vertex-credentials/' + encodeURIComponent(state.selectedCredentialId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                label: ids.detailLabel.value,
                location: ids.detailLocation.value,
                weight: Number(ids.detailWeight.value || '1'),
                enabled: ids.detailEnabled.value === 'true',
                modelAllowlist: splitLines(ids.detailAllowlist.value),
                modelExclusions: splitLines(ids.detailExclusions.value),
              }),
            });
            await refreshAll();
          } catch (error) {
            setStatus(error.message || String(error), 'error');
          }
        });

        $('test-detail-btn').addEventListener('click', async () => {
          try {
            if (!state.selectedCredentialId) throw new Error('Select a credential first.');
            await fetchJson('/admin/api/vertex-credentials/' + encodeURIComponent(state.selectedCredentialId) + '/test', {
              method: 'POST',
            });
            await refreshAll();
          } catch (error) {
            setStatus(error.message || String(error), 'error');
          }
        });

        $('delete-detail-btn').addEventListener('click', async () => {
          try {
            if (!state.selectedCredentialId) throw new Error('Select a credential first.');
            if (!state.writable) throw new Error('API is read-only. Delete is disabled.');
            await fetchJson('/admin/api/vertex-credentials/' + encodeURIComponent(state.selectedCredentialId), {
              method: 'DELETE',
            });
            state.selectedCredentialId = null;
            await refreshAll();
          } catch (error) {
            setStatus(error.message || String(error), 'error');
          }
        });

        $('tab-gemini').addEventListener('click', () => { state.provider = 'gemini'; fillModelEditor(); });
        $('tab-openai').addEventListener('click', () => { state.provider = 'openai'; fillModelEditor(); });

        $('save-model-btn').addEventListener('click', async () => {
          try {
            if (!state.writable) throw new Error('API is read-only. Model edits are disabled.');
            await fetchJson('/admin/api/models/' + encodeURIComponent(state.provider), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                defaultModel: ids.modelDefault.value.trim(),
                aliases: ids.modelAliases.value.trim() ? JSON.parse(ids.modelAliases.value) : {},
                allowlist: splitLines(ids.modelAllowlist.value),
                disabled: splitLines(ids.modelDisabled.value),
              }),
            });
            await refreshAll();
          } catch (error) {
            setStatus(error.message || String(error), 'error');
          }
        });

        if (state.token) {
          refreshAll();
        }
      })();
    </script>
  </body>
</html>`;
};
