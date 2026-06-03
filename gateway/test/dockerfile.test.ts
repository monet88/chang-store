import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('gateway Dockerfile', () => {
  it('uses a lockfile-backed npm ci install for reproducible image builds', () => {
    const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

    expect(dockerfile).toContain('package-lock.json');
    expect(dockerfile).toContain('RUN npm ci');
    expect(dockerfile).not.toContain('RUN npm install');
  });
});
