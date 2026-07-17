// ============================================================================
// mailer.test.ts - lib/mailer.ts ohne echten Mailserver und ohne Postgres.
//
// Drei Zusagen werden hier bewiesen:
//   1. TROCKENLAUF erzeugt die vollstaendige Mail (MIME, Umlaut-Kodierung) und
//      SENDET NICHT.
//   2. FEHLENDE KONFIGURATION scheitert LAUT (MailConfigError) - nie still.
//   3. POSITIVKONTROLLE: gegen einen lokalen Fake-SMTP-Sink (127.0.0.1, freier
//      Port) geht die Mail wirklich raus und kommt als MIME dort an.
// ============================================================================

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import net from 'node:net';
import { createTransport } from 'nodemailer';
import { resetConfigForTests } from '../src/config.js';
import { sendMail, MailConfigError, type ResolvedSmtp } from '../src/lib/mailer.js';
import { bilingual } from '../src/lib/mail-templates/types.js';

const OK_SMTP: ResolvedSmtp = {
  host: '127.0.0.1',
  port: 25,
  user: '',
  password: '',
  from: 'noreply@rsm2.test',
  secure: false,
};

const MAIL = bilingual(
  { subject: 'Betreff mit Umlaut ä', body: 'Hallo Welt mit ü und ß.' },
  { subject: 'Subject', body: 'Hello world.' },
);

beforeAll(() => {
  process.env['AUTH_MODE'] = 'dev';
  delete process.env['MAIL_TRANSPORT'];
  resetConfigForTests();
});

afterEach(() => {
  delete process.env['MAIL_TRANSPORT'];
  resetConfigForTests();
});

describe('Trockenlauf (dry-run)', () => {
  it('erzeugt die vollstaendige Mail und sendet NICHT', async () => {
    const r = await sendMail('empfaenger@example.org', MAIL, {
      transport: 'dry-run',
      smtp: OK_SMTP,
    });
    expect(r.mode).toBe('dry-run');
    if (r.mode !== 'dry-run') throw new Error('unreachable');
    // Die MIME traegt Betreff und Text (Umlaute sind kodiert, nicht 1:1
    // suchbar - deshalb pruefen wir die separat mitgelieferten Felder).
    expect(r.subject).toContain('Betreff mit Umlaut ä');
    expect(r.text).toContain('Hallo Welt mit ü und ß.');
    expect(r.mime).toMatch(/^MIME-Version:/m);
    expect(r.mime).toMatch(/Subject:/);
    expect(r.envelope.to).toEqual(['empfaenger@example.org']);
    expect(r.envelope.from).toBe('noreply@rsm2.test');
    // Das SMTP-Kennwort taucht in der Nachricht NICHT auf.
    expect(r.mime).not.toContain('password');
  });

  it('faengt CR/LF in der Empfaengeradresse ab', async () => {
    await expect(
      sendMail('a@b.z\r\nBcc: opfer@x.z', MAIL, { transport: 'dry-run', smtp: OK_SMTP }),
    ).rejects.toBeInstanceOf(MailConfigError);
  });

  it('lehnt eine Adresse ohne @ ab', async () => {
    await expect(
      sendMail('keine-adresse', MAIL, { transport: 'dry-run', smtp: OK_SMTP }),
    ).rejects.toBeInstanceOf(MailConfigError);
  });
});

describe('Fehlende Konfiguration scheitert LAUT', () => {
  it('wirft MailConfigError, wenn der Absender fehlt (auch im Trockenlauf)', async () => {
    const noFrom = { ...OK_SMTP, from: '' };
    await expect(
      sendMail('x@y.z', MAIL, { transport: 'dry-run', smtp: noFrom }),
    ).rejects.toThrow(/Absender|sender/);
  });

  it('wirft MailConfigError, wenn im smtp-Modus der Host fehlt', async () => {
    const noHost = { ...OK_SMTP, host: '' };
    await expect(
      sendMail('x@y.z', MAIL, { transport: 'smtp', smtp: noHost }),
    ).rejects.toThrow(/Host|host/);
  });

  it('wirft MailConfigError bei halber Anmeldung (Benutzer ohne Kennwort)', async () => {
    const halfAuth = { ...OK_SMTP, user: 'u', password: '' };
    await expect(
      sendMail('x@y.z', MAIL, { transport: 'smtp', smtp: halfAuth }),
    ).rejects.toThrow(/Kennwort|password/);
  });
});

// ----------------------------------------------------------------------------
// Ein minimaler SMTP-Sink (nur node:net, kein TLS): nimmt alles an und legt die
// empfangene DATA-Nutzlast in `messages`. Genau das, was MailHog/smtp-sink tut -
// nur ohne Container und ohne Platte anzufassen.
// ----------------------------------------------------------------------------
interface Sink {
  port: number;
  messages: string[];
  close: () => Promise<void>;
}

function startSink(): Promise<Sink> {
  const messages: string[] = [];
  const server = net.createServer((socket) => {
    let buf = '';
    let inData = false;
    socket.setEncoding('utf8');
    socket.write('220 sink ready\r\n');
    socket.on('data', (chunk: string) => {
      buf += chunk;
      for (;;) {
        if (inData) {
          const term = buf.indexOf('\r\n.\r\n');
          if (term < 0) break;
          messages.push(buf.slice(0, term));
          buf = buf.slice(term + 5);
          inData = false;
          socket.write('250 2.0.0 queued\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl < 0) break;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'DATA') {
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          inData = true;
        } else if (cmd === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else {
          // EHLO/HELO/MAIL/RCPT/RSET/... - alles anstandslos ok.
          socket.write('250 2.0.0 ok\r\n');
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        messages,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

describe('Positivkontrolle: echter SMTP-Dialog gegen lokalen Fake-Sink', () => {
  let sink: Sink;

  beforeAll(async () => {
    sink = await startSink();
  });
  afterEach(async () => {
    // sink bleibt fuer alle Tests; erst am Ende schliessen.
  });

  it('sendet die Mail wirklich raus und der Sink empfaengt die MIME', async () => {
    const transporter = createTransport({
      host: '127.0.0.1',
      port: sink.port,
      secure: false,
      ignoreTLS: true, // kein STARTTLS gegen den Klartext-Sink
    });

    const r = await sendMail('ziel@example.org', MAIL, {
      smtp: { ...OK_SMTP, port: sink.port },
      transporter,
    });

    expect(r.mode).toBe('sent');
    if (r.mode !== 'sent') throw new Error('unreachable');
    expect(r.accepted).toContain('ziel@example.org');
    expect(r.rejected).toEqual([]);

    // Beim Sink ist genau eine Nachricht angekommen und sie traegt unseren Betreff.
    expect(sink.messages.length).toBe(1);
    const received = sink.messages[0] ?? '';
    expect(received).toMatch(/^To: ziel@example.org/m);
    expect(received).toMatch(/^From: noreply@rsm2.test/m);
    expect(received).toMatch(/Subject:/m);

    transporter.close();
    await sink.close();
  });
});
