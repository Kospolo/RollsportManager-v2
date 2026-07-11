import type { Metadata } from "next";
import { BankReconClient } from "./BankReconClient";

export const metadata: Metadata = { title: "Bankabgleich" };

/**
 * Bankabgleich /finanzen/bankabgleich (Seriositätszone) — Daten kommen
 * ausschließlich über die Facade (lib/data, mock|api). Die Interaktivität
 * (Zuordnen, Ignorieren, Erfassen, Import) lebt im Client. Sichtbarkeit nur
 * für can_manage_finance; die verbindliche Durchsetzung bleibt serverseitig (RLS).
 */
export default function BankabgleichPage() {
  return <BankReconClient />;
}
