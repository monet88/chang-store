/**
 * Vitest Configuration
 *
 * Unit test configuration for Chang-Store React 19 application.
 * Configured with jsdom environment and v8 coverage provider.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      /** Path alias mapping '@' to src/ directory */
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    /** jsdom environment for DOM testing */
    environment: 'jsdom',
    /** Enable global test APIs (describe, it, expect) */
    globals: true,
    /** Setup file for @testing-library/jest-dom matchers */
    setupFiles: './setupTests.ts',
    /** Test file patterns to include */
    include: ['**/*.test.ts', '**/*.test.tsx'],
    /** Ignore generated artifacts and agent worktrees */
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.claude/worktrees/**'],
    /** Coverage configuration */
    coverage: {
      /** Use v8 for native coverage collection */
      provider: 'v8',
      /** Output formats: text for CLI, json for CI, html for detailed view */
      reporter: ['text', 'json', 'html'],
      /** Source directories to measure coverage for */
      include: [
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
        'src/contexts/**/*.tsx',
        'src/hooks/**/*.ts',
      ],
      /** Exclude test files and infrastructure from coverage */
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/node_modules/**',
        '**/__mocks__/**',
      ],
      /** Coverage thresholds - build fails if not met */
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
