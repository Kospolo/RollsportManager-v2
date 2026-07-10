import type { Metadata } from "next";
import { InvoicesClient } from "./InvoicesClient";

export const metadata: Metadata = { title: "Rechnungen" };

/**
 * Rechnungen — Verwaltungssicht der Finanzen (Seriositätszone). Daten kommen
 * über die Facade (lib/data, mock|api); die Sichtbarkeit ist auf
 * can_manage_finance gegatet (verbindlich serverseitig via RLS). GoBD:
 * paid/cancelled terminal, Korrektur nur per Storno — kein Hard-Delete.
 */
export default function InvoicesPage() {
  return <InvoicesClient />;
}
