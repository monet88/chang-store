import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld(
  'desktopEnv',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
  }),
);
