import path from "node:path";
import type { NextConfig } from "next";

/**
 * RSM_DOCKER=1 — Build läuft im Container (Dockerfile), NICHT im Monorepo.
 * Dort ist `apps/web` die Wurzel: eigenes package.json, eigenes Lockfile,
 * eigene node_modules. Deshalb entfällt der Monorepo-Root (er zeigte im
 * Container auf "/" und würde die Datei-Verfolgung über das ganze Dateisystem
 * schicken), und stattdessen wird `standalone` erzeugt.
 */
const inDocker = process.env.RSM_DOCKER === "1";

/**
 * RSM_BETA=1 — dieser Build ist die öffentliche Beta (beta.rollsportmanager.de).
 * Sie darf NICHT in Suchmaschinen landen: Sie zeigt dieselben Texte wie die
 * Produktivseite rollsportmanager.de. Google würde das als doppelten Inhalt
 * werten und im Zweifel die falsche der beiden Seiten anzeigen — die Beta
 * würde der echten Seite also ihr eigenes Ranking wegnehmen.
 * Zwei Sperren, weil sie Unterschiedliches können:
 *   robots.txt (app/robots.ts) hält Crawler fern, entfernt aber nichts, was
 *   schon im Index steht — im Gegenteil, eine gesperrte Seite kann dort ohne
 *   Beschreibung hängenbleiben.
 *   X-Robots-Tag (hier) wirkt auf JEDE Antwort und nimmt bereits indexierte
 *   Seiten wieder heraus.
 */
const isBeta = process.env.RSM_BETA === "1";

const nextConfig: NextConfig = {
  // Monorepo: Workspace-Root explizit setzen (mehrere Lockfiles auf dem System).
  ...(inDocker
    ? { output: "standalone" as const }
    : { turbopack: { root: path.join(__dirname, "..", "..") } }),
  // Eigener Build-/Dev-Ausgabeordner NUR wenn RSM_DIST_DIR gesetzt ist (sonst
  // Standard `.next`). So kann eine parallele Verifikation (eigener Port) laufen,
  // ohne den `.next` eines bereits laufenden Dev-Servers zu überschreiben.
  ...(process.env.RSM_DIST_DIR ? { distDir: process.env.RSM_DIST_DIR } : {}),
  // Sicherheits-Header für ALLE Builds. Wichtigster Punkt: Clickjacking-Schutz
  // (frame-ancestors/X-Frame-Options) — die Auth liegt als localStorage-Bearer
  // im selben Origin, ein eingebetteter Frame trüge die Session mit. Eine volle
  // script-src-CSP fehlt bewusst noch (die Inline-Boot-Scripts von Theme/Brand
  // bräuchten gepflegte Hashes) — Follow-up.
  async headers() {
    const security = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];
    if (isBeta) {
      security.push({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    }
    return [{ source: "/:path*", headers: security }];
  },
};

export default nextConfig;
