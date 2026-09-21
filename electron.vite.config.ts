import path from 'node:path';
import { defineConfig } from 'electron-vite';
import { createRendererConfig } from './vite.config';

export default defineConfig(({ mode }) => {
  const rendererConfig = createRendererConfig(mode, { desktop: true });
  const rendererRollup = rendererConfig.build?.rollupOptions;

  return {
    main: {
      build: {
        outDir: 'out/main',
        lib: {
          entry: path.resolve(__dirname, 'electron/main.ts'),
        },
        rollupOptions: {
          output: {
            format: 'cjs',
            entryFileNames: 'index.cjs',
          },
        },
      },
    },
    preload: {
      build: {
        outDir: 'out/preload',
        lib: {
          entry: path.resolve(__dirname, 'electron/preload.ts'),
        },
        rollupOptions: {
          output: {
            format: 'cjs',
            entryFileNames: 'index.cjs',
          },
        },
      },
    },
    renderer: {
      ...rendererConfig,
      root: '.',
      build: {
        ...rendererConfig.build,
        outDir: 'out/renderer',
        rollupOptions: {
          ...rendererRollup,
          input: path.resolve(__dirname, 'index.html'),
        },
      },
    },
  };
});
