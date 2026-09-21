import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_GATEWAY_CHANNELS, type DesktopGatewayApi } from '../src/platform/desktopGateway';

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
