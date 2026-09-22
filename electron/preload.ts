import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_GATEWAY_CHANNELS, type DesktopGatewayApi } from '../src/platform/desktopGateway';
import { DESKTOP_LOCAL_QWEN_CHANNELS, type DesktopLocalQwenApi } from '../src/platform/desktopLocalQwen';

contextBridge.exposeInMainWorld(
  'desktopEnv',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
  }),
);

const desktopGateway: DesktopGatewayApi = {
  storeCredential: (input) => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.storeCredential, input),
  removeCredential: (input) => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.removeCredential, input),
  clearCredentials: () => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.clearCredentials),
  listGatewayModels: (input) => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.listGatewayModels, input),
  geminiGenerateContent: (input) => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.geminiGenerateContent, input),
  gptImageGenerate: (input) => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.gptImageGenerate, input),
  gptImageEdit: (input) => ipcRenderer.invoke(DESKTOP_GATEWAY_CHANNELS.gptImageEdit, input),
};

contextBridge.exposeInMainWorld('desktopGateway', Object.freeze(desktopGateway));

const desktopLocalQwen: DesktopLocalQwenApi = {
  getStatus: () => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.getStatus),
  startServer: (folder) => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.startServer, folder),
  stopServer: () => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.stopServer),
  generateImage: (params) => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.generateImage, params),
  cancelJob: () => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.cancelJob),
  upscaleImage: (params) => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.upscaleImage, params),
  verifyFolder: (folder) => ipcRenderer.invoke(DESKTOP_LOCAL_QWEN_CHANNELS.verifyFolder, folder),
};

contextBridge.exposeInMainWorld('desktopLocalQwen', Object.freeze(desktopLocalQwen));
