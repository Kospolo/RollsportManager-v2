import type { Metadata } from "next";
import { SepaClient } from "./SepaClient";

export const metadata: Metadata = { title: "SEPA-Mandate" };

/**
 * SEPA-Mandate /finanzen/sepa (Seriositätszone) — Daten kommen ausschließlich
 * über die Facade (lib/data, mock|api). Die Interaktivität (Mandat erfassen,
 * Widerrufen) lebt im Client. Sichtbarkeit nur für can_manage_finance; die
 * verbindliche Durchsetzung bleibt serverseitig (RLS). DATENSCHUTZ: nur
 * ibanLast4 + Mandatsreferenz — nie die vollständige IBAN.
 */
export default function SepaPage() {
  return <SepaClient />;
}
