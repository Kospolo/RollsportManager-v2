// ============================================================================
// mail-templates/verify-email.ts - E-Mail-Verifikation.
//
// Geht an jemanden, der gerade eine Adresse angegeben hat und BESTAETIGEN soll,
// dass sie ihm gehoert. Zu diesem Zeitpunkt gibt es noch kein Konto und keine
// gespeicherte Sprache (siehe types.ts) - deshalb beide Sprachen in EINER Mail.
//
// Der Bestaetigungslink ist das EINZIGE Versprechen dieser Mail. Keine weiteren
// Zusagen ("Konto aktiviert", "Daten uebernommen"), die anderswo eingeloest
// werden muessten - was hier steht, muss der Klick auch wirklich tun.
// ============================================================================

import { bilingual, oneLine, type RenderedMail } from './types.js';

export interface VerifyEmailData {
  /**
   * Die vollstaendige Bestaetigungs-URL inkl. Token. Vom Aufrufer gebaut - die
   * Vorlage stellt sie nur dar und prueft sie nicht. oneLine() entfernt
   * versehentliche Steuerzeichen, mehr nicht.
   */
  verifyUrl: string;
  /**
   * Gueltigkeitsdauer des Links in Klartext, z.B. "24 Stunden". Ohne Angabe
   * bleibt der Satz zur Gueltigkeit weg (keine Zusage, die nicht stimmt).
   */
  validityDe?: string;
  validityEn?: string;
}

export function renderVerifyEmail(data: VerifyEmailData): RenderedMail {
  const url = oneLine(data.verifyUrl);
  const validDe = data.validityDe ? oneLine(data.validityDe) : undefined;
  const validEn = data.validityEn ? oneLine(data.validityEn) : undefined;

  const de = {
    subject: 'Bitte bestaetige deine E-Mail-Adresse',
    body: [
      'Hallo,',
      '',
      'bitte bestaetige deine E-Mail-Adresse, indem du den folgenden Link',
      'oeffnest:',
      '',
      url,
      '',
      validDe ? `Der Link ist ${validDe} gueltig.` : undefined,
      'Wenn du diese Adresse nicht angegeben hast, kannst du diese Nachricht',
      'ignorieren - es passiert dann nichts.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  };

  const en = {
    subject: 'Please confirm your email address',
    body: [
      'Hello,',
      '',
      'please confirm your email address by opening the following link:',
      '',
      url,
      '',
      validEn ? `The link is valid for ${validEn}.` : undefined,
      'If you did not enter this address, you can ignore this message -',
      'nothing will happen.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  };

  return bilingual(de, en);
}
