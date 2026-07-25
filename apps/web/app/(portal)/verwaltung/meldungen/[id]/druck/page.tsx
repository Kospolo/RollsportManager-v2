import type { Metadata } from "next";
import { ReportPrint } from "./ReportPrint";

/**
 * Druckansicht /verwaltung/meldungen/[id]/druck — eine druckoptimierte Sicht
 * einer Chat-Meldung (Snapshot, Kontaktdaten, IP, Zeitpunkte). Der Nutzer macht
 * Cmd+P → als PDF speichern (kein Server-PDF-Renderer). Daten kommen über die
 * Facade; die Sichtbarkeit erzwingt serverseitig die RLS.
 */
type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Meldung drucken" };

export default async function ReportPrintPage({ params }: Props) {
  const { id } = await params;
  return <ReportPrint id={id} />;
}
