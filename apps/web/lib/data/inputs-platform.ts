import type {
  Id,
  PlatformEntitlement,
  PlatformEntitlementStatus,
  PlatformPaymentsResult,
  PlatformProduct,
  PlatformRoutineModeration,
  PlatformRoutineStatus,
  PlatformSettings,
  PlatformSystemInfo,
  PlatformTier,
  PublicLegal,
} from "@/lib/types";

/**
 * Eingabe-Typen + Facade-Segment der Betreiber-/Plattform-Konsole
 * ((super)-Bereich): Lizenzen, Zahlungen/Abos, Produkte, System-Info und
 * Plattform-Einstellungen. Ausgelagert aus lib/data/types.ts (< 400 Zeilen);
 * die DataRepository erbt PlatformConsoleRepository (wie OrgRepository etc.).
 *
 * RECHTE STRIKT SERVERSEITIG: jeder /platform/*-Endpoint prüft is_platform_admin
 * (Guard bzw. RLS auf internal.platform_settings). Die Facade reicht nur durch —
 * der (super)-Client rendert/fetcht diese Methoden ausschließlich, wenn der JWT
 * den Claim trägt (reine UX). Entitlement-Schreiben bleibt Plattform-/Service-
 * only (applyEntitlementChange, source='manual', actor='platform:<sub>').
 */

/* ---------- Lizenzen (Entitlements) ---------- */

/**
 * Lizenz eines Vereins setzen/ändern (PATCH /platform/entitlements/{clubId}).
 * Server verweigert illegale State-Übergänge (409) bzw. unbekannte Produkte
 * (422). validUntil null = unbefristet. trialDays optional beim Start einer
 * Testphase; reason wird ins Audit geschrieben.
 */
export interface SetEntitlementInput {
  tier: PlatformTier;
  status: PlatformEntitlementStatus;
  /** Gültig bis (ISO); null = unbefristet; weglassen = unverändert. */
  validUntil?: string | null;
  /** Länge der Testphase in Tagen (nur relevant für status="trial"). */
  trialDays?: number;
  /** Begründung fürs Audit-Log. */
  reason?: string;
}

/* ---------- Zahlungen / Abos ---------- */

/** Filter/Paging für GET /platform/payments. */
export interface PlatformPaymentsQuery {
  provider?: "stripe" | "revenuecat";
  status?: "received" | "processed" | "failed" | "skipped";
  /** Default 50, Maximum 200 (serverseitig gekappt). */
  limit?: number;
  /** Offset für Paging, Default 0. */
  offset?: number;
}

/* ---------- Produkte (Preisliste) ---------- */

/**
 * Produkt der Preisliste ändern (PATCH /platform/products/{id}). Preis in Cents
 * (Integer). null leert die Beschreibung; weggelassene Felder bleiben.
 */
export interface UpdateProductInput {
  priceCents?: number;
  active?: boolean;
  name?: string;
  description?: string | null;
}

/* ---------- Küren-Moderation ---------- */

/**
 * Filter der Küren-Moderation (GET /platform/routines). Ohne clubId geht die
 * Sicht über ALLE Vereine — das ist der Punkt der Moderation.
 */
export interface PlatformRoutinesQuery {
  /** Auf einen Verein einschränken; weglassen = alle. */
  clubId?: Id;
  status?: PlatformRoutineStatus;
  /** Freitext über Titel / Musiktitel / Interpret. */
  q?: string;
  /** Default 100, Maximum 200 (serverseitig gekappt). */
  limit?: number;
  /** Offset für Paging, Default 0. */
  offset?: number;
}

/* ---------- Plattform-Einstellungen ---------- */

/**
 * SMTP-Patch. DATENSCHUTZ: password ist WRITE-ONLY — weglassen behält das
 * gespeicherte Passwort, senden ersetzt es. Es wird nie zurückgegeben.
 */
export interface UpdatePlatformSmtpInput {
  host?: string;
  port?: number;
  user?: string;
  from?: string;
  secure?: boolean;
  /** WRITE-ONLY: setzen ersetzt, weglassen behält das gespeicherte Passwort. */
  password?: string;
}

/** Rechtstexte-Patch (Impressum/Datenschutz/AGB). */
export interface UpdatePlatformLegalInput {
  impressum?: string;
  impressumEn?: string;
  datenschutz?: string;
  datenschutzEn?: string;
  agb?: string;
  agbEn?: string;
}

/** Content-/SEO-Patch. */
export interface UpdatePlatformContentInput {
  websiteTitle?: string;
  websiteSubtitle?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

/**
 * Patch der Plattform-Einstellungen (PATCH /platform/settings). Alle Abschnitte
 * optional, deep-merge serverseitig; featureFlags wird flach überschrieben.
 */
export interface UpdatePlatformSettingsInput {
  smtp?: UpdatePlatformSmtpInput;
  legal?: UpdatePlatformLegalInput;
  content?: UpdatePlatformContentInput;
  featureFlags?: Record<string, boolean>;
}

/**
 * Facade-Segment der Betreiber-/Plattform-Konsole. DataRepository erbt es
 * (analog OrgRepository). Alle Methoden sind is_platform_admin-only —
 * durchgesetzt vom Server (Guard/RLS), nicht von der Facade.
 */
export interface PlatformConsoleRepository {
  /* ---------- Einstellungen (RLS-gated auf internal.platform_settings) ---------- */
  /** Plattform-Einstellungen lesen — SMTP-Passwort NUR als passwordSet:boolean. */
  platformGetSettings(): Promise<PlatformSettings>;
  /** Plattform-Einstellungen ändern (deep-merge); smtp.password ist WRITE-ONLY. */
  platformUpdateSettings(patch: UpdatePlatformSettingsInput): Promise<PlatformSettings>;
  /**
   * ÖFFENTLICHE Rechtstexte (GET /public/legal) — OHNE Auth, für die Seiten
   * /impressum, /datenschutz, /agb. Liefert NUR die Override-Texte; ein leerer
   * Wert heißt „eingebauter Standard". Bewusst getrennt von
   * platformGetSettings: die ist Betreiber-only und enthält Geheimnisse.
   */
  getPublicLegal(): Promise<PublicLegal>;

  /* ---------- Lizenzen (Lesen im Service-Mode hinter Guard, Schreiben Service-only) ---------- */
  /** Alle Vereine mit Mitgliederzahl + aktueller Lizenz. */
  platformListEntitlements(): Promise<PlatformEntitlement[]>;
  /** Lizenz eines Vereins setzen — 409 bei illegalem Übergang, 422 bei unbekanntem Produkt. */
  platformSetEntitlement(clubId: Id, input: SetEntitlementInput): Promise<PlatformEntitlement>;

  /* ---------- Zahlungen / Abos (reine Lesesicht) ---------- */
  /** Zahlungs-/Webhook-Events + Abo-Summary + Paging. */
  platformListPayments(query?: PlatformPaymentsQuery): Promise<PlatformPaymentsResult>;

  /* ---------- Produkte (Preisliste) ---------- */
  /** Preisliste inkl. inaktiver Produkte. */
  platformListProducts(): Promise<PlatformProduct[]>;
  /** Produkt ändern (Preis in Cents, aktiv/Name/Beschreibung). */
  platformUpdateProduct(id: Id, patch: UpdateProductInput): Promise<PlatformProduct>;

  /* ---------- Küren-Moderation (reine Lesesicht über alle Vereine) ---------- */
  /**
   * Küren ALLER Vereine für die Moderation (Titel/Musik sichten). Ohne Filter
   * vereinsübergreifend. Läufer:innen-Namen liefert der Server bewusst nicht —
   * nur ihre Anzahl (siehe PlatformRoutineModeration).
   */
  platformListRoutines(query?: PlatformRoutinesQuery): Promise<PlatformRoutineModeration[]>;

  /* ---------- System-Info (reine Lesesicht) ---------- */
  /** App-Version, Auth-Modus, DB-Kennzahlen, Migrationsstand, Health. */
  platformSystemInfo(): Promise<PlatformSystemInfo>;
}
