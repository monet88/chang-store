import fs from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react-swc'; // SWC is 20-30x faster than Babel

const API_ROOT = path.resolve(__dirname, 'api');

interface DevApiRoute {
  modulePath: string;
  segments: string[];
  score: number;
}

function isDynamicSegment(segment: string) {
  return segment.startsWith('[') && segment.endsWith(']');
}

function routeFromRelativePath(relativePath: string): DevApiRoute {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const withoutExtension = normalizedPath.replace(/\.ts$/, '');
  const parts = withoutExtension.split('/');
  const segments = parts[parts.length - 1] === 'index' ? parts.slice(0, -1) : parts;
  const score = segments.reduce((total, segment) => total + (isDynamicSegment(segment) ? 1 : 10), 0);

  return {
    modulePath: `/api/${normalizedPath}`,
    segments,
    score,
  };
}

function collectApiRoutes(dir: string, root = dir): DevApiRoute[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes: DevApiRoute[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('_')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...collectApiRoutes(fullPath, root));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      routes.push(routeFromRelativePath(path.relative(root, fullPath)));
    }
  }

  return routes.sort((a, b) => b.score - a.score);
}

function matchApiRoute(urlPathname: string, routes: DevApiRoute[]): DevApiRoute | null {
  const requestPath = urlPathname.replace(/^\/api\/?/, '');
  const requestSegments = requestPath.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.segments.length !== requestSegments.length) {
      continue;
    }

    const matched = route.segments.every((segment, index) => (
      isDynamicSegment(segment) || segment === requestSegments[index]
    ));

    if (matched) {
      return route;
    }
  }

  return null;
}

async function readRequestBody(req: NodeJS.ReadableStream, method?: string): Promise<string | undefined> {
  if (!method || method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function sendWebResponse(response: Response, res: NodeJS.WritableStream & {
  statusCode: number;
  statusMessage: string;
  setHeader: (name: string, value: string | string[]) => void;
  end: (chunk?: Buffer) => void;
}) {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;

  const setCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (setCookie && setCookie.length > 0) {
    res.setHeader('Set-Cookie', setCookie);
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }
    res.setHeader(key, value);
  });

  const body = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
  res.end(body);
}

function devApiBridge(): Plugin {
  const routes = collectApiRoutes(API_ROOT);

  return {
    name: 'dev-api-bridge',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host ?? 'localhost:3000'}`);
        const route = matchApiRoute(url.pathname, routes);
        if (!route) {
          return next();
        }

        try {
          const mod = await server.ssrLoadModule(route.modulePath);
          const handler = mod.default as { fetch?: (request: Request) => Promise<Response> } | undefined;
          if (!handler?.fetch) {
            return next();
          }

          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              value.forEach((entry) => headers.append(name, entry));
            } else if (value !== undefined) {
              headers.set(name, value);
            }
          }

          const body = await readRequestBody(req, req.method);
          const request = new Request(url.toString(), {
            method: req.method,
            headers,
            body,
          });

          const response = await handler.fetch(request);
          await sendWebResponse(response, res as typeof res & {
            statusCode: number;
            statusMessage: string;
            setHeader: (name: string, value: string | string[]) => void;
            end: (chunk?: Buffer) => void;
          });
        } catch (error) {
          if (error instanceof Error) {
            server.ssrFixStacktrace(error);
          }
          next(error);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',

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
      plugins: [devApiBridge(), react()],
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
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
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
