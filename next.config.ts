import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export so Electron can load the app without a Node server.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
