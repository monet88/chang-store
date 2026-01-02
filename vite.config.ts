import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
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
              'vendor-axios': ['axios'],
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
