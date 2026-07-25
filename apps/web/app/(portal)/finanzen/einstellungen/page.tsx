import type { Metadata } from "next";
import { InvoiceSettingsClient } from "./InvoiceSettingsClient";

/**
 * Rechnungs-Einstellungen /finanzen/einstellungen — Briefkopf, Fußzeile und
 * Bankverbindung je Verein. Nur die Vereinsverwaltung (is_club_admin) darf
 * schreiben; die Durchsetzung ist serverseitig (RLS + API-Guard). Daten kommen
 * ausschließlich über die Facade (lib/data).
 */

export const metadata: Metadata = { title: "Rechnungs-Einstellungen" };

export default function InvoiceSettingsPage() {
  return <InvoiceSettingsClient />;
}
