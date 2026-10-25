import type { NextConfig } from "next";

const appProfile =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank" ? "blank" : "personal";

const nextConfig: NextConfig = {
  // Static HTML export so Electron can load the app without a Node server.
  output: "export",
  images: {
    unoptimized: true,
  },
  // Always a concrete string so the blank Firebase client is left out of personal builds.
  env: {
    NEXT_PUBLIC_APP_PROFILE: appProfile,
  },
};

export default nextConfig;
