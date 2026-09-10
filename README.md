# Weekly Strategy

School week planner — set one weekly focus, add daily priorities, and track subject targets. Plans save in the browser (localStorage).

Also available as a **Windows desktop app** (Electron), same pattern as the Gift/mortgage app setup.

## Requirements

- Node.js 20+
- npm

## Web (browser)

```bat
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## Desktop app (Windows)

### Option A — installable `.exe` (recommended)

Build once on your PC:

```bat
cd %USERPROFILE%\Projects\school-app
git pull
npm install
npm run dist
```

Then open:

- Installer: `release\Weekly Strategy Setup 0.1.0.exe`
- Or portable: `release\win-unpacked\Weekly Strategy.exe`

After installing, launch **Weekly Strategy** from the Start Menu like any other app.

### Option B — develop in a desktop window

Terminal 1:

```bat
npm run dev
```

Terminal 2 (after the server is ready):

```bat
npm run electron:dev
```

## Scripts

| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Web dev server on port 43123 (Webpack; Windows-safe)     |
| `npm run build`      | Static production build (`out/`)                         |
| `npm run electron`   | Open desktop app from last build                         |
| `npm run electron:dev` | Desktop window pointed at the local dev server         |
| `npm run dist`       | Build static site + Windows installer via electron-builder |
| `npm run lint`       | Run ESLint                                               |

> Dev uses `--webpack` so it works on Windows machines that block Next’s native SWC binary (Turbopack requires that binary).

## Stack

- Next.js (App Router, static export)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Electron + electron-builder (Windows)
