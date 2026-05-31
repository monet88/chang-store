import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HOOKS_DIR = path.join(PROJECT_ROOT, 'src', 'hooks');

/**
 * Shared provider helper hooks (`useProvider*.ts`) must stay service-agnostic:
 * the provider-SPECIFIC studio hooks (`useGrokStudio` / `useGptImageStudio`)
 * intentionally own provider service/config imports, but the reusable helpers
 * they compose must NOT — they take injected callbacks instead (Red Team #2).
 *
 * Scope is `useProvider*.ts` only (Validation Session 2 confirmed decision).
 */
const STUDIO_HOOKS = new Set(['useGrokStudio.ts', 'useGptImageStudio.ts']);

const FORBIDDEN = [
  { reason: 'imports from src/services are forbidden in shared provider helper hooks', pattern: /from\s+['"](?:@\/services|\.\.\/services)/ },
  { reason: 'imports from src/config are forbidden in shared provider helper hooks', pattern: /from\s+['"](?:@\/config|\.\.\/config)/ },
];

async function collectSharedProviderHooks(): Promise<string[]> {
  const entries = await fs.readdir(HOOKS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /^useProvider.*\.ts$/.test(e.name) && !STUDIO_HOOKS.has(e.name))
    .map((e) => path.join(HOOKS_DIR, e.name))
    .sort();
}

describe('provider helper hook boundary', () => {
  it('finds the shared useProvider* helper hooks', async () => {
    const files = await collectSharedProviderHooks();
    expect(files.length).toBeGreaterThan(0);
  });

  it('forbids service/config imports in shared useProvider*.ts helpers', async () => {
    const files = await collectSharedProviderHooks();
    const violations: string[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const rel = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
      content.split('\n').forEach((line, i) => {
        for (const { reason, pattern } of FORBIDDEN) {
          if (pattern.test(line)) {
            violations.push(`- ${rel}:${i + 1} | ${reason} | ${line.trim()}`);
          }
        }
      });
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
