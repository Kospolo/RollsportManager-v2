// ============================================================================
// mail-templates/club-invitation.ts - Einladung in einen Verein.
//
// Geht an eine Adresse, zu der wir NICHTS wissen ausser der Adresse selbst -
// also beide Sprachen, kein locale-Raten (siehe types.ts).
//
// DER VEREINSNAME DARF IN DEN BETREFF (er ist kein personenbezogenes Datum),
// DER NAME DES EINLADENDEN NICHT (der steht im Text). bilingual() schickt den
// Betreff ohnehin durch oneLine(); den Vereinsnamen fuer den Text falten wir
// hier zusaetzlich, damit ein hineinkopiertes Steuerzeichen keine zweite Zeile
// vortaeuschen kann.
// ============================================================================

import { bilingual, oneLine, type RenderedMail } from './types.js';

export interface ClubInvitationData {
  /** Vereinsname. Darf in den Betreff. */
  clubName: string;
  /** Vollstaendige Annahme-URL inkl. Token (vom Aufrufer gebaut). */
  acceptUrl: string;
  /**
   * Name der Person, die einlaedt. Optional - fehlt er, wird der Satz neutral.
   * NIE im Betreff (Personendatum), nur im Text.
   */
  inviterName?: string;
}

export function renderClubInvitation(data: ClubInvitationData): RenderedMail {
  const club = oneLine(data.clubName);
  const url = oneLine(data.acceptUrl);
  const inviter = data.inviterName ? oneLine(data.inviterName) : undefined;

  const de = {
    subject: `Einladung zu ${club}`,
    body: [
      'Hallo,',
      '',
      inviter
        ? `${inviter} moechte dich zu "${club}" einladen.`
        : `du wurdest zu "${club}" eingeladen.`,
      '',
      'Ueber den folgenden Link kannst du die Einladung annehmen:',
      '',
      url,
      '',
      'Wenn du damit nichts anfangen kannst, ignoriere diese Nachricht',
      'einfach - es passiert dann nichts.',
    ].join('\n'),
  };

  const en = {
    subject: `Invitation to ${club}`,
    body: [
      'Hello,',
      '',
      inviter
        ? `${inviter} would like to invite you to "${club}".`
        : `you have been invited to "${club}".`,
      '',
      'You can accept the invitation using the following link:',
      '',
      url,
      '',
      'If this does not concern you, simply ignore this message -',
      'nothing will happen.',
    ].join('\n'),
  };

  return bilingual(de, en);
}
