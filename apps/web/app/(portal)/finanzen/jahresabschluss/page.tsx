import type { Metadata } from "next";
import { JahresabschlussClient } from "./JahresabschlussClient";

export const metadata: Metadata = { title: "Jahresabschluss" };

/**
 * Jahresabschluss /finanzen/jahresabschluss (Seriositätszone) — Daten kommen
 * ausschließlich über die Facade (lib/data, mock|api). Die Interaktivität
 * (Jahr-Auswahl, CSV-/DATEV-Export) lebt im Client. Sichtbarkeit nur für
 * can_manage_finance; die verbindliche Durchsetzung bleibt serverseitig (RLS).
 */
export default function JahresabschlussPage() {
  return <JahresabschlussClient />;
}
