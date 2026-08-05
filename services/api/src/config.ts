// ============================================================================
// config.ts - central configuration.
//
// NOTE ON CONFIG SOURCES (user preference "Einstellungen immer ins Admin"):
// Environment variables are only the FALLBACK. Operational values (SMTP,
// provider keys, feature flags, ...) will later be loaded from an admin-UI
// backed settings table and merged over these env defaults. Keep every value
// behind this module so that swap stays a one-file change - never read
// process.env anywhere else.
// ============================================================================

// dev      = HS256 shared secret + /dev/login persona login (local harness).
// selfhosted = HS256 self-issued tokens (auth-login.ts), /dev/login DISABLED,
//              strong secrets enforced — kein GoTrue noetig (RSM v2 hostet Auth
//              selbst: API + Postgres, siehe routes/auth-login.ts).
// prod     = ES256 via GoTrue JWKS (falls doch ein GoTrue davorsteht).
export type AuthMode = 'dev' | 'selfhosted' | 'prod';

/**
 * Wie der Mailversand die Nachricht loswird.
 *   smtp     Echter Versand ueber nodemailer (lib/mailer.ts).
 *   dry-run  Die Mail wird VOLLSTAENDIG erzeugt (MIME, Umlaut-Kodierung, alles)
 *            und dann NICHT gesendet, sondern zurueckgegeben. Fuer Tests und
 *            zum Vorfuehren - siehe lib/mailer.ts, Abschnitt "Trockenlauf".
 */
export type MailTransport = 'smtp' | 'dry-run';

export interface ApiConfig {
  /** HTTP port. 3021 is the web portal - the API defaults to 3022. */
  port: number;
  /** Postgres connection string (see src/db.ts for the role model). */
  databaseUrl: string;
  db: {
    /**
     * Pool size for the WHOLE API. Capacity knob, NOT a security limit -
     * see the long note in db.ts: what protects the pool is bounded hold
     * time per request (0038), not a bigger number.
     */
    poolMax: number;
    /** Server-side ceiling: no single statement may pin a pooled connection. */
    statementTimeoutMs: number;
    /** Server-side ceiling: no idle transaction may pin a connection + its row locks. */
    idleInTransactionTimeoutMs: number;
    /** Bounded wait for a connection instead of an unbounded queue. */
    connectTimeoutSeconds: number;
  };
  rateLimit: {
    /**
     * HMAC pepper for throttle identifiers (IP, join code). Lives HERE and
     * never in the database: internal.auth_rate_limits then stores only
     * hmac(pepper, value), which a database dump alone cannot reverse - an
     * unpeppered hash of 2^32 IPv4 addresses is broken in seconds.
     * See lib/rate-limit.ts; AUTH_MODE=prod refuses to start without it.
     */
    ipPepper: string;
  };
  auth: {
    /** dev = HS256 shared secret; prod = ES256 via GoTrue JWKS. */
    mode: AuthMode;
    /** dev only - shared HS256 secret. */
    jwtSecret: string;
    /** prod only - JWKS URL of GoTrue. */
    jwksUrl: string;
    /** Optional issuer check (empty string = skip). */
    issuer: string;
    /** Optional audience check (empty string = skip). GoTrue default: "authenticated". */
    audience: string;
  };
  /**
   * BASIS-URL DER WEB-OBERFLAECHE — die Wurzel, an die der Server oeffentliche
   * Links baut (heute: der Annahme-Link einer Einladung, {base}/einladung/{token}).
   * Kein Personendatum, keine Geheimnisse: nur der oeffentliche Ursprung des
   * Portals. Dev-Vorgabe ist das lokale Portal (localhost:3021); in Produktion
   * setzt der Betreiber die echte Domain (APP_BASE_URL). Ohne abschliessenden
   * Schraegstrich — den setzt der Erzeuger des Pfads.
   */
  appBaseUrl: string;
  mail: {
    /**
     * smtp (Vorgabe) oder dry-run. AUTH_MODE=prod VERWEIGERT den Start mit
     * dry-run: eine Produktion, die Mails still in den Speicher schreibt statt
     * sie zu senden, ist genau der lautlose Ausfall, den lib/mailer.ts
     * verhindern soll. Lieber startet die API nicht.
     */
    transport: MailTransport;
    /**
     * FALLBACK, nicht die Quelle. Die MASSGEBLICHEN SMTP-Werte stehen in
     * internal.platform_settings.smtp und werden im Betreiber-Admin gepflegt
     * ("Einstellungen immer ins Admin", siehe Kopf dieser Datei). lib/mailer.ts
     * legt die Admin-Werte FELDWEISE ueber diese Vorgaben - was im Admin leer
     * bleibt, darf hier herkommen (z.B. ein Relay-Host aus dem Deployment).
     *
     * Das Kennwort steht bewusst AUCH hier: ein Betreiber, der lieber ein
     * Docker-Secret als ein Formularfeld benutzt, soll das koennen. Wer nichts
     * setzt, hat hier leere Zeichenketten und mailer.ts sagt sprechend, was fehlt.
     */
    smtp: {
      host: string;
      port: number;
      user: string;
      password: string;
      from: string;
      secure: boolean;
    };
  };
  billing: {
    /**
     * Stripe webhook signing secret (whsec_...). Placeholder in dev; in prod
     * mode the webhook endpoint answers 503 until a real value is configured
     * (later via admin UI settings - .env is only the fallback).
     */
    stripeWebhookSecret: string;
    /**
     * Stripe secret API key (sk_test.../sk_live...) for creating checkout
     * sessions. Empty = checkout disabled (501). Set via deploy/.env only.
     */
    stripeSecretKey: string;
    /** Base URL of the web app for Stripe success/cancel redirects. */
    webAppUrl: string;
    /**
     * Exact Authorization header value RevenueCat is configured to send
     * (RevenueCat dashboard -> webhook -> Authorization header).
     */
    revenuecatAuthToken: string;
    /** Max accepted age of a Stripe signature timestamp, in seconds. */
    stripeSignatureToleranceSeconds: number;
  };
}

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function loadConfig(): ApiConfig {
  const mode = env('AUTH_MODE', 'dev');
  if (mode !== 'dev' && mode !== 'selfhosted' && mode !== 'prod') {
    throw new Error(`AUTH_MODE must be 'dev', 'selfhosted' or 'prod', got '${mode}'`);
  }
  const mailTransport = env('MAIL_TRANSPORT', 'smtp');
  if (mailTransport !== 'smtp' && mailTransport !== 'dry-run') {
    throw new Error(`MAIL_TRANSPORT must be 'smtp' or 'dry-run', got '${mailTransport}'`);
  }
  const config: ApiConfig = {
    port: Number.parseInt(env('PORT', '3022'), 10),
    // Fallback = der lokale Dev-Stack (rsm2-pg-dev, scripts/dev-stack.sh).
    // War 55432 — auf Entwicklermaschinen die FREMDE rapportmanager-Postgres;
    // eine API ohne DATABASE_URL haette dorthin verbunden.
    databaseUrl: env('DATABASE_URL', 'postgres://postgres:rsm2-local-test@127.0.0.1:55433/rsm2'),
    // Ohne abschliessenden Schraegstrich normalisiert (der Pfad-Erzeuger setzt
    // ihn). Dev-Vorgabe: das lokale Web-Portal.
    appBaseUrl: env('APP_BASE_URL', 'http://localhost:3021').replace(/\/+$/, ''),
    db: {
      poolMax: Number.parseInt(env('DATABASE_POOL_MAX', '20'), 10),
      statementTimeoutMs: Number.parseInt(env('DATABASE_STATEMENT_TIMEOUT_MS', '30000'), 10),
      idleInTransactionTimeoutMs: Number.parseInt(
        env('DATABASE_IDLE_IN_TX_TIMEOUT_MS', '15000'),
        10,
      ),
      connectTimeoutSeconds: Number.parseInt(env('DATABASE_CONNECT_TIMEOUT_SECONDS', '10'), 10),
    },
    rateLimit: {
      ipPepper: env('RATE_LIMIT_PEPPER', 'dev-only-throttle-pepper-please-change'),
    },
    auth: {
      mode,
      jwtSecret: env('AUTH_JWT_SECRET', 'dev-only-placeholder-secret-please-change'),
      jwksUrl: env('AUTH_JWKS_URL'),
      issuer: env('AUTH_ISSUER'),
      audience: env('AUTH_AUDIENCE', 'authenticated'),
    },
    mail: {
      transport: mailTransport,
      smtp: {
        host: env('MAIL_SMTP_HOST'),
        port: Number.parseInt(env('MAIL_SMTP_PORT', '587'), 10),
        user: env('MAIL_SMTP_USER'),
        password: env('MAIL_SMTP_PASSWORD'),
        from: env('MAIL_SMTP_FROM'),
        // Strato & Co. sprechen implizites TLS auf 465; 587 ist STARTTLS
        // (secure=false + requireTLS, siehe mailer.ts). Die Vorgabe folgt dem
        // Port, damit ein Betreiber, der nur MAIL_SMTP_PORT=465 setzt, nicht
        // stillschweigend im Klartext landet.
        secure: env('MAIL_SMTP_SECURE', '') !== ''
          ? env('MAIL_SMTP_SECURE') === 'true'
          : Number.parseInt(env('MAIL_SMTP_PORT', '587'), 10) === 465,
      },
    },
    billing: {
      stripeWebhookSecret: env('STRIPE_WEBHOOK_SECRET', 'whsec-dev-placeholder'),
      // Stripe-Geheimschlüssel (sk_test.../sk_live...) — Pflicht, um Checkout-
      // Sessions zu erstellen. Leer = Checkout ist deaktiviert (402/501), Rest
      // der App läuft. Wird per deploy/.env gesetzt, NIE im Repo.
      stripeSecretKey: env('STRIPE_SECRET_KEY', ''),
      // Basis-URL der Web-App für Stripe-Redirects (success/cancel).
      webAppUrl: env('WEB_APP_URL', 'https://app.rollsportmanager.de'),
      revenuecatAuthToken: env('REVENUECAT_WEBHOOK_AUTH', 'rc-dev-placeholder-token'),
      stripeSignatureToleranceSeconds: Number.parseInt(
        env('STRIPE_SIGNATURE_TOLERANCE_SECONDS', '300'),
        10,
      ),
    },
  };
  // Beide gehaerteten Modi (prod, selfhosted) sind KEIN Dev — die Vorgabe-
  // Geheimnisse duerfen dort niemals durchrutschen.
  const hardened = config.auth.mode === 'prod' || config.auth.mode === 'selfhosted';

  if (config.auth.mode === 'prod' && config.auth.jwksUrl === '') {
    throw new Error('AUTH_MODE=prod requires AUTH_JWKS_URL');
  }
  // selfhosted stellt die Token SELBST aus (HS256) — der geteilte Schluessel IST
  // die ganze Sicherheit. Der oeffentliche Dev-Platzhalter waere ein
  // Universal-Login fuer jeden, der den Quelltext kennt.
  if (
    config.auth.mode === 'selfhosted' &&
    config.auth.jwtSecret === 'dev-only-placeholder-secret-please-change'
  ) {
    throw new Error(
      'AUTH_MODE=selfhosted requires a strong AUTH_JWT_SECRET (the dev placeholder is public)',
    );
  }
  // Ein Pfeffer, den jeder aus dem Quelltext lesen kann, ist kein Pfeffer: er
  // macht hmac(ip) wieder auf 2^32 Adressen durchprobierbar und die
  // Pseudonymisierung (Art. 32 Abs. 1 lit. a DSGVO) zur Behauptung. Lieber
  // startet die API nicht, als dass die Vorgabe still nach Produktion
  // durchrutscht - genau so ist der JWT-Demo-Schluessel dort gelandet.
  if (hardened && config.rateLimit.ipPepper === 'dev-only-throttle-pepper-please-change') {
    throw new Error(
      `AUTH_MODE=${config.auth.mode} requires RATE_LIMIT_PEPPER (the dev placeholder is public)`,
    );
  }
  // Dieselbe Begruendung wie beim Pfeffer, nur ist der Schaden hier leiser und
  // deshalb schlimmer: MAIL_TRANSPORT=dry-run in Produktion faehrt jede Mail
  // fehlerfrei in den Speicher. Verifikation, Einladung, Passwort-Reset melden
  // ERFOLG, es kommt nur nie etwas an - und niemand merkt es, weil nichts
  // scheitert. Ein Trockenlauf ist ein Werkzeug fuer Tests, kein Betriebsmodus.
  if (hardened && config.mail.transport === 'dry-run') {
    throw new Error(
      `AUTH_MODE=${config.auth.mode} refuses MAIL_TRANSPORT=dry-run: mail would be silently discarded`,
    );
  }
  return config;
}

/** Lazily created singleton so tests can set env vars before first use. */
let cached: ApiConfig | undefined;
export function getConfig(): ApiConfig {
  cached ??= loadConfig();
  return cached;
}
export function resetConfigForTests(): void {
  cached = undefined;
}
