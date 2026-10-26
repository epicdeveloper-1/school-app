const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function readAppProfile() {
  const fallback = { profile: "personal", appName: "Weekly Strategy" };
  try {
    const profilePath = path.join(__dirname, "app-profile.json");
    const parsed = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      profile:
        typeof parsed.profile === "string" ? parsed.profile : fallback.profile,
      appName:
        typeof parsed.appName === "string" && parsed.appName.trim()
          ? parsed.appName.trim()
          : fallback.appName,
    };
  } catch {
    return fallback;
  }
}

const appProfile = readAppProfile();
if (appProfile.profile === "blank") {
  app.setName(appProfile.appName);
}

const isDev = process.argv.includes("--dev");
/** Fixed port for the packaged static server. */
const STATIC_PORT = 43124;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {http.Server | null} */
let staticServer = null;

function storageFilePath(key) {
  const safe = String(key).replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(app.getPath("userData"), "storage", `${safe}.json`);
}

ipcMain.handle("storage:get", (_event, key) => {
  try {
    const file = storageFilePath(key);
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    console.error("storage:get failed", err);
    return null;
  }
});

function chromeExecutable() {
  const candidates =
    process.platform === "win32"
      ? [
          process.env.PROGRAMFILES &&
            path.join(
              process.env.PROGRAMFILES,
              "Google",
              "Chrome",
              "Application",
              "chrome.exe",
            ),
          process.env["PROGRAMFILES(X86)"] &&
            path.join(
              process.env["PROGRAMFILES(X86)"],
              "Google",
              "Chrome",
              "Application",
              "chrome.exe",
            ),
          process.env.LOCALAPPDATA &&
            path.join(
              process.env.LOCALAPPDATA,
              "Google",
              "Chrome",
              "Application",
              "chrome.exe",
            ),
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : [];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function externalHttpUrl(raw) {
  try {
    const parsed = new URL(String(raw));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Open a web link in Google Chrome. Falls back to the default browser. */
function openInGoogleChrome(raw) {
  const url = externalHttpUrl(raw);
  if (!url) return false;
  const chrome = chromeExecutable();
  if (chrome) {
    const child = spawn(chrome, [url], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  }
  void shell.openExternal(url);
  return true;
}

ipcMain.handle("shell:open-external", (_event, url) => openInGoogleChrome(url));

ipcMain.handle("storage:set", (_event, key, value) => {
  try {
    const file = storageFilePath(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(value), "utf8");
    return true;
  } catch (err) {
    console.error("storage:set failed", err);
    return false;
  }
});

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveOutDir() {
  // Dev / unpackaged: <repo>/out
  // Packaged: resources/app.asar/out or resources/app/out
  return path.join(__dirname, "..", "out");
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const root = path.resolve(rootDir);
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        let urlPath = decodeURIComponent(url.pathname);
        if (urlPath === "/") urlPath = "/index.html";
        if (urlPath.endsWith("/")) urlPath += "index.html";

        const candidate = path.resolve(path.join(root, urlPath));
        if (!candidate.startsWith(root)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        const tryPaths = [candidate];
        if (!path.extname(candidate)) {
          tryPaths.push(`${candidate}.html`, path.join(candidate, "index.html"));
        }

        const filePath = tryPaths.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!filePath) {
          // SPA-style fallback for client routes
          const fallback = path.join(root, "index.html");
          if (fs.existsSync(fallback)) {
            res.writeHead(200, { "Content-Type": contentType(fallback) });
            res.end(fs.readFileSync(fallback));
            return;
          }
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        res.writeHead(200, { "Content-Type": contentType(filePath) });
        res.end(fs.readFileSync(filePath));
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end("Server error");
      }
    });

    server.once("error", reject);
    server.listen(STATIC_PORT, "127.0.0.1", () => {
      resolve({ server, port: STATIC_PORT });
    });
  });
}

async function createWindow() {
  const iconPath = path.join(__dirname, "icon.ico");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: appProfile.appName,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (externalHttpUrl(url)) {
      openInGoogleChrome(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!externalHttpUrl(url)) return;
    event.preventDefault();
    openInGoogleChrome(url);
  });

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:43123");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const outDir = resolveOutDir();
    if (!fs.existsSync(path.join(outDir, "index.html"))) {
      console.error("Missing static build at", outDir, "- run npm run build first");
      // Still open something so the window isn't blank forever
      await mainWindow.loadURL(
        pathToFileURL(path.join(__dirname, "..", "out", "index.html")).toString(),
      );
    } else {
      const { server, port } = await startStaticServer(outDir);
      staticServer = server;
      await mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
