import * as mock from "@/lib/mock";
import type {
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
} from "@/lib/types";
import type { DataRepository } from "../types";
import { MOCK_SELF_PROFILE } from "./seed";

/**
 * Mock-Implementierung der Support-Tickets (Migration 0052).
 *
 * Eigener In-Memory-Store mit Session-Lebensdauer, wie bei den übrigen
 * Modul-Mocks: ein angelegtes Ticket und jede Antwort bleiben bis zum Reload
 * sichtbar. Der Mock BILDET DAS SERVERVERHALTEN NACH, wo es sichtbar wird:
 *   * die Eröffnungsnachricht ist Teil des Anlegens (wie routes/support.ts),
 *   * lastReplyAt/lastReplyBy pflegt der Store (im Server: der Trigger
 *     app.support_touch_ticket),
 *   * waitingOnClub + Vereinsantwort -> open (die eine Automatik aus 0052),
 *   * messageCount ist abgeleitet, nie gesetzt.
 *
 * WAS DER MOCK NICHT NACHBILDET — und auch nicht nachbilden soll: die
 * MANDANTENTRENNUNG und das Rollen-Gate. Beides ist serverseitig (RLS 0052 +
 * requireClubRoleDb), und der Mock kennt nur einen Verein und eine Persona.
 * Die Sichtbarkeit im UI entscheidet permissions().isClubAdmin — dieselbe
 * Rollenmenge, die der Server durchsetzt.
 *
 * HINWEIS ZUR DEMO-PERSONA: der Mock ist als Sandra Vogel (Trainerin)
 * angemeldet, und eine Trainerin darf laut 0052 KEINE Tickets sehen. Die
 * Support-Seite zeigt im Mock-Modus deshalb bewusst den Sperr-Zustand. Das ist
 * kein Fehler des Mocks, sondern genau das, was der Server einer Trainerin
 * antwortet (403). Zum Ausprobieren: api-Modus + Dev-Login als Vorstand.
 */

const clubId = mock.club.id;
const clubName = mock.club.name;

/** Vorstandspersonen des Demo-Vereins — nur sie machen Tickets auf. */
const juergen = mock.members.find((m) => m.role === "owner");
const thomas = mock.members.find((m) => m.role === "admin");

const nowIso = (): string => new Date().toISOString();
const isoMinus = (hours: number): string =>
  new Date(Date.now() - hours * 3600_000).toISOString();

interface MockTicket extends SupportTicket {
  messages: SupportMessage[];
}

let seq = 0;
const nextId = (prefix: string): string => `${prefix}-local-${++seq}`;

/**
 * Zwei Tickets als Ausgangslage: eines, das auf den Verein wartet (zeigt die
 * Automatik), und ein geschlossenes (zeigt den Endzustand).
 */
const ticketStore: MockTicket[] = [
  {
    id: "ticket-01",
    clubId,
    clubName,
    createdByMemberId: thomas?.id ?? "m-04",
    createdByName: thomas ? `${thomas.firstName} ${thomas.lastName}` : "Thomas Krüger",
    subject: "Beitragsrechnung wird doppelt erzeugt",
    status: "waiting_on_club",
    priority: "high",
    lastReplyAt: isoMinus(20),
    lastReplyBy: "platform",
    messageCount: 2,
    createdAt: isoMinus(52),
    updatedAt: isoMinus(20),
    messages: [
      {
        id: "msg-01",
        ticketId: "ticket-01",
        clubId,
        authorProfileId: "profile-thomas",
        authorName: thomas ? `${thomas.firstName} ${thomas.lastName}` : "Thomas Krüger",
        authorKind: "club",
        body: "Für zwei Mitglieder wurde die Januar-Rechnung doppelt erzeugt. Betrifft bisher nur Lastschrift-Zahler.",
        createdAt: isoMinus(52),
      },
      {
        id: "msg-02",
        ticketId: "ticket-01",
        clubId,
        authorProfileId: "profile-platform",
        authorKind: "platform",
        body: "Danke für die Meldung — wir haben den Lauf gefunden. Können Sie uns die beiden Rechnungsnummern nennen?",
        createdAt: isoMinus(20),
      },
    ],
  },
  {
    id: "ticket-02",
    clubId,
    clubName,
    createdByMemberId: juergen?.id ?? "m-02",
    createdByName: juergen ? `${juergen.firstName} ${juergen.lastName}` : "Jürgen Häberle",
    subject: "Vereinslogo lässt sich nicht hochladen",
    status: "closed",
    priority: "normal",
    lastReplyAt: isoMinus(96),
    lastReplyBy: "platform",
    messageCount: 2,
    closedAt: isoMinus(96),
    createdAt: isoMinus(140),
    updatedAt: isoMinus(96),
    messages: [
      {
        id: "msg-03",
        ticketId: "ticket-02",
        clubId,
        authorProfileId: "profile-juergen",
        authorName: juergen ? `${juergen.firstName} ${juergen.lastName}` : "Jürgen Häberle",
        authorKind: "club",
        body: "Beim Hochladen des Logos bricht der Upload bei 100 % ab.",
        createdAt: isoMinus(140),
      },
      {
        id: "msg-04",
        ticketId: "ticket-02",
        clubId,
        authorProfileId: "profile-platform",
        authorKind: "platform",
        body: "Die Datei war grösser als 5 MB. Wir haben das Limit angehoben — bitte noch einmal versuchen.",
        createdAt: isoMinus(96),
      },
    ],
  },
];

/**
 * Ohne den Verlauf — die Listen liefern nur die Kopfdaten (wie GET
 * /support/tickets, das ebenfalls keine messages mitschickt). Die Felder stehen
 * einzeln da, damit ein neues Feld an SupportTicket hier auffällt (der
 * Typecheck meldet es), statt still per Rest-Spread durchzurutschen.
 */
const head = (t: MockTicket): SupportTicket => ({
  id: t.id,
  clubId: t.clubId,
  clubName: t.clubName,
  createdByMemberId: t.createdByMemberId,
  createdByName: t.createdByName,
  subject: t.subject,
  status: t.status,
  priority: t.priority,
  lastReplyAt: t.lastReplyAt,
  lastReplyBy: t.lastReplyBy,
  messageCount: t.messages.length,
  closedAt: t.closedAt,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const detail = (t: MockTicket): SupportTicketDetail => ({
  ...head(t),
  messages: t.messages.map((m) => ({ ...m })),
});

const byLastActivity = (a: SupportTicket, b: SupportTicket): number =>
  (b.lastReplyAt ?? b.createdAt).localeCompare(a.lastReplyAt ?? a.createdAt);

const find = (ticketId: string): MockTicket => {
  const t = ticketStore.find((x) => x.id === ticketId);
  // Wie der Server: unsichtbar/unbekannt ist derselbe Fall (404).
  if (!t) throw new Error("Ticket not found");
  return t;
};

type SupportMethods = Pick<
  DataRepository,
  | "listSupportTickets"
  | "getSupportTicket"
  | "createSupportTicket"
  | "replySupportTicket"
  | "listAllSupportTickets"
  | "updateSupportTicket"
>;

export const moduleRepositorySupport: SupportMethods = {
  async listSupportTickets(): Promise<SupportTicket[]> {
    return ticketStore.map(head).sort(byLastActivity);
  },

  async getSupportTicket(ticketId): Promise<SupportTicketDetail> {
    return detail(find(ticketId));
  },

  async createSupportTicket(input): Promise<SupportTicketDetail> {
    const now = nowIso();
    const id = nextId("ticket");
    // Absender = die eingeloggte Person. Im Server löst das die API aus dem
    // Token auf; der Client nennt ihn NIE.
    const self = mock.members[0];
    const created: MockTicket = {
      id,
      clubId: input.clubId ?? clubId,
      clubName,
      createdByMemberId: self.id,
      createdByName: `${self.firstName} ${self.lastName}`,
      subject: input.subject,
      status: "open",
      priority: "normal",
      lastReplyAt: now,
      lastReplyBy: "club",
      messageCount: 1,
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: nextId("msg"),
          ticketId: id,
          clubId: input.clubId ?? clubId,
          authorProfileId: MOCK_SELF_PROFILE,
          authorName: `${self.firstName} ${self.lastName}`,
          authorKind: "club",
          body: input.body,
          createdAt: now,
        },
      ],
    };
    ticketStore.unshift(created);
    return detail(created);
  },

  async replySupportTicket(ticketId, input): Promise<SupportTicketDetail> {
    const ticket = find(ticketId);
    const now = nowIso();
    const self = mock.members[0];

    ticket.messages.push({
      id: nextId("msg"),
      ticketId,
      clubId: ticket.clubId,
      authorProfileId: MOCK_SELF_PROFILE,
      authorName: `${self.firstName} ${self.lastName}`,
      authorKind: "club",
      body: input.body,
      createdAt: now,
    });
    ticket.lastReplyAt = now;
    ticket.lastReplyBy = "club";
    ticket.updatedAt = now;
    // Die eine Automatik aus 0052: der Verein darf den Status nicht setzen,
    // also dreht seine Antwort "wartet auf Rückmeldung" zurück auf "offen".
    // Ein GESCHLOSSENES Ticket bleibt geschlossen.
    if (ticket.status === "waiting_on_club") ticket.status = "open";

    return detail(ticket);
  },

  async listAllSupportTickets(filterClubId): Promise<SupportTicket[]> {
    // Der Mock kennt genau einen Verein — mandantenübergreifend ist hier also
    // dieselbe Liste. Die echte Trennung sitzt in RLS (0052).
    return ticketStore
      .filter((t) => filterClubId === undefined || t.clubId === filterClubId)
      .map(head)
      .sort(byLastActivity);
  },

  async updateSupportTicket(ticketId, patch): Promise<SupportTicketDetail> {
    const ticket = find(ticketId);
    if (patch.status !== undefined) {
      ticket.status = patch.status;
      // closed_at folgt dem Status (im Server: app.support_sync_closed_at).
      ticket.closedAt = patch.status === "closed" ? nowIso() : undefined;
    }
    if (patch.priority !== undefined) ticket.priority = patch.priority;
    ticket.updatedAt = nowIso();
    return detail(ticket);
  },
};
