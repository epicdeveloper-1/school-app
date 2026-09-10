const { contextBridge } = require("electron");

// Reserved for future native APIs (notifications, file save, etc.).
contextBridge.exposeInMainWorld("weeklyStrategy", {
  platform: process.platform,
  isDesktop: true,
});
