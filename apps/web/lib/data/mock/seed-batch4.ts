import { club } from "@/lib/mock";
import type { ChatMessage, ChatReport, Checkin, RegionalEvent } from "@/lib/types";

/**
 * Start-Seed der Batch-4-Modul-Stores (Chat-Nachrichten, Check-ins,
 * überregionale Events) für den Mock-Modus. Echte Umlaute, DE-Inhalte,
 * plausible Mitglieder-/Team-IDs aus lib/mock. Aktuelle Person im Mock =
 * m-01 (Sandra Vogel, Coach, Teams t-02/t-03) — siehe mockRepository.getCurrentUser.
 */

const clubId = club.id;

/** ISO-Zeitstempel vor n Minuten. */
const minsAgo = (mins: number): string => new Date(Date.now() - mins * 60_000).toISOString();
/** ISO-Datum (YYYY-MM-DD) in n Tagen (negativ = Vergangenheit). */
const dateInDays = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export const chatMessageSeed: ChatMessage[] = [
  // Team-Kanal t-03 (Kürgruppe Leistung) — Sandra (m-01) ist Mitglied.
  {
    id: "msg-01",
    clubId,
    channelType: "team",
    teamId: "t-03",
    senderMemberId: "m-06",
    body: "Denkt am Samstag an die Kürmusik auf USB-Stick!",
    createdAt: minsAgo(240),
  },
  {
    id: "msg-02",
    clubId,
    channelType: "team",
    teamId: "t-03",
    senderMemberId: "m-01",
    body: "Erledigt – ich bringe außerdem die Ersatzrollen mit.",
    createdAt: minsAgo(180),
  },
  // Team-Kanal t-02 (Nachwuchs Pflicht) — Sandra ist Mitglied.
  {
    id: "msg-03",
    clubId,
    channelType: "team",
    teamId: "t-02",
    senderMemberId: "m-05",
    body: "Training am Dienstag fällt wegen Hallenbelegung leider aus.",
    createdAt: minsAgo(90),
  },
  // Direktnachricht m-01 ↔ m-06.
  {
    id: "msg-04",
    clubId,
    channelType: "direct",
    senderMemberId: "m-06",
    recipientMemberId: "m-01",
    body: "Hast du die Meldeliste schon fertig?",
    createdAt: minsAgo(60),
  },
  {
    id: "msg-05",
    clubId,
    channelType: "direct",
    senderMemberId: "m-01",
    recipientMemberId: "m-06",
    body: "Fast – ich schicke sie dir heute Abend.",
    createdAt: minsAgo(30),
  },
];

/**
 * Eine gemeldete Nachricht für den Mock-Modus (Meldesystem 0082). Reporter =
 * m-09 meldet msg-03 (von m-05) im Team-Kanal t-02. Der Snapshot ist bereits
 * aufgenommen — er zeigt, dass die Meldung lesbar bleibt, auch wenn die
 * Nachricht später gelöscht würde. Im Mock gibt es KEINE echte RLS; wer die
 * Meldungen-Seite sehen darf, gatet die UI (Vorstand/Betreiber).
 */
export const chatReportSeed: ChatReport[] = [
  {
    id: "report-01",
    clubId,
    messageId: "msg-03",
    reportedMemberId: "m-05",
    reporterMemberId: "m-09",
    reason: "Unangemessener Ton gegenüber den Kindern im Team-Kanal — bitte prüfen.",
    reporterIp: "192.168.1.44",
    snapshot: {
      capturedAt: minsAgo(80),
      channelType: "team",
      teamId: "t-02",
      message: {
        id: "msg-03",
        senderMemberId: "m-05",
        body: "Training am Dienstag fällt wegen Hallenbelegung leider aus.",
        createdAt: minsAgo(90),
      },
      context: [
        {
          id: "msg-03",
          senderMemberId: "m-05",
          body: "Training am Dienstag fällt wegen Hallenbelegung leider aus.",
          createdAt: minsAgo(90),
        },
      ],
    },
    status: "open",
    createdAt: minsAgo(80),
  },
];

export const checkinSeed: Checkin[] = [
  {
    id: "checkin-01",
    clubId,
    memberId: "m-09",
    eventId: undefined,
    method: "qr",
    checkedInAt: minsAgo(120),
    createdAt: minsAgo(120),
  },
  {
    id: "checkin-02",
    clubId,
    memberId: "m-12",
    eventId: undefined,
    method: "manual",
    checkedInAt: minsAgo(115),
    createdAt: minsAgo(115),
  },
  {
    id: "checkin-03",
    clubId,
    memberId: "m-01",
    eventId: undefined,
    method: "qr",
    checkedInAt: minsAgo(110),
    createdAt: minsAgo(110),
  },
];

export const regionalEventSeed: RegionalEvent[] = [
  {
    id: "regevt-01",
    clubId,
    title: "Süddeutsche Meisterschaft Rollkunstlauf",
    hostOrg: "Landesverband Baden-Württemberg",
    discipline: "Rollkunstlauf",
    location: "Stuttgart, Scharrena",
    startsOn: dateInDays(28),
    endsOn: dateInDays(29),
    registrationUrl: "https://example.org/anmeldung/sued-meisterschaft",
    description: "Meldeschluss zwei Wochen vorher über den Verein.",
    createdAt: minsAgo(4_000),
    updatedAt: minsAgo(1_500),
  },
  {
    id: "regevt-02",
    clubId,
    title: "Regionaler Kampfrichter-Lehrgang",
    hostOrg: "Bezirk Nord",
    discipline: undefined,
    location: "Heilbronn",
    startsOn: dateInDays(45),
    endsOn: undefined,
    registrationUrl: undefined,
    description: "Auffrischung für aktive und angehende Kampfrichter.",
    createdAt: minsAgo(2_000),
    updatedAt: minsAgo(2_000),
  },
];
