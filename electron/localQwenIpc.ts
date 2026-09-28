import { ipcMain } from 'electron';
import {
  DESKTOP_LOCAL_QWEN_CHANNELS,
} from '../src/platform/desktopLocalQwen';
import {
  localQwenManager,
  LocalQwenManager,
  parseLocalQwenFolder,
  parseLocalQwenGenerateParams,
  parseLocalQwenUpscaleParams,
} from './localQwenManager';
import { trustedBridge } from './gateway';

/**
 * Electron transport for the Local Qwen manager: the manager itself is free of
 * `electron` imports so the dev server can host the same instance over HTTP
 * (see `vite-plugins/localQwenDevBridge.ts`). This file is the only place the
 * two are joined.
 */
export const registerDesktopLocalQwenHandlers = (
  manager: LocalQwenManager = localQwenManager,
): void => {
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.getStatus, (event, folder) =>
    trustedBridge(event, () => manager.getStatus(parseLocalQwenFolder(folder))),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.startServer, (event, folder) =>
    trustedBridge(event, () => {
      const parsedFolder = parseLocalQwenFolder(folder);
      return manager.startServer(parsedFolder);
    }),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.stopServer, (event) =>
    trustedBridge(event, () => manager.stopServer()),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.generateImage, (event, params) =>
    trustedBridge(event, () => {
      const validated = parseLocalQwenGenerateParams(params);
      return manager.generateImage(validated);
    }),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.cancelJob, (event) =>
    trustedBridge(event, () => manager.cancelJob()),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.upscaleImage, (event, params) =>
    trustedBridge(event, () => {
      const validated = parseLocalQwenUpscaleParams(params);
      return manager.upscaleImage(validated);
    }),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.verifyFolder, (event, folder) =>
    trustedBridge(event, () => {
      const parsedFolder = parseLocalQwenFolder(folder);
      return manager.checkFolder(parsedFolder || '');
    }),
  );
};
