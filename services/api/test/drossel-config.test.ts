// ============================================================================
// drossel-config.test.ts - die Vorbedingungen der Drossel (0038).
//
// WARUM DAS EINEN TEST WERT IST:
// Der Pfeffer ist die GANZE Pseudonymisierung. internal.auth_rate_limits
// speichert auf der ip- und der code-Achse nur noch hmac(pfeffer, wert)
// (Art. 32 Abs. 1 lit. a DSGVO) - aber ein Pfeffer, den jeder im Quelltext
// nachlesen kann, macht die 2^32 IPv4-Adressen wieder in Sekunden
// durchprobierbar. Mit Vorgabe-Pfeffer waere der Schutz eine Behauptung.
//
// Genau so ist der JWT-Demo-Schluessel in diesem Projekt schon einmal auf
// Produktion gelandet. Deshalb: die API startet in prod lieber gar nicht.
// ============================================================================

import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, resetConfigForTests } from '../src/config.js';

const PLACEHOLDER = 'dev-only-throttle-pepper-please-change';

afterEach(() => {
  process.env['AUTH_MODE'] = 'dev';
  delete process.env['AUTH_JWKS_URL'];
  delete process.env['RATE_LIMIT_PEPPER'];
  delete process.env['DATABASE_POOL_MAX'];
  resetConfigForTests();
});

function prodEnv(): void {
  process.env['AUTH_MODE'] = 'prod';
  process.env['AUTH_JWKS_URL'] = 'https://auth.invalid/jwks';
  resetConfigForTests();
}

describe('Drossel-Pfeffer (F4)', () => {
  it('verweigert den Start in prod, wenn der Vorgabe-Pfeffer stehen blieb', () => {
    prodEnv();
    delete process.env['RATE_LIMIT_PEPPER'];
    expect(() => loadConfig()).toThrow(/RATE_LIMIT_PEPPER/);
  });

  it('verweigert den Start in prod auch, wenn jemand die Vorgabe ausdruecklich setzt', () => {
    prodEnv();
    process.env['RATE_LIMIT_PEPPER'] = PLACEHOLDER;
    expect(() => loadConfig()).toThrow(/RATE_LIMIT_PEPPER/);
  });

  it('startet in prod mit einem echten Pfeffer', () => {
    prodEnv();
    process.env['RATE_LIMIT_PEPPER'] = 'ein-echter-pfeffer-aus-der-umgebung';
    expect(loadConfig().rateLimit.ipPepper).toBe('ein-echter-pfeffer-aus-der-umgebung');
  });

  it('laesst dev mit der Vorgabe laufen - der Harness soll ohne Geheimnisse booten', () => {
    process.env['AUTH_MODE'] = 'dev';
    resetConfigForTests();
    expect(loadConfig().rateLimit.ipPepper).toBe(PLACEHOLDER);
  });
});

describe('Pool-Grenzen (F1)', () => {
  // Die Zahl ist ein Kapazitaets-Regler, kein Sicherheitsgrenzwert (siehe die
  // lange Begruendung in db.ts). Sie gehoert deshalb in die Konfiguration -
  // hart verdrahtete 10 waren der Grund, warum eine Flut auf dem Beitritts-Pfad
  // JEDE andere Route mit ausgehungert hat.
  it('nimmt die Pool-Groesse aus der Umgebung', () => {
    process.env['DATABASE_POOL_MAX'] = '42';
    resetConfigForTests();
    expect(loadConfig().db.poolMax).toBe(42);
  });

  it('hat Vorgaben, die eine Verbindung nicht endlos halten lassen', () => {
    resetConfigForTests();
    const { db } = loadConfig();
    expect(db.poolMax).toBe(20);
    // Beide Schranken wirken serverseitig und damit auch dann, wenn im
    // Node-Prozess etwas haengt oder ein Fehlerpfad das Commit vergisst.
    expect(db.statementTimeoutMs).toBeGreaterThan(0);
    expect(db.idleInTransactionTimeoutMs).toBeGreaterThan(0);
    expect(db.connectTimeoutSeconds).toBeGreaterThan(0);
  });
});
