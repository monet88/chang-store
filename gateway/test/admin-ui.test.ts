import { describe, expect, it } from 'vitest';
import { renderAdminUi } from '../src/admin/admin-ui.js';

describe('admin ui', () => {
  it('renders a self-contained dashboard shell with login, credentials, and models sections', () => {
    const html = renderAdminUi();

    expect(html).toContain('Gateway Admin');
    expect(html).toContain('Credential Pool Operations Console');
    expect(html).toContain('id="token-input"');
    expect(html).toContain('id="credential-list"');
    expect(html).toContain('id="import-file"');
    expect(html).toContain('id="model-default"');
    expect(html).toContain('/admin/api/vertex-credentials/import');
    expect(html).toContain('/admin/api/models/');
    expect(html).toContain('sessionStorage');
    expect(html).not.toContain('localStorage');
  });
});
