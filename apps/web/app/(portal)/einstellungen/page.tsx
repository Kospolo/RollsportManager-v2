import type { Metadata } from "next";
import { EinstellungenClient } from "./EinstellungenClient";

export const metadata: Metadata = { title: "Einstellungen" };

/**
 * Persönliche Einstellungen — verlinkt aus dem Benutzermenü der Topbar.
 * Daten ausschließlich über die Facade lib/data (getMyPreferences /
 * updateMyPreferences, getCurrentUser); user_preferences sind strikt privat.
 */
export default function EinstellungenPage() {
  return <EinstellungenClient />;
}
