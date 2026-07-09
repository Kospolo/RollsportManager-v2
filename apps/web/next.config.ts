import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo: Workspace-Root explizit setzen (mehrere Lockfiles auf dem System).
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
