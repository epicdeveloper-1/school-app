import type { NextConfig } from "next";

const appProfile =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank" ? "blank" : "personal";

const nextConfig: NextConfig = {
  // Static HTML export so Electron can load the app without a Node server.
  output: "export",
  images: {
    unoptimized: true,
  },
  // Concrete profile string for client bundles. Personal builds may still include
  // Firebase when NEXT_PUBLIC_FIREBASE_* are set (optional desktop cloud sync).
  env: {
    NEXT_PUBLIC_APP_PROFILE: appProfile,
  },
};

export default nextConfig;
