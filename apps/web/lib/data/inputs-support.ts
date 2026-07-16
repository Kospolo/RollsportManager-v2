import type {
  Id,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";

/**
 * Eingabe-Typen für Support-Tickets (Migration 0052). Ausgelagert wie die
 * inputs-batch*-Dateien, re-exportiert über lib/data/index.ts.
 */

/**
 * Ticket aufmachen (Vereinsvorstand). Die Eröffnungsnachricht ist PFLICHT —
 * ein Ticket ohne Text ist für den Betreiber wertlos.
 *
 * createdByMemberId fehlt hier bewusst: die API löst die eigene Mitgliedszeile
 * aus dem Token auf (routes/support.ts), damit niemand ein Ticket im Namen
 * einer Kollegin anlegt.
 */
export interface CreateSupportTicketInput {
  /** Weglassen = der aktive Verein der Session. */
  clubId?: Id;
  subject: string;
  body: string;
}

/** Auf ein Ticket antworten. Die Seite (club/platform) folgt aus dem Token. */
export interface CreateSupportMessageInput {
  body: string;
}

/**
 * Status/Priorität setzen — BETREIBER-VORBEHALT (0052: support_tickets_update
 * = app.is_platform_admin()). Steht in der Facade, weil der Betreiber-Trupp
 * seine Oberfläche dagegen baut; die Vereins-Seite ruft es NICHT auf.
 */
export interface UpdateSupportTicketInput {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
}

/**
 * Facade-Ausschnitt für Support-Tickets. DataRepository erbt davon — wie bei
 * den Batch*-Repositories.
 *
 * Rechte SERVERSEITIG (RLS 0052 + Guards in routes/support.ts): Vorstand des
 * eigenen Vereins bzw. Betreiber. Die UI gatet nur zur ANZEIGE.
 */
export interface SupportRepository {
  /** Tickets des aktiven Vereins, letzte Regung zuerst. Vorstand: 403 für alle anderen. */
  listSupportTickets(): Promise<SupportTicket[]>;
  /** Ein Ticket samt Verlauf. Unsichtbar = 404 (nicht 403 — sonst wäre die Existenz abfragbar). */
  getSupportTicket(ticketId: Id): Promise<SupportTicketDetail>;
  /** Ticket aufmachen (inkl. Eröffnungsnachricht). */
  createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicketDetail>;
  /** Antworten. Die Seite (club/platform) leitet der Server aus dem Token ab. */
  replySupportTicket(ticketId: Id, input: CreateSupportMessageInput): Promise<SupportTicketDetail>;
  /**
   * ALLE Tickets, mandantenübergreifend — NUR Betreiber (GET
   * /platform/support/tickets). Für die Betreiber-Oberfläche, die ein anderer
   * Trupp baut.
   */
  listAllSupportTickets(clubId?: Id): Promise<SupportTicket[]>;
  /** Status/Priorität setzen — NUR Betreiber (PATCH /support/tickets/{id}). */
  updateSupportTicket(ticketId: Id, patch: UpdateSupportTicketInput): Promise<SupportTicketDetail>;
}
