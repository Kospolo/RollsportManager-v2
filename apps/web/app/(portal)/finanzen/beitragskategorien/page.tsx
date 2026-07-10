import type { Metadata } from "next";
import { BeitragskategorienClient } from "./BeitragskategorienClient";

export const metadata: Metadata = { title: "Beitragskategorien" };

/**
 * Beitragskategorien /finanzen/beitragskategorien (Seriositätszone) — Beitrags-
 * stammdaten, Familienrabatte und die erwarteten Jahreseinnahmen. Daten kommen
 * ausschließlich über die Facade (lib/data, mock|api). Sichtbarkeit nur für
 * can_manage_finance; die verbindliche Durchsetzung bleibt serverseitig (RLS).
 */
export default function BeitragskategorienPage() {
  return <BeitragskategorienClient />;
}
