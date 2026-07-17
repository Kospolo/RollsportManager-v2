// ============================================================================
// mail-templates/password-reset.ts - Passwort zuruecksetzen.
//
// Diese Mail ist ein bevorzugtes Ziel fuer Missbrauch: ein Angreifer tippt die
// Adresse des OPFERS ein, das Opfer bekommt die Mail. Deshalb haengt der
// Versand an der 'recipient'-Achse der Drossel (rate-limit.ts) - die Vorlage
// selbst bleibt eine reine Funktion und weiss davon nichts.
//
// Der Text macht KEINE Aussage darueber, ob zu dieser Adresse ein Konto
// existiert (das waere eine Konto-Enumeration). Er sagt neutral: WENN du das
// warst, hier ist der Link; wenn nicht, ignoriere es.
// ============================================================================

import { bilingual, oneLine, type RenderedMail } from './types.js';

export interface PasswordResetData {
  /** Vollstaendige Reset-URL inkl. Token (vom Aufrufer gebaut). */
  resetUrl: string;
  /** Gueltigkeitsdauer in Klartext, z.B. "1 Stunde" / "1 hour". Optional. */
  validityDe?: string;
  validityEn?: string;
}

export function renderPasswordReset(data: PasswordResetData): RenderedMail {
  const url = oneLine(data.resetUrl);
  const validDe = data.validityDe ? oneLine(data.validityDe) : undefined;
  const validEn = data.validityEn ? oneLine(data.validityEn) : undefined;

  const de = {
    subject: 'Passwort zuruecksetzen',
    body: [
      'Hallo,',
      '',
      'zu deinem Konto wurde ein neues Passwort angefordert. Ueber den',
      'folgenden Link kannst du es setzen:',
      '',
      url,
      '',
      validDe ? `Der Link ist ${validDe} gueltig.` : undefined,
      'Wenn du das nicht warst, ignoriere diese Nachricht - dein Passwort',
      'bleibt dann unveraendert.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  };

  const en = {
    subject: 'Reset your password',
    body: [
      'Hello,',
      '',
      'a new password was requested for your account. You can set it using',
      'the following link:',
      '',
      url,
      '',
      validEn ? `The link is valid for ${validEn}.` : undefined,
      'If this was not you, ignore this message - your password will remain',
      'unchanged.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  };

  return bilingual(de, en);
}
