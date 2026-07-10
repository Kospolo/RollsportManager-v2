import type { Metadata } from "next";
import { MembersAdminClient } from "./MembersAdminClient";

/**
 * Mitglieder-Verwaltung /verwaltung/mitglieder — Daten und Rechte kommen
 * ausschließlich über die Facade (lib/data); die Interaktivität lebt im
 * Client (MembersAdminClient). Der Schutz ist serverseitig (RLS + API-Check),
 * die Rollen-Sichtbarkeit hier nur Anzeige.
 */
export const metadata: Metadata = { title: "Mitglieder-Verwaltung" };

export default function MembersAdminPage() {
  return <MembersAdminClient />;
}
