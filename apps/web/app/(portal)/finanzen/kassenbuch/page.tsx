import type { Metadata } from "next";
import { KassenbuchClient } from "./KassenbuchClient";

export const metadata: Metadata = { title: "Kassenbuch" };

/**
 * Kassenbuch /finanzen/kassenbuch (Seriositätszone) — Daten kommen
 * ausschließlich über die Facade (lib/data, mock|api). Die Interaktivität
 * (Buchen, Stornieren, Kategorien) lebt im Client. Sichtbarkeit nur für
 * can_manage_finance; die verbindliche Durchsetzung bleibt serverseitig (RLS).
 */
export default function KassenbuchPage() {
  return <KassenbuchClient />;
}
