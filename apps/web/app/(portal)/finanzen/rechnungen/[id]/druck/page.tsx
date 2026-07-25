import type { Metadata } from "next";
import { InvoicePrint } from "./InvoicePrint";

/**
 * Druckansicht /finanzen/rechnungen/[id]/druck — eine druckoptimierte Sicht
 * der Rechnung mit Briefkopf und Fusszeile aus den Rechnungs-Einstellungen.
 * Der Nutzer macht Cmd+P → als PDF speichern (kein Server-PDF-Renderer). Daten
 * kommen ausschließlich über die Facade (lib/data); die Interaktivität
 * (window.print) lebt im Client.
 */

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Rechnung drucken" };

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  return <InvoicePrint id={id} />;
}
