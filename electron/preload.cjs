/* eslint-disable @typescript-eslint/no-require-imports */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopEnv', {
  isDesktop: true,
  platform: process.platform,
});
