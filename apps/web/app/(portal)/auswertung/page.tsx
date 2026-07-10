import type { Metadata } from "next";
import { AuswertungScreen } from "./_components/AuswertungScreen";

export const metadata: Metadata = { title: "Auswertung" };

/**
 * Auswertung (Statistiken & Berichte) — reine Lesesicht auf die
 * Vereins-Kennzahlen über data.getReportsSummary(). Nur für den Trainerstab
 * und die Vereinsleitung sichtbar; die Durchsetzung bleibt serverseitig
 * (requireClubRole + service-mode-Scoping), ein 403 wird sauber abgefangen.
 */
export default function AuswertungPage() {
  return <AuswertungScreen />;
}
