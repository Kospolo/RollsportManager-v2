import type { Metadata } from "next";
import { MahnungenClient } from "./MahnungenClient";

export const metadata: Metadata = { title: "Mahnungen" };

/**
 * Mahnwesen (Seriositätszone) — offene überfällige Posten nach Mahnstufe,
 * Mahnlauf (Vorschau → Anwenden) und unveränderliches Mahnprotokoll. Daten
 * kommen über die Facade (lib/data, mock|api via NEXT_PUBLIC_DATA_SOURCE);
 * Rechte werden serverseitig durchgesetzt (can_manage_finance).
 */
export default function MahnungenPage() {
  return <MahnungenClient />;
}
