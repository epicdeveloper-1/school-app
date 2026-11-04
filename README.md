# Weekly Strategy

School week planner — set one weekly focus, add daily priorities, and track subject targets. Plans always save locally (Electron files or browser localStorage).

Optional **Google cloud sync** (personal desktop): add Firebase web keys to `.env.local`, rebuild, then Sign in with Google under Settings. Local writes stay first; Firestore mirrors your account only. Other Google accounts are unaffected.

**Web profiles**

- **Friend live site** — blank planner (`NEXT_PUBLIC_APP_PROFILE=blank`). Safe for other Google accounts. Will not overwrite blobs tagged as personal.
- **Personal web (mobile)** — same UI as desktop. CI deploys Hosting channel `personal` on every push to `main` (see the workflow summary for the URL). Sign in with the same Google account as desktop.

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
```

To enable cloud sync on the personal desktop build, copy `.env.example` to `.env.local`, fill in `NEXT_PUBLIC_FIREBASE_*`, then:

```bat
npm run dist
```

Without Firebase env vars, the installer still works; everything stays on-disk only.

Then open:

- Installer: `release\Weekly Strategy Setup 0.1.0.exe`
- Or portable: `release\win-unpacked\Weekly Strategy.exe`

After installing, launch **Weekly Strategy** from the Start Menu like any other app.

> The desktop shell serves the static build over `http://127.0.0.1` so CSS/JS load correctly (loading `file://` breaks Next asset paths).

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
