import type { Metadata } from "next";
import { MeldungenClient } from "./MeldungenClient";

/**
 * /verwaltung/meldungen — gemeldete Chat-Verstösse (Meldesystem, Migration
 * 0082). Sichtbar nur für den Vereinsvorstand + den Betreiber; das erzwingt
 * serverseitig die RLS (GET /chat/reports), die UI gatet zur Anzeige.
 */
export const metadata: Metadata = { title: "Meldungen" };

export default function MeldungenPage() {
  return <MeldungenClient />;
}
