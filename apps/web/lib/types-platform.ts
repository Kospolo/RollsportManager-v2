import type { Id } from "./types";

/**
 * View-Typen der Betreiber-/Plattform-Konsole ((super)-Bereich): Lizenzen
 * (Entitlements), Zahlungen/Abos, Produkte (Preisliste), System-Info und die
 * Plattform-Einstellungen (SMTP, Rechtstexte, Content/SEO, Feature-Flags).
 *
 * Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-platform"` wieder unter "@/lib/types" verfügbar.
 * Wie überall im Portal: camelCase im Client, snake_case auf dem Draht (Mapper
 * in lib/data/api/mappers-platform.ts), Beträge in Cents (Integer).
 *
 * RECHTE STRIKT SERVERSEITIG: jeder /platform/*-Endpoint verlangt
 * is_platform_admin (Guard bzw. RLS). Der (super)-Client rendert/fetcht nur,
 * wenn der JWT diesen Claim trägt — das ist reine UX, der Server ist die
 * alleinige Autorität. Entitlement-Schreiben bleibt Plattform-/Service-only.
 */

/* ---------- Lizenzen (Entitlements) ---------- */

/** Produkt-/Lizenzstufe eines Vereins. */
export type PlatformTier = "basic" | "pro" | "premium";

/** Abo-/Lizenzstatus eines Vereins. */
export type PlatformEntitlementStatus = "trial" | "active" | "past_due" | "canceled";

/** Herkunft der Lizenz: Zahlungsanbieter oder manuell (Plattform-Admin). */
export type PlatformEntitlementSource = "stripe" | "revenuecat" | "manual";

/**
 * Eine Zeile der Lizenz-Übersicht (GET /platform/entitlements): pro Verein die
 * aggregierte Mitgliederzahl plus die aktuelle Lizenz (falls vorhanden). Ohne
 * Lizenz sind entitlement-bezogene Felder undefined.
 */
export interface PlatformEntitlement {
  clubId: Id;
  clubName: string;
  /** Kürzel des Vereins — undefined wenn nicht gesetzt. */
  shortName?: string;
  /** Aktuelle aktive Mitgliederzahl des Vereins. */
  memberCount: number;
  /** ID der Lizenz-Zeile — undefined wenn der Verein (noch) keine hat. */
  entitlementId?: Id;
  tier?: PlatformTier;
  status?: PlatformEntitlementStatus;
  source?: PlatformEntitlementSource;
  /** Anbieter-Referenz (Stripe-/RevenueCat-ID) — undefined bei manuell/ohne. */
  providerRef?: string;
  /** Gültig bis (ISO-Zeitstempel) — undefined = unbefristet/ohne. */
  validUntil?: string;
  /** Letzte Änderung der Lizenz (ISO) — undefined wenn keine Lizenz. */
  updatedAt?: string;
}

/* ---------- Zahlungen / Abos ---------- */

/** Ein Webhook-/Zahlungs-Ereignis (Stripe/RevenueCat) in der Betreiber-Sicht. */
export interface PlatformPayment {
  id: Id;
  /** Zahlungsanbieter (z. B. "stripe", "revenuecat"). */
  provider: string;
  /** Anbieter-seitige Event-ID (idempotent). */
  eventId: string;
  /** Event-Typ laut Anbieter — undefined wenn nicht übermittelt. */
  eventType?: string;
  /** Verarbeitungsstatus (received/processed/failed/skipped …). */
  status: string;
  /** Fehlermeldung bei fehlgeschlagener Verarbeitung — sonst undefined. */
  error?: string;
  /** Eingang beim Server (ISO). */
  receivedAt: string;
  /** Verarbeitet am (ISO) — undefined solange offen. */
  processedAt?: string;
}

/** Abo-Kennzahlen über alle Vereine (GET /platform/payments). */
export interface PlatformSubscriptionSummary {
  active: number;
  trial: number;
  pastDue: number;
  canceled: number;
  /** Anzahl Vereine mit gültiger Lizenz. */
  licensedClubs: number;
}

/** Seiten-Info der Zahlungsliste (server-getrieben). */
export interface PlatformPaymentsPage {
  total: number;
  limit: number;
  offset: number;
}

/** Antwort von GET /platform/payments: Events + Abo-Summary + Paging. */
export interface PlatformPaymentsResult {
  events: PlatformPayment[];
  subscriptionSummary: PlatformSubscriptionSummary;
  page: PlatformPaymentsPage;
}

/* ---------- Produkte (Preisliste) ---------- */

/** Produkt-Art: Vereinslizenz vs. persönliche PRO-Freischaltung. */
export type PlatformProductKind = "club_license" | "personal_pro";

/** Abrechnungsintervall eines Produkts. */
export type PlatformBillingInterval = "month" | "year";

/**
 * Ein Produkt der Preisliste (GET /platform/products) — INKLUSIVE inaktiver.
 * Preis in Cents (Integer), Betrag/Währung anbieterneutral gepflegt.
 */
export interface PlatformProduct {
  id: Id;
  /** Stabiler technischer Code (z. B. "club_pro_month"). */
  code: string;
  kind: PlatformProductKind;
  name: string;
  /** Beschreibung — undefined wenn nicht gepflegt. */
  description?: string;
  /** Preis in Cents (Integer) — undefined = kostenlos/ohne Preis. */
  priceCents?: number;
  /** Währungscode (z. B. "eur"). */
  currency: string;
  billingInterval: PlatformBillingInterval;
  /** Mitglieder-Obergrenze der Stufe — undefined = unbegrenzt. */
  maxMembers?: number;
  /** Aktiv/gelistet — inaktive werden trotzdem geliefert. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- System-Info ---------- */

/** Datenbank-Kennzahlen der System-Info. */
export interface PlatformSystemDb {
  clubs: number;
  users: number;
  members: number;
  activeEntitlements: number;
  webhookEvents: number;
  sizeBytes: number;
  /** Menschenlesbare Größe (z. B. "42 MB"). */
  sizePretty: string;
}

/** Migrations-Stand der System-Info. */
export interface PlatformSystemMigrations {
  count: number;
  /** Name der zuletzt angewandten Migration — undefined wenn keine. */
  latest?: string;
  list: string[];
}

/** Health-Check der System-Info. */
export interface PlatformSystemHealth {
  status: "ok";
  /** DB-Serverzeit (ISO). */
  dbTime: string;
}

/** Antwort von GET /platform/system (App-Version, Auth-Modus, DB, Migrationen). */
export interface PlatformSystemInfo {
  appVersion: string;
  authMode: "dev" | "prod";
  db: PlatformSystemDb;
  migrations: PlatformSystemMigrations;
  health: PlatformSystemHealth;
}

/* ---------- Plattform-Einstellungen ---------- */

/**
 * SMTP-Einstellungen — DATENSCHUTZ: das Passwort wird NIE im Klartext geliefert.
 * Nur passwordSet zeigt, ob eines hinterlegt ist.
 */
export interface PlatformSmtpSettings {
  host: string;
  /** Port — undefined wenn nicht gesetzt. */
  port?: number;
  user: string;
  from: string;
  secure: boolean;
  /** true, wenn ein Passwort hinterlegt ist (Wert bleibt serverseitig). */
  passwordSet: boolean;
}

/**
 * Rechtstexte-OVERRIDE des Betreibers (Impressum/Datenschutz/AGB), zweisprachig.
 * Leer bedeutet nicht „kein Text", sondern „zeig den eingebauten Standardtext"
 * (LegalPage DEFAULT_LEGAL). Deshalb je Dokument ein deutsches UND ein
 * englisches Feld — v2 ist durchgängig DE+EN.
 */
export interface PlatformLegalSettings {
  impressum: string;
  impressumEn: string;
  datenschutz: string;
  datenschutzEn: string;
  agb: string;
  agbEn: string;
}

/** Ein Rechtsdokument in beiden Sprachen (Ausgabe von GET /public/legal). */
export interface LegalDocText {
  de: string;
  en: string;
}

/**
 * Was die öffentlichen Seiten lesen (GET /public/legal) — NUR die Rechtstexte,
 * kein SMTP, keine Flags. Ein leerer Wert heißt: eingebauter Standard.
 */
export interface PublicLegal {
  impressum: LegalDocText;
  datenschutz: LegalDocText;
  agb: LegalDocText;
}

/** Website-Inhalte + SEO-Metadaten der Plattform. */
export interface PlatformContentSettings {
  websiteTitle: string;
  websiteSubtitle: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

/**
 * Antwort von GET /platform/settings. featureFlags ist eine flache Bool-Map.
 * Das SMTP-Passwort ist bewusst NICHT Teil des Modells (nur passwordSet).
 */
export interface PlatformSettings {
  smtp: PlatformSmtpSettings;
  legal: PlatformLegalSettings;
  content: PlatformContentSettings;
  featureFlags: Record<string, boolean>;
  updatedAt: string;
}

/* ---------- Küren-Moderation (Betreiber-Sicht über alle Vereine) ---------- */

/** Bearbeitungsstand einer Kür (app.routine_status). */
export type PlatformRoutineStatus = "draft" | "ready" | "competition" | "archived";

/**
 * Eine Kür in der Moderations-Sicht (GET /platform/routines) — vereins-
 * übergreifend, inklusive Vereinsname.
 *
 * ### Was hier bewusst FEHLT ###
 * Die Namen der Läufer:innen. Es sind fast immer Kinder, und für die
 * Moderationsfrage („ist Titel/Musik in Ordnung?") sind sie nicht nötig; nur
 * ihre ANZAHL steht drin. Wer die Menschen wirklich braucht, geht über den
 * Vereins-Umschalter in den Verein — und genau dieser Schritt steht dann als
 * eigene Zeile im Protokoll. Datensparsamkeit als Voreinstellung.
 */
export interface PlatformRoutineModeration {
  id: Id;
  clubId: Id;
  clubName: string;
  title: string;
  status: PlatformRoutineStatus;
  /** Kategorie, z. B. „Jugend Kür A" — undefined wenn nicht gepflegt. */
  category?: string;
  musicTitle?: string;
  musicArtist?: string;
  /** Dauer der Musik in Millisekunden — undefined wenn nicht gepflegt. */
  musicDurationMs?: number;
  /** Verknüpfte Audio-Datei — undefined, wenn keine hinterlegt ist. */
  audioAssetId?: Id;
  /** MIME-Typ der Audio-Datei (z. B. "audio/mpeg") — undefined ohne Datei. */
  audioMimeType?: string;
  /** Größe der Audio-Datei in Bytes — undefined ohne Datei. */
  audioSizeBytes?: number;
  /** Anzahl der Läufer:innen (die Zahl, nicht die Menschen — s. o.). */
  skaterCount: number;
  createdAt: string;
  updatedAt: string;
}
