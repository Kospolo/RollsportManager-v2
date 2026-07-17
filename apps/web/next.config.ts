import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo: Workspace-Root explizit setzen (mehrere Lockfiles auf dem System).
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  // Eigener Build-/Dev-Ausgabeordner NUR wenn RSM_DIST_DIR gesetzt ist (sonst
  // Standard `.next`). So kann eine parallele Verifikation (eigener Port) laufen,
  // ohne den `.next` eines bereits laufenden Dev-Servers zu überschreiben.
  ...(process.env.RSM_DIST_DIR ? { distDir: process.env.RSM_DIST_DIR } : {}),
};

export default nextConfig;
