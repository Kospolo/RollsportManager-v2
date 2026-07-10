/**
 * Anzeige-Beispieldaten für den Styleguide (Abnahmeseite der
 * Komponentenbibliothek) — bewusst STATISCH und unabhängig von der
 * Daten-Facade (lib/data): der Styleguide zeigt Komponenten mit stabilen
 * Demo-Props, egal welche Datenquelle (mock|api) das Portal gerade nutzt.
 *
 * Die Screens unter app/(portal)/ importieren NIEMALS aus lib/mock —
 * dieses Modul ist (wie lib/data/mock) Teil der erlaubten lib-Schicht
 * und der EINZIGE Weg, auf dem Demo-Daten in den Styleguide gelangen.
 */

export {
  dunningPipeline,
  fullName,
  ledgerBalanceCents,
  memberById,
  members,
  openInvoices,
  routines,
  sumOpenCents,
  sumPaidCents,
} from "@/lib/mock";
