import { club, members, routines } from "@/lib/mock";
import type {
  PlatformEntitlement,
  PlatformPayment,
  PlatformProduct,
  PlatformRoutineModeration,
  PlatformSettings,
} from "@/lib/types";
import type { PlatformConsoleRepository } from "../inputs-platform";

/**
 * Mock-Implementierung der Betreiber-/Plattform-Konsole (Lizenzen, Zahlungen,
 * Produkte, System-Info, Einstellungen). Eigene In-Memory-Stores mit Session-
 * Lebensdauer, KEIN echter Rechtecheck — im api-Modus ist der Server (Guard +
 * RLS) die Wahrheit. Die Daten sind plausibel gehalten, damit der (super)-
 * Bereich auch ohne Dev-Stack erfahrbar ist.
 *
 * DATENSCHUTZ: der SMTP-Passwort-Klartext verlässt NIE den Store — nach außen
 * nur passwordSet:boolean, exakt wie der Server es maskiert.
 */

const nowIso = (): string => new Date().toISOString();
const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

/* ---------- Küren-Moderation ---------- */

/**
 * Küren über alle drei Demo-Vereine. Die des eigenen Vereins stammen aus dem
 * echten Mock-Seed (lib/mock/routines.ts), die der beiden anderen sind hier
 * ergänzt — sonst zeigte eine „Sicht über ALLE Vereine" genau einen Verein und
 * bewiese nichts.
 *
 * KEINE Läufer:innen-Namen, nur ihre Anzahl — der Mock spiegelt damit exakt,
 * was der Server liefert (platformRoutineRowSchema). Ein Mock, der mehr zeigt
 * als die echte Antwort, erzieht zu einer Oberfläche, die es nicht gibt.
 */
const routineStore: PlatformRoutineModeration[] = [
  ...routines.map((r) => ({
    id: r.id,
    clubId: club.id,
    clubName: club.name,
    title: r.title,
    status: r.status,
    ...(r.category !== undefined ? { category: r.category } : {}),
    ...(r.music?.title !== undefined ? { musicTitle: r.music.title } : {}),
    ...(r.music?.artist !== undefined ? { musicArtist: r.music.artist } : {}),
    ...(r.music?.durationMs !== undefined ? { musicDurationMs: r.music.durationMs } : {}),
    skaterCount: r.memberIds.length,
    createdAt: daysFromNow(-200),
    updatedAt: daysFromNow(-14),
  })),
  {
    id: "r-esc-01",
    clubId: "club-esc-heilbronn",
    clubName: "ESC Heilbronn",
    title: "Bohemian Rhapsody",
    status: "ready",
    category: "Jugend Kür B",
    musicTitle: "Bohemian Rhapsody",
    musicArtist: "Queen",
    musicDurationMs: 174_000,
    audioAssetId: "ma-esc-01",
    audioMimeType: "audio/mpeg",
    audioSizeBytes: 4_180_000,
    skaterCount: 1,
    createdAt: daysFromNow(-64),
    updatedAt: daysFromNow(-3),
  },
  {
    id: "r-esc-02",
    clubId: "club-esc-heilbronn",
    clubName: "ESC Heilbronn",
    title: "Winterreise",
    status: "draft",
    musicTitle: "Der Lindenbaum",
    musicArtist: "Franz Schubert",
    musicDurationMs: 141_000,
    skaterCount: 2,
    createdAt: daysFromNow(-11),
    updatedAt: daysFromNow(-11),
  },
  {
    id: "r-rrc-01",
    clubId: "club-rrc-stuttgart",
    clubName: "RRC Stuttgart",
    title: "Tanz der Ritter",
    status: "competition",
    category: "Junioren Kür",
    musicTitle: "Romeo und Julia — Tanz der Ritter",
    musicArtist: "Sergei Prokofjew",
    musicDurationMs: 188_000,
    audioAssetId: "ma-rrc-01",
    audioMimeType: "audio/mpeg",
    audioSizeBytes: 5_020_000,
    skaterCount: 4,
    createdAt: daysFromNow(-120),
    updatedAt: daysFromNow(-30),
  },
  {
    id: "r-rrc-02",
    clubId: "club-rrc-stuttgart",
    clubName: "RRC Stuttgart",
    title: "Archiv 2023 — Nordlicht",
    status: "archived",
    musicTitle: "Aurora",
    musicArtist: "Ludovico Einaudi",
    musicDurationMs: 156_000,
    skaterCount: 1,
    createdAt: daysFromNow(-420),
    updatedAt: daysFromNow(-380),
  },
];

/* ---------- Lizenzen ---------- */

const activeMemberCount = members.filter((m) => m.status === "active").length;

const entitlementStore: PlatformEntitlement[] = [
  {
    clubId: club.id,
    clubName: club.name,
    shortName: club.shortName,
    memberCount: activeMemberCount,
    entitlementId: "ent-rsv-mannheim",
    tier: "pro",
    status: "active",
    source: "stripe",
    providerRef: "sub_1PmockRSVMannheim",
    validUntil: daysFromNow(320),
    updatedAt: daysFromNow(-12),
  },
  {
    clubId: "club-esc-heilbronn",
    clubName: "ESC Heilbronn",
    shortName: "ESC",
    memberCount: 41,
    entitlementId: "ent-esc-heilbronn",
    tier: "basic",
    status: "trial",
    source: "manual",
    validUntil: daysFromNow(9),
    updatedAt: daysFromNow(-5),
  },
  {
    clubId: "club-rrc-stuttgart",
    clubName: "RRC Stuttgart",
    shortName: "RRC",
    memberCount: 68,
    entitlementId: "ent-rrc-stuttgart",
    tier: "premium",
    status: "past_due",
    source: "revenuecat",
    providerRef: "rc_9zMockStuttgart",
    validUntil: daysFromNow(-3),
    updatedAt: daysFromNow(-30),
  },
];

/* ---------- Zahlungen / Abos ---------- */

const paymentStore: PlatformPayment[] = [
  {
    id: "evt-001",
    provider: "stripe",
    eventId: "evt_1PmockInvoicePaid",
    eventType: "invoice.paid",
    status: "processed",
    receivedAt: daysFromNow(-1),
    processedAt: daysFromNow(-1),
  },
  {
    id: "evt-002",
    provider: "stripe",
    eventId: "evt_1PmockSubUpdated",
    eventType: "customer.subscription.updated",
    status: "processed",
    receivedAt: daysFromNow(-4),
    processedAt: daysFromNow(-4),
  },
  {
    id: "evt-003",
    provider: "revenuecat",
    eventId: "rc_evt_renewalFailed",
    eventType: "BILLING_ISSUE",
    status: "failed",
    error: "card_declined",
    receivedAt: daysFromNow(-3),
  },
  {
    id: "evt-004",
    provider: "revenuecat",
    eventId: "rc_evt_initialPurchase",
    eventType: "INITIAL_PURCHASE",
    status: "processed",
    receivedAt: daysFromNow(-6),
    processedAt: daysFromNow(-6),
  },
];

/* ---------- Produkte (Preisliste) ---------- */

const productStore: PlatformProduct[] = [
  {
    id: "prod-club-basic-month",
    code: "club_basic_month",
    kind: "club_license",
    name: "Verein Basic (monatlich)",
    description: "Grundfunktionen für kleine Vereine",
    priceCents: 1900,
    currency: "eur",
    billingInterval: "month",
    maxMembers: 50,
    active: true,
    createdAt: daysFromNow(-400),
    updatedAt: daysFromNow(-40),
  },
  {
    id: "prod-club-pro-month",
    code: "club_pro_month",
    kind: "club_license",
    name: "Verein Pro (monatlich)",
    description: "Voller Funktionsumfang inkl. Finanzen und Wettkampf",
    priceCents: 4900,
    currency: "eur",
    billingInterval: "month",
    maxMembers: 250,
    active: true,
    createdAt: daysFromNow(-400),
    updatedAt: daysFromNow(-20),
  },
  {
    id: "prod-club-premium-year",
    code: "club_premium_year",
    kind: "club_license",
    name: "Verein Premium (jährlich)",
    description: "Unbegrenzte Mitglieder, Priorisierter Support",
    priceCents: 99900,
    currency: "eur",
    billingInterval: "year",
    active: true,
    createdAt: daysFromNow(-400),
    updatedAt: daysFromNow(-60),
  },
  {
    id: "prod-personal-pro-month",
    code: "personal_pro_month",
    kind: "personal_pro",
    name: "Persönlich PRO (monatlich)",
    description: "Alte Preisstufe — nicht mehr buchbar",
    priceCents: 499,
    currency: "eur",
    billingInterval: "month",
    active: false,
    createdAt: daysFromNow(-500),
    updatedAt: daysFromNow(-120),
  },
];

/* ---------- Plattform-Einstellungen ---------- */

/** Interner Store MIT Passwort — nach außen wird nur passwordSet gespiegelt. */
interface SettingsStore {
  smtp: {
    host: string;
    port?: number;
    user: string;
    from: string;
    secure: boolean;
    /** Klartext bleibt im Store, verlässt ihn NIE (nur passwordSet nach außen). */
    password: string;
  };
  legal: {
    impressum: string;
    impressumEn: string;
    datenschutz: string;
    datenschutzEn: string;
    agb: string;
    agbEn: string;
  };
  content: {
    websiteTitle: string;
    websiteSubtitle: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
  };
  featureFlags: Record<string, boolean>;
  updatedAt: string;
}

const settingsStore: SettingsStore = {
  smtp: {
    host: "smtp.strato.de",
    port: 465,
    user: "noreply@rollsportmanager.de",
    from: "RollsportManager <noreply@rollsportmanager.de>",
    secure: true,
    password: "gespeichertes-geheimnis",
  },
  // LEER = die öffentliche Seite zeigt den eingebauten Standardtext (LegalPage
  // DEFAULT_LEGAL, aus v1 übernommen). So verhält sich der Mock wie die frisch
  // aufgesetzte Datenbank nach Migration 0078 — der Betreiber-Editor beginnt
  // leer und überschreibt den Standard nur, wenn er etwas Eigenes einträgt.
  // Ein Platzhaltertext hier würde auf der Beta den gepflegten Standard
  // verdecken (die Beta läuft immer im Mock).
  legal: {
    impressum: "",
    impressumEn: "",
    datenschutz: "",
    datenschutzEn: "",
    agb: "",
    agbEn: "",
  },
  content: {
    websiteTitle: "RollsportManager",
    websiteSubtitle: "Die Vereinsverwaltung für Rollsport",
    seoTitle: "RollsportManager — Vereinsverwaltung für Rollkunstlauf & Co.",
    seoDescription: "Mitglieder, Termine, Finanzen und Wettkämpfe in einer App.",
    seoKeywords: "Rollsport, Vereinsverwaltung, Rollkunstlauf, Rollhockey",
  },
  featureFlags: {
    wettkampf_live: true,
    bankabgleich: true,
    ki_etikett: false,
  },
  updatedAt: daysFromNow(-2),
};

/** Store → View-Modell (maskiert das Passwort zu passwordSet). */
function settingsView(): PlatformSettings {
  return {
    smtp: {
      host: settingsStore.smtp.host,
      port: settingsStore.smtp.port,
      user: settingsStore.smtp.user,
      from: settingsStore.smtp.from,
      secure: settingsStore.smtp.secure,
      passwordSet: settingsStore.smtp.password.length > 0,
    },
    legal: { ...settingsStore.legal },
    content: { ...settingsStore.content },
    featureFlags: { ...settingsStore.featureFlags },
    updatedAt: settingsStore.updatedAt,
  };
}

export const moduleRepositoryPlatform: PlatformConsoleRepository = {
  /* ---------- Einstellungen ---------- */
  async platformGetSettings() {
    return settingsView();
  },
  async getPublicLegal() {
    // Nur der Override-Blob (leer = eingebauter Standard), wie GET /public/legal.
    const l = settingsStore.legal;
    return {
      impressum: { de: l.impressum, en: l.impressumEn },
      datenschutz: { de: l.datenschutz, en: l.datenschutzEn },
      agb: { de: l.agb, en: l.agbEn },
    };
  },
  async platformUpdateSettings(patch) {
    if (patch.smtp) {
      const s = patch.smtp;
      if (s.host !== undefined) settingsStore.smtp.host = s.host;
      if (s.port !== undefined) settingsStore.smtp.port = s.port;
      if (s.user !== undefined) settingsStore.smtp.user = s.user;
      if (s.from !== undefined) settingsStore.smtp.from = s.from;
      if (s.secure !== undefined) settingsStore.smtp.secure = s.secure;
      // WRITE-ONLY: nur ersetzen, wenn tatsächlich ein Passwort gesendet wurde.
      if (s.password !== undefined) settingsStore.smtp.password = s.password;
    }
    if (patch.legal) Object.assign(settingsStore.legal, patch.legal);
    if (patch.content) Object.assign(settingsStore.content, patch.content);
    if (patch.featureFlags) {
      settingsStore.featureFlags = { ...settingsStore.featureFlags, ...patch.featureFlags };
    }
    settingsStore.updatedAt = nowIso();
    return settingsView();
  },

  /* ---------- Lizenzen ---------- */
  async platformListEntitlements() {
    return entitlementStore.map((e) => ({ ...e }));
  },
  async platformSetEntitlement(clubId, input) {
    const hit = entitlementStore.find((e) => e.clubId === clubId);
    const validUntil = input.validUntil === null ? undefined : input.validUntil;
    if (hit) {
      hit.tier = input.tier;
      hit.status = input.status;
      hit.source = "manual";
      if (input.validUntil !== undefined) hit.validUntil = validUntil;
      hit.updatedAt = nowIso();
      return { ...hit };
    }
    const created: PlatformEntitlement = {
      clubId,
      clubName: clubId,
      memberCount: 0,
      entitlementId: `ent-${clubId}`,
      tier: input.tier,
      status: input.status,
      source: "manual",
      validUntil,
      updatedAt: nowIso(),
    };
    entitlementStore.push(created);
    return { ...created };
  },

  /* ---------- Zahlungen / Abos ---------- */
  async platformListPayments(query) {
    let events = paymentStore;
    if (query?.provider) events = events.filter((e) => e.provider === query.provider);
    if (query?.status) events = events.filter((e) => e.status === query.status);
    const total = events.length;
    const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
    const offset = Math.max(query?.offset ?? 0, 0);
    return {
      events: events.slice(offset, offset + limit).map((e) => ({ ...e })),
      subscriptionSummary: {
        active: entitlementStore.filter((e) => e.status === "active").length,
        trial: entitlementStore.filter((e) => e.status === "trial").length,
        pastDue: entitlementStore.filter((e) => e.status === "past_due").length,
        canceled: entitlementStore.filter((e) => e.status === "canceled").length,
        licensedClubs: entitlementStore.filter((e) => e.entitlementId).length,
      },
      page: { total, limit, offset },
    };
  },

  /* ---------- Produkte ---------- */
  async platformListProducts() {
    return productStore.map((p) => ({ ...p }));
  },
  async platformUpdateProduct(id, patch) {
    const hit = productStore.find((p) => p.id === id);
    if (!hit) throw new Error(`Unbekanntes Produkt: ${id}`);
    if (patch.priceCents !== undefined) hit.priceCents = patch.priceCents;
    if (patch.active !== undefined) hit.active = patch.active;
    if (patch.name !== undefined) hit.name = patch.name;
    if (patch.description !== undefined) {
      hit.description = patch.description === null ? undefined : patch.description;
    }
    hit.updatedAt = nowIso();
    return { ...hit };
  },

  /* ---------- Küren-Moderation ---------- */
  async platformListRoutines(query) {
    const q = query?.q?.trim().toLowerCase();
    let rows = routineStore;
    if (query?.clubId) rows = rows.filter((r) => r.clubId === query.clubId);
    if (query?.status) rows = rows.filter((r) => r.status === query.status);
    if (q) {
      rows = rows.filter((r) =>
        [r.title, r.musicTitle, r.musicArtist].some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    const offset = query?.offset ?? 0;
    return rows.slice(offset, offset + (query?.limit ?? 100)).map((r) => ({ ...r }));
  },

  /* ---------- System-Info ---------- */
  async platformSystemInfo() {
    return {
      appVersion: "2.0.0-dev",
      authMode: "dev",
      db: {
        clubs: 3,
        users: members.filter((m) => m.email).length,
        members: members.length,
        activeEntitlements: entitlementStore.filter((e) => e.status === "active").length,
        webhookEvents: paymentStore.length,
        sizeBytes: 44_040_192,
        sizePretty: "42 MB",
      },
      migrations: {
        count: 19,
        latest: "0019_platform.sql",
        list: ["0017_wettkampf.sql", "0018_org.sql", "0019_platform.sql"],
      },
      health: { status: "ok", dbTime: nowIso() },
    };
  },
};
