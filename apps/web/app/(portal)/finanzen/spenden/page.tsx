import type { Metadata } from "next";
import { SpendenClient } from "./SpendenClient";

export const metadata: Metadata = { title: "Spenden" };

/**
 * Spenden & Zuwendungsbescheinigungen /finanzen/spenden (Seriositätszone) —
 * Daten kommen ausschließlich über die Facade (lib/data, mock|api). Erfassen,
 * Bescheinigung anzeigen/drucken und Ausstellen leben im Client. Sichtbarkeit
 * nur für can_manage_finance; die verbindliche Durchsetzung bleibt serverseitig
 * (RLS + API-DB-Check). GoBD: ausgestellte Bescheinigungen sind eingefroren.
 */
export default function SpendenPage() {
  return <SpendenClient />;
}
