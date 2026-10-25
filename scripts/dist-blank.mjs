import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profilePath = path.join(root, "electron", "app-profile.json");

const personalProfile = {
  profile: "personal",
  appName: "Weekly Strategy",
};

const blankProfile = {
  profile: "blank",
  appName: "Weekly Strategy Blank",
};

function writeProfile(profile) {
  fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function buildWeb(profile) {
  const nextPublic =
    profile === "blank"
      ? { NEXT_PUBLIC_APP_PROFILE: "blank" }
      : { NEXT_PUBLIC_APP_PROFILE: "personal" };
  await run("npm", ["run", "build"], nextPublic);
}

let packed = false;

try {
  writeProfile(blankProfile);
  await buildWeb("blank");
  await run("npx", ["electron-builder", "--config", "electron-builder.blank.json"]);
  packed = true;
} finally {
  writeProfile(personalProfile);
  try {
    await buildWeb("personal");
  } catch (err) {
    console.error(err);
    if (packed) {
      console.error(
        "Friend installer was created, but the personal web build failed to restore. Run npm run build before opening the desktop app from this repo.",
      );
    }
    process.exitCode = 1;
  }
}

if (!packed) process.exitCode = 1;
else console.log("Blank installer ready in release-blank");
