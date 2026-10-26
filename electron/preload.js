const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("weeklyStrategy", {
  platform: process.platform,
  isDesktop: true,
  getItem: (key) => ipcRenderer.invoke("storage:get", key),
  setItem: (key, value) => ipcRenderer.invoke("storage:set", key, value),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
});
