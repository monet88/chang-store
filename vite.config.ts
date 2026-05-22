import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc'; // SWC is 20-30x faster than Babel

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        // Default to localhost for security; set VITE_ENABLE_LAN=true for cross-device testing
        host: process.env.VITE_ENABLE_LAN === 'true' ? '0.0.0.0' : undefined,

        // Exclude unnecessary directories from file watching
        watch: {
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/coverage/**',
            '**/.beads/**',
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
        // Only inject Gemini API key in explicit development mode
        // Production must use serverless proxy - see docs/deployment.md
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID)
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
});
