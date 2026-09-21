import path from 'path';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // SWC is 20-30x faster than Babel

export const createRendererConfig = (
  mode: string,
  { desktop = false }: { desktop?: boolean } = {},
): UserConfig => {
  const env = loadEnv(mode, '.', '');
  const rendererSecret = (value: string | undefined): string | undefined =>
    desktop ? undefined : value;
  return {
    base: desktop ? './' : undefined,
    server: {
      port: 3549,
      // Fail loudly instead of silently drifting to another port when 3549 is taken.
      strictPort: true,
      // Default to localhost for security; set VITE_ENABLE_LAN=true for cross-device testing
      // Explicit IPv4 loopback: `localhost` resolves to ::1 first on Windows, so anything that
      // probes 127.0.0.1 (the hub's `ready.port` check, curl, other agents) never saw the server.
      host: process.env.VITE_ENABLE_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',

      // Exclude unnecessary directories from file watching
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/out/**',
          '**/coverage/**',
          '**/.beads/**',
          // .kiro bundles a Python venv with thousands of files that exhaust
          // the OS inotify watcher limit (ENOSPC) on Linux.
          '**/.kiro/**',
          // Playwright MCP writes snapshots/console logs here during browser
          // testing; watching it triggers HMR full-reloads that wipe app state.
          '**/.playwright-mcp/**',
          // Harness/docs tooling rewrites these constantly. None are part of the
          // app bundle, so watching them only causes spurious dev reloads.
          '**/docs/**',
          '**/*.md',
          '**/harness.db',
          '**/plans/**',
          '**/.claude/**',
        ],
      },
    },
    plugins: [react()],
    // Pre-bundle heavy dependencies for faster dev startup
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime', // Explicitly include JSX runtime
        '@google/genai',
      ],
      // Force dependency re-optimization on config changes
      force: false,
      // Enable esbuild optimization for dependencies
      esbuildOptions: {
        target: 'es2020',
      },
    },
    define: {
      // Web keeps the existing client-side provider contract. Desktop receives
      // no build-time provider keys; its real credentials are owned by Electron main.
      'process.env.CLIPROXY_API_KEY': JSON.stringify(rendererSecret(env.CLIPROXY_API_KEY || env.VITE_CLIPROXY_API_KEY)),
      // Provider studio keys/base URLs use non-prefixed hosting names with a
      // VITE_-prefixed fallback for local .env files.
      'process.env.GPT_IMAGE_API_KEY': JSON.stringify(rendererSecret(env.GPT_IMAGE_API_KEY || env.VITE_GPT_IMAGE_API_KEY)),
      'process.env.GPT_IMAGE_BASE_URL': JSON.stringify(env.GPT_IMAGE_BASE_URL || env.VITE_GPT_IMAGE_BASE_URL),
      // XomPet is the measured reference gateway for the image lane: when both are set,
      // its values win for the GPT Image provider (docs/api/xompet-image-api-guide.md).
      'process.env.XOMPET_API_KEY': JSON.stringify(rendererSecret(env.XOMPET_API_KEY || env.VITE_XOMPET_API_KEY)),
      'process.env.XOMPET_BASE_URL': JSON.stringify(env.XOMPET_BASE_URL || env.VITE_XOMPET_BASE_URL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      // Manual chunks to optimize bundle splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - separate large dependencies
            'vendor-react': ['react', 'react-dom'],
            'vendor-genai': ['@google/genai'],
          }
        }
      },
      // Target modern browsers for smaller output
      target: 'es2020',
      // Enable minification optimizations
      minify: 'esbuild',
    },
    esbuild: {
      // Drop console.log in production, keep console.error for debugging
      drop: mode === 'production' ? ['debugger'] : [],
      pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    }
  };
};

export default defineConfig(({ mode }) => createRendererConfig(mode));
