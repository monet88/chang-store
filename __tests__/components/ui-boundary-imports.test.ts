import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

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

const TSX_SCRIPT_KIND = ts.ScriptKind.TSX;

async function collectComponentSourceFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectComponentSourceFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && /\.tsx?$/.test(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function getUiFiles(): Promise<string[]> {
  const componentFiles = await collectComponentSourceFiles(COMPONENTS_DIR);
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

function getNodeLine(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function addImportUsage(
  usages: ImportUsage[],
  sourceFile: ts.SourceFile,
  filePath: string,
  sourceNode: ts.StringLiteral,
  statementNode: ts.Node,
): void {
  const source = sourceNode.text;

  usages.push({
    filePath,
    line: getNodeLine(sourceFile, statementNode),
    source,
    statement: statementNode.getText(sourceFile).replace(/\s+/g, ' ').trim(),
    resolvedPath: resolveImportPath(filePath, source),
  });
}

function extractImportUsages(filePath: string, content: string): ImportUsage[] {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, TSX_SCRIPT_KIND);
  const usages: ImportUsage[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      addImportUsage(usages, sourceFile, filePath, node.moduleSpecifier, node);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addImportUsage(usages, sourceFile, filePath, node.moduleSpecifier, node);
    }

    if (
      ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && (
        node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      )
    ) {
      addImportUsage(usages, sourceFile, filePath, node.arguments[0], node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return usages.sort((left, right) => left.line - right.line || left.statement.localeCompare(right.statement));
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
  it('extracts every import form that can cross the UI boundary', () => {
    const usages = extractImportUsages(
      path.join(COMPONENTS_DIR, 'Example.tsx'),
      `
        import { editImage } from '@/services/imageEditingService';
        import '@/config/modelRegistry';
        const service = await import('../services/imageEditingService');
        const registry = require('../config/modelRegistry');
        export { MODEL_REGISTRY } from '@/config/modelRegistry';
      `,
    );

    expect(usages.map((usage) => usage.source)).toEqual([
      '@/services/imageEditingService',
      '@/config/modelRegistry',
      '../services/imageEditingService',
      '../config/modelRegistry',
      '@/config/modelRegistry',
    ]);
    expect(findForbiddenSourceViolations(usages)).toHaveLength(5);
  });

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
