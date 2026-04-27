import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

interface ImportUsage {
  filePath: string;
  line: number;
  source: string;
  statement: string;
  resolvedPath: string | null;
}

interface Violation {
  reason: string;
  usage: ImportUsage;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const APP_FILE = path.join(PROJECT_ROOT, 'src', 'App.tsx');
const COMPONENTS_DIR = path.join(PROJECT_ROOT, 'src', 'components');

const IMPORT_STATEMENT_REGEX = /import(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;

async function collectComponentTsxFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectComponentTsxFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function getUiFiles(): Promise<string[]> {
  const componentFiles = await collectComponentTsxFiles(COMPONENTS_DIR);
  return [APP_FILE, ...componentFiles];
}

function resolveImportPath(filePath: string, source: string): string | null {
  if (source.startsWith('@/')) {
    return path.resolve(PROJECT_ROOT, 'src', source.slice(2));
  }

  if (source.startsWith('./') || source.startsWith('../')) {
    return path.resolve(path.dirname(filePath), source);
  }

  return null;
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function extractImportUsages(filePath: string, content: string): ImportUsage[] {
  const usages: ImportUsage[] = [];

  for (const match of content.matchAll(IMPORT_STATEMENT_REGEX)) {
    const source = match[1];
    const statement = match[0].replace(/\s+/g, ' ').trim();
    const line = content.slice(0, match.index).split('\n').length;
    const resolvedPath = resolveImportPath(filePath, source);

    usages.push({
      filePath,
      line,
      source,
      statement,
      resolvedPath,
    });
  }

  return usages;
}

async function collectUiImportUsages(): Promise<ImportUsage[]> {
  const uiFiles = await getUiFiles();
  const usages: ImportUsage[] = [];

  for (const filePath of uiFiles) {
    const content = await fs.readFile(filePath, 'utf-8');
    usages.push(...extractImportUsages(filePath, content));
  }

  return usages;
}

function findForbiddenSourceViolations(usages: ImportUsage[]): Violation[] {
  const checks: Array<{ reason: string; pattern: RegExp }> = [
    { reason: 'imports from src/services/gemini are forbidden in UI layer', pattern: /\/src\/services\/gemini(?:\/|$)/ },
    { reason: 'imports from src/services are forbidden in UI layer', pattern: /\/src\/services(?:\/|$)/ },
    { reason: 'imports from src/config are forbidden in UI layer', pattern: /\/src\/config(?:\/|$)/ },
  ];

  return usages
    .filter((usage) => usage.resolvedPath !== null)
    .flatMap((usage) => {
      const normalizedResolved = toPosixPath(usage.resolvedPath!);
      const match = checks.find((check) => check.pattern.test(normalizedResolved));

      if (!match) {
        return [];
      }

      return [{ reason: match.reason, usage }];
    });
}

function findWrongSourceTypeViolations(usages: ImportUsage[]): Violation[] {
  const typeChecks: Array<{ typeName: string; invalidSource: RegExp; reason: string }> = [
    {
      typeName: 'RefinementHistoryItem',
      invalidSource: /\/src\/services(?:\/|$)/,
      reason: 'RefinementHistoryItem must come from src/types.ts (not services)',
    },
    {
      typeName: 'RedesignPreset',
      invalidSource: /\/src\/services(?:\/|$)/,
      reason: 'RedesignPreset must come from src/types.ts (not services)',
    },
    {
      typeName: 'RegisteredModel',
      invalidSource: /\/src\/config(?:\/|$)/,
      reason: 'RegisteredModel must not be imported in UI layer',
    },
  ];

  return usages
    .filter((usage) => usage.resolvedPath !== null)
    .flatMap((usage) => {
      const normalizedResolved = toPosixPath(usage.resolvedPath!);

      return typeChecks
        .filter((typeCheck) => {
          const typeRegex = new RegExp(`\\b${typeCheck.typeName}\\b`);
          return typeRegex.test(usage.statement) && typeCheck.invalidSource.test(normalizedResolved);
        })
        .map((typeCheck) => ({
          reason: typeCheck.reason,
          usage,
        }));
    });
}

function formatViolations(title: string, violations: Violation[]): string {
  if (violations.length === 0) {
    return '';
  }

  const lines = violations
    .sort((a, b) => {
      const fileCompare = a.usage.filePath.localeCompare(b.usage.filePath);
      if (fileCompare !== 0) {
        return fileCompare;
      }

      return a.usage.line - b.usage.line;
    })
    .map(({ reason, usage }) => {
      const relPath = toPosixPath(path.relative(PROJECT_ROOT, usage.filePath));
      return `- ${relPath}:${usage.line} | ${reason} | ${usage.statement}`;
    });

  return `${title}\n${lines.join('\n')}`;
}

describe('UI boundary import enforcement', () => {
  it('blocks App.tsx and components/**/*.tsx imports from services or config', async () => {
    const usages = await collectUiImportUsages();
    const violations = findForbiddenSourceViolations(usages);

    expect(
      violations,
      formatViolations('Forbidden UI-layer imports found:', violations),
    ).toEqual([]);
  });

  it('blocks wrong-source type imports for boundary contracts', async () => {
    const usages = await collectUiImportUsages();
    const violations = findWrongSourceTypeViolations(usages);

    expect(
      violations,
      formatViolations('Wrong-source UI type imports found:', violations),
    ).toEqual([]);
  });
});
