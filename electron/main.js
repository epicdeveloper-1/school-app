const { app, BrowserWindow } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const isDev = process.argv.includes("--dev");

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {http.Server | null} */
let staticServer = null;

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
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind static server"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: "Weekly Strategy",
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
