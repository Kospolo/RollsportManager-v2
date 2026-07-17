// ============================================================================
// lib/mailer.ts - der einzige Ort, der eine RenderedMail wirklich verschickt.
//
// ZWEI DINGE MACHT DIESE DATEI, UND NUR DIESE ZWEI:
//   1. Sie holt die MASSGEBLICHEN SMTP-Werte aus internal.platform_settings
//      (Betreiber-Admin, Migration 0019) und legt sie FELDWEISE ueber die
//      .env-Vorgaben aus config.ts. Marcels Regel: "alles im Admin, kein .env" -
//      .env ist nur der Rueckfall fuer das, was im Admin leer bleibt.
//   2. Sie sendet - oder, im Trockenlauf, erzeugt die vollstaendige Mail (MIME,
//      Umlaut-Kodierung, Kopfzeilen) und gibt sie ZURUECK statt zu senden.
//
// ----------------------------------------------------------------------------
// WARUM EIN FEHLENDES SMTP LAUT SCHEITERN MUSS
// ----------------------------------------------------------------------------
// Der schlimmste Ausgang eines Mailversands ist nicht "Fehler", sondern
// "Erfolg gemeldet, nichts gesendet". Genau das ist in diesem Umfeld schon
// passiert (das lautlos ausgefallene KetoTracker-Backup). Verifikation,
// Einladung und Passwort-Reset melden dann Erfolg, es kommt nur nie etwas an -
// und niemand merkt es. Deshalb: fehlt die Konfiguration, wirft diese Datei
// einen SPRECHENDEN Fehler (MailConfigError). Sie schluckt nichts.
//
// ----------------------------------------------------------------------------
// WARUM DIE SMTP-WERTE NIE AN DEN CLIENT GEHEN
// ----------------------------------------------------------------------------
// Das SMTP-Kennwort steht in internal.platform_settings.smtp write-only
// (routes/platform-settings.ts maskiert es zu password_set). Diese Datei liest
// es SERVERSEITIG ueber withServiceRole und gibt es nirgends zurueck - weder im
// Sende-Ergebnis noch im Trockenlauf-MIME (nodemailer schreibt das Kennwort
// nicht in die Nachricht).
// ============================================================================

import { createTransport, type Transporter } from 'nodemailer';
import { getConfig, type MailTransport } from '../config.js';
import { withServiceRole } from '../db.js';
import type { RenderedMail } from './mail-templates/types.js';

/** Die fertig aufgeloesten SMTP-Werte (Admin ueber .env-Vorgabe gelegt). */
export interface ResolvedSmtp {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

/**
 * Konfigurationsfehler - im Gegensatz zu einem SMTP-/Netzfehler liegt hier
 * NICHTS am Server der Gegenseite, sondern an fehlenden Einstellungen. Die
 * Route kann das unterscheiden (422 "bitte im Admin nachtragen" statt 502).
 */
export class MailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailConfigError';
  }
}

/** Ergebnis eines echten Versands bzw. eines Trockenlaufs. */
export type MailDeliveryResult =
  | {
      mode: 'sent';
      messageId: string;
      /** Vom SMTP-Server angenommene Empfaenger. */
      accepted: string[];
      /** Abgelehnte Empfaenger (leer = alle angenommen). */
      rejected: string[];
    }
  | {
      mode: 'dry-run';
      messageId: string;
      /** Absender/Empfaenger, wie sie in den Briefumschlag gegangen waeren. */
      envelope: { from: string; to: string[] };
      /** Die vollstaendige erzeugte Nachricht (MIME) als Text. */
      mime: string;
      /** Betreff und Text separat - fuer die Anzeige im Admin praktisch. */
      subject: string;
      text: string;
    };

/** Liest einen String-Wert aus dem smtp-jsonb; leer/kein String -> undefined. */
function str(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Holt die SMTP-Werte aus dem Admin (internal.platform_settings) und legt sie
 * FELDWEISE ueber die .env-Vorgaben. Ein im Admin leer gelassenes Feld faellt
 * auf config.mail.smtp zurueck - so kann ein Betreiber z.B. nur den Host per
 * Deployment setzen und den Rest im Formular pflegen (oder umgekehrt).
 *
 * SERVICE-MODE, weil internal.platform_settings sonst nur der Plattform-Admin
 * via RLS sieht; der Mailversand laeuft aber ohne angemeldeten Betreiber (z.B.
 * beim Passwort-Reset). Reason wird protokolliert (db.ts verlangt ihn).
 */
export async function resolveSmtp(): Promise<ResolvedSmtp> {
  const fallback = getConfig().mail.smtp;

  const admin = await withServiceRole(
    'read SMTP settings for outgoing mail (internal.platform_settings, write-only)',
    async (tx) => {
      const rows = await tx<{ smtp: Record<string, unknown> | null }[]>`
        select smtp from internal.platform_settings where id = 1`;
      return (rows[0]?.smtp ?? {}) as Record<string, unknown>;
    },
  );

  const adminPort = admin['port'];
  const adminSecure = admin['secure'];

  return {
    host: str(admin, 'host') ?? fallback.host,
    port: typeof adminPort === 'number' ? adminPort : fallback.port,
    user: str(admin, 'user') ?? fallback.user,
    password: str(admin, 'password') ?? fallback.password,
    from: str(admin, 'from') ?? fallback.from,
    secure: typeof adminSecure === 'boolean' ? adminSecure : fallback.secure,
  };
}

/**
 * Prueft die aufgeloeste Konfiguration und wirft SPRECHEND, was fehlt.
 * dry-run braucht nur den Absender (fuer den Umschlag); smtp braucht zusaetzlich
 * den Host und - falls ein Benutzer gesetzt ist - auch ein Kennwort.
 */
function assertUsable(smtp: ResolvedSmtp, transport: MailTransport): void {
  if (smtp.from === '') {
    throw new MailConfigError(
      'SMTP-Absender fehlt: bitte in den Plattform-Einstellungen (Admin) unter SMTP ' +
        'die Absenderadresse (from) hinterlegen. / SMTP sender address (from) is not configured.',
    );
  }
  if (transport === 'dry-run') return;

  if (smtp.host === '') {
    throw new MailConfigError(
      'SMTP-Host fehlt: bitte in den Plattform-Einstellungen (Admin) den SMTP-Server ' +
        'hinterlegen. / SMTP host is not configured.',
    );
  }
  if (smtp.user !== '' && smtp.password === '') {
    throw new MailConfigError(
      'SMTP-Benutzer ist gesetzt, aber kein Kennwort: bitte im Admin das SMTP-Kennwort ' +
        'nachtragen (es wird write-only gespeichert). / SMTP user is set but the password is missing.',
    );
  }
}

/** Baut den nodemailer-Transport passend zum Modus. */
function buildTransporter(smtp: ResolvedSmtp, transport: MailTransport): Transporter {
  if (transport === 'dry-run') {
    // Erzeugt die vollstaendige Nachricht als Puffer, OHNE Netz. newline:'unix'
    // haelt die Ausgabe stabil (Tests vergleichen Text).
    return createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  }
  return createTransport({
    host: smtp.host,
    port: smtp.port,
    // secure=true -> implizites TLS (465). secure=false -> STARTTLS; requireTLS
    // erzwingt das Upgrade, damit ein 587-Betreiber NICHT still im Klartext
    // landet (siehe config.ts). Vorgabe von secure folgt dem Port (0019/config).
    secure: smtp.secure,
    requireTLS: !smtp.secure,
    auth: smtp.user !== '' ? { user: smtp.user, pass: smtp.password } : undefined,
  });
}

/** Zusaetzliche Steuerung fuer Tests und den Testversand. */
export interface SendOptions {
  /**
   * Vorab aufgeloeste SMTP-Werte. Ist das gesetzt, wird die Datenbank NICHT
   * gelesen - so laufen Unit-Tests und der Fake-SMTP-Test ohne Postgres.
   */
  smtp?: ResolvedSmtp;
  /**
   * Modus erzwingen. Ohne Angabe gilt config.mail.transport. Der Testversand
   * setzt hier 'dry-run', wenn der Admin nur die erzeugte Mail sehen will,
   * ohne wirklich zu senden.
   */
  transport?: MailTransport;
  /**
   * Fertiger nodemailer-Transport. Ist er gesetzt, wird buildTransporter NICHT
   * benutzt - der Weg, auf dem der Fake-SMTP-Test einen echten SMTP-Dialog gegen
   * einen lokalen Sink fuehrt, ohne die production requireTLS-Regel zu umgehen.
   * Im Normalbetrieb bleibt das leer.
   */
  transporter?: Transporter;
}

/**
 * Verschickt EINE gerenderte Mail an EINE Adresse - oder gibt sie im
 * Trockenlauf zurueck. Wirft MailConfigError bei fehlender Konfiguration und
 * den originalen Fehler bei einem SMTP-/Netzproblem (nie stillschweigend
 * "Erfolg").
 *
 * DIE DROSSEL SITZT NICHT HIER. Wer wie oft an WELCHE Adresse senden darf, ist
 * eine Frage des Aufrufers (Route) und haengt an der 'recipient'-Achse in
 * rate-limit.ts. Diese Funktion sendet, was man ihr gibt - die Politik liegt
 * eine Ebene hoeher, wo Kontext (IP, Konto, Anlass) bekannt ist.
 */
export async function sendMail(
  to: string,
  mail: RenderedMail,
  opts: SendOptions = {},
): Promise<MailDeliveryResult> {
  // Die Empfaengeradresse wird NICHT gefaltet, sondern STRIKT geprueft: ein
  // Steuerzeichen (CR/LF) darin ist ein Einschleus-Versuch in den Umschlag, kein
  // Tippfehler, den man glaetten sollte. Eine gefaltete Adresse "a@b Bcc: x@y"
  // haette immer noch ein '@' und rutschte durch - deshalb hier abweisen statt
  // oneLine() wie beim Betreff.
  const recipient = to.trim();
  // eslint-disable-next-line no-control-regex
  const hasControl = /[\u0000-\u001f\u007f-\u009f]/.test(to);
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  if (hasControl || !looksLikeEmail) {
    throw new MailConfigError('Ungueltige Empfaengeradresse. / Invalid recipient address.');
  }

  const transport = opts.transport ?? getConfig().mail.transport;
  const smtp = opts.smtp ?? (await resolveSmtp());
  assertUsable(smtp, transport);

  const transporter = opts.transporter ?? buildTransporter(smtp, transport);
  const info = await transporter.sendMail({
    from: smtp.from,
    to: recipient,
    subject: mail.subject,
    text: mail.text,
  });

  if (transport === 'dry-run') {
    // streamTransport+buffer -> info.message ist ein Buffer mit der ganzen MIME.
    const message = info.message as unknown as Buffer;
    return {
      mode: 'dry-run',
      messageId: info.messageId,
      envelope: {
        from: (info.envelope.from as string | false) || smtp.from,
        to: (info.envelope.to as string[] | undefined) ?? [recipient],
      },
      mime: message.toString('utf8'),
      subject: mail.subject,
      text: mail.text,
    };
  }

  return {
    mode: 'sent',
    messageId: info.messageId,
    accepted: (info.accepted ?? []).map(String),
    rejected: (info.rejected ?? []).map(String),
  };
}
