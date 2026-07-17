// ============================================================================
// mail-templates/join-request-notification.ts - Beitrittsantrag an den Vorstand.
//
// Geht an die Vorstands-/Verwaltungsadresse eines Vereins: "es liegt ein neuer
// Beitrittsantrag vor, bitte pruefen". (Optional - nur wenn der Verein
// Benachrichtigungen wuenscht; die Vorlage trifft diese Entscheidung nicht.)
//
// ⚠️ DER NAME DES ANTRAGSTELLERS GEHOERT NICHT IN DEN BETREFF. In diesem System
// sind SEHR VIELE KINDER; ein Betreff "Neuer Beitrittsantrag: Lena Mustermann"
// traegt den Namen eines Kindes durch jedes Zustellprotokoll und jede
// Sperrbildschirm-Vorschau (siehe types.ts). Der Betreff nennt nur den VEREIN
// (kein Personendatum), der Name steht im Text.
// ============================================================================

import { bilingual, oneLine, type RenderedMail } from './types.js';

export interface JoinRequestNotificationData {
  /** Vereinsname. Darf in den Betreff. */
  clubName: string;
  /**
   * Name des Antragstellers - NUR fuer den Text, NIE fuer den Betreff.
   * Haeufig ein Kind.
   */
  applicantName: string;
  /**
   * Link in die Verwaltung, wo der Antrag geprueft wird. Optional - ohne ihn
   * verweist der Text neutral auf die Mitgliederverwaltung.
   */
  reviewUrl?: string;
}

export function renderJoinRequestNotification(
  data: JoinRequestNotificationData,
): RenderedMail {
  const club = oneLine(data.clubName);
  const applicant = oneLine(data.applicantName);
  const url = data.reviewUrl ? oneLine(data.reviewUrl) : undefined;

  const de = {
    subject: `Neuer Beitrittsantrag fuer ${club}`,
    body: [
      'Hallo,',
      '',
      `fuer "${club}" liegt ein neuer Beitrittsantrag vor:`,
      '',
      `  ${applicant}`,
      '',
      url
        ? `Du kannst den Antrag hier pruefen:\n\n${url}`
        : 'Du kannst den Antrag in der Mitgliederverwaltung pruefen und',
      url ? undefined : 'annehmen oder ablehnen.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  };

  const en = {
    subject: `New membership request for ${club}`,
    body: [
      'Hello,',
      '',
      `there is a new membership request for "${club}":`,
      '',
      `  ${applicant}`,
      '',
      url
        ? `You can review the request here:\n\n${url}`
        : 'You can review the request in the member administration and',
      url ? undefined : 'accept or decline it.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  };

  return bilingual(de, en);
}
