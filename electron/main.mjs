import { app, BrowserWindow, shell } from 'electron';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');
const preloadPath = path.join(__dirname, 'preload.cjs');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
let staticServer = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        let filePath = path.join(distDir, decodeURIComponent(parsedUrl.pathname));

        // Prevent directory traversal
        if (!filePath.startsWith(distDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        // SPA fallback: return index.html for unknown client routes
        if (!fs.existsSync(filePath)) {
          filePath = path.join(distDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const stream = fs.createReadStream(filePath);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        });
        stream.pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      staticServer = server;
      resolve(`http://127.0.0.1:${address.port}/`);
    });

    server.on('error', reject);
  });
}

async function isDevServerRunning(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#050505',
    title: 'Chang Store',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      webSecurity: false, // Bypasses CORS and Mixed-Content for custom/local gateways
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = 'http://127.0.0.1:3549/';
  const useDev = process.argv.includes('--dev') && (await isDevServerRunning(devUrl));

  if (useDev) {
    console.log(`Connecting to Vite dev server at ${devUrl}...`);
    await mainWindow.loadURL(devUrl);
  } else {
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      console.warn('dist/index.html not found. Building first is recommended.');
    }
    const localUrl = await startStaticServer();
    console.log(`Serving Chang Store desktop from ${localUrl}...`);
    await mainWindow.loadURL(localUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
