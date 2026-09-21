import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell } from 'electron';
import { registerDesktopGatewayHandlers } from './gateway';
import { registerDesktopLocalQwenHandlers, localQwenManager } from './localQwenManager';

let mainWindow: BrowserWindow | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

const isExternalHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isAppNavigation = (value: string): boolean => {
  try {
    const target = new URL(value);
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
      return target.origin === new URL(process.env.ELECTRON_RENDERER_URL).origin;
    }
    if (target.protocol !== 'file:') {
      return false;
    }
    return path.normalize(fileURLToPath(target)) === path.normalize(path.join(__dirname, '../renderer/index.html'));
  } catch {
    return false;
  }
};

const createWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#050505',
    title: 'Chang Store',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow = window;

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show();
    }
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load', { errorCode, errorDescription, validatedURL });
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited unexpectedly', details);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isAppNavigation(url)) {
      return;
    }
    event.preventDefault();
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
};

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.name);
  }

  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  let isStoppingComfyUI = false;
  app.on('before-quit', (event) => {
    if (localQwenManager.isAppOwned && !isStoppingComfyUI) {
      event.preventDefault();
      isStoppingComfyUI = true;
      void localQwenManager.stopServer().finally(() => {
        app.quit();
      });
    }
  });

  void app
    .whenReady()
    .then(async () => {
      registerDesktopGatewayHandlers();
      registerDesktopLocalQwenHandlers();
      await createWindow();

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          await createWindow();
        }
      });
    })
    .catch((error) => {
      console.error('Failed to start Chang Store desktop', error);
      app.quit();
    });
}
