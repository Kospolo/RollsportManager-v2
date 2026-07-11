import type { Metadata } from "next";
import { WartelistenClient } from "./WartelistenClient";

export const metadata: Metadata = { title: "Wartelisten" };

/**
 * Wartelisten-Screen des Portals — „Meine Einträge" (Selbst-Eintrag/-Austrag)
 * plus, für Trainer+, die Vereins-Warteschlange mit Status-Verwaltung. Daten
 * ausschließlich über die Daten-Facade lib/data (Mock oder api).
 */
export default function WartelistenPage() {
  return <WartelistenClient />;
}
