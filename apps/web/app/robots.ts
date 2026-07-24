import type { MetadataRoute } from "next";

/**
 * robots.txt — wird von Next aus dieser Datei erzeugt (Datei-Konvention
 * `app/robots.ts`, siehe node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/01-metadata/robots.md).
 *
 * RSM_BETA=1 setzt das Dockerfile der Beta-Umgebung. Für
 * beta.rollsportmanager.de gilt dann eine Vollsperre: Die Beta zeigt dieselben
 * Marketing-Texte wie die Produktivseite rollsportmanager.de. Ohne Sperre wäre
 * das doppelter Inhalt — Google sucht sich dann selbst aus, welche der beiden
 * Seiten es anzeigt, und das kann die falsche sein.
 *
 * Die zweite, stärkere Sperre steht in next.config.ts (X-Robots-Tag). Beide
 * werden gebraucht: robots.txt hält Crawler fern, aber holt nichts aus dem
 * Index zurück, was schon drin ist. Das kann nur der Header.
 *
 * Ohne RSM_BETA (Produktivseite) ist alles frei — hier gehört später die
 * Sitemap hin, sobald es eine gibt.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.RSM_BETA === "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return { rules: { userAgent: "*", allow: "/" } };
}
