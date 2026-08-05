import { ApiError } from "@/lib/api/generated";
import type { Problem } from "@/lib/api/generated/types";
import { readSession } from "@/lib/auth/storage";
import type { PlatformRoutineModeration } from "@/lib/types";
import { API_BASE_URL } from "../config";
import type { PlatformConsoleRepository } from "../inputs-platform";
import { apiClient } from "./client";
import {
  mapPlatformEntitlement,
  mapPlatformPayments,
  mapPlatformProduct,
  mapPlatformRoutine,
  mapPlatformSettings,
  mapPlatformSystem,
} from "./mappers-platform";

/**
 * API-Implementierung der Betreiber-/Plattform-Konsole (Lizenzen, Zahlungen,
 * Produkte, System-Info, Einstellungen). Ausgelagert aus api/index.ts (< 400
 * Zeilen). Kein activeClubId-Scope — die Endpoints aggregieren über alle
 * Vereine (clubId kommt als Pfad-Parameter, wo nötig).
 *
 * RECHTE STRIKT SERVERSEITIG: jeder Aufruf trifft einen /platform/*-Endpoint
 * hinter requirePlatformAdmin (bzw. RLS bei den Settings). Ein Nicht-Plattform-
 * Admin bekommt 403 (RFC 7807) — die Facade reicht nur durch.
 */

/* ==========================================================================
 * WARUM fetch UND NICHT apiClient.getPlatformRoutines()
 * ==========================================================================
 * GET /platform/routines ist NEU (routes/platform-routines.ts). lib/api/generated
 * ist GENERIERT ("nie von Hand ändern") und kennt die Route noch nicht — der
 * Codegen läuft EINMAL beim Zusammenführen, nicht in diesem Bautrupp
 * (ausdrückliche Auftragsregel). Gegen eine erfundene Client-Methode zu
 * schreiben, hieße: compiliert nicht, oder — schlimmer — eine Attrappe.
 *
 * Dieser Helfer ist KEIN zweiter API-Client: er spiegelt ApiClient.request
 * (Bearer aus der Dev-Session, RFC-7807-Fehler als ApiError, gleiche Meldung).
 * Die Screens fangen ApiError wie überall sonst. Dasselbe Vorgehen wie in
 * ./modules-support.ts — bewusst dort dupliziert statt geteilt, damit die
 * beiden Bautrupp-Dateien beim Zusammenführen unabhängig bleiben.
 *
 * ERSETZUNGSPUNKT (eine Stelle, mechanisch): nach `npm run generate` existiert
 *   apiClient.getPlatformRoutines({ club_id, status, q, limit, offset })
 * (Name nach Generator-Konvention). Dann `request` unten durch die
 * Client-Methode ersetzen und diesen Block löschen — mapPlatformRoutine und die
 * Facade-Methode bleiben unverändert.
 * ========================================================================== */

async function request<T>(path: string, query: Record<string, string | undefined>): Promise<T> {
  const url = new URL(API_BASE_URL.replace(/\/+$/, "") + path);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  const token = readSession()?.token ?? null;
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { method: "GET", headers });
  if (!res.ok) {
    let problem: Problem | null = null;
    try {
      problem = (await res.json()) as Problem;
    } catch {
      // Kein JSON-Fehlerkörper — problem bleibt null (wie im Generat).
    }
    const detail = problem?.detail ?? problem?.title ?? res.statusText;
    throw new ApiError(res.status, problem, `GET ${path} -> ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export const moduleApiRepositoryPlatform: PlatformConsoleRepository = {
  /* ---------- Einstellungen ---------- */
  async platformGetSettings() {
    return mapPlatformSettings(await apiClient.getPlatformSettings());
  },
  async platformUpdateSettings(patch) {
    const updated = await apiClient.patchPlatformSettings({
      smtp: patch.smtp && {
        host: patch.smtp.host,
        port: patch.smtp.port,
        user: patch.smtp.user,
        from: patch.smtp.from,
        secure: patch.smtp.secure,
        // WRITE-ONLY: weglassen behält, senden ersetzt das gespeicherte Passwort.
        password: patch.smtp.password,
      },
      legal: patch.legal && {
        impressum: patch.legal.impressum,
        impressum_en: patch.legal.impressumEn,
        datenschutz: patch.legal.datenschutz,
        datenschutz_en: patch.legal.datenschutzEn,
        agb: patch.legal.agb,
        agb_en: patch.legal.agbEn,
      },
      content: patch.content && {
        website_title: patch.content.websiteTitle,
        website_subtitle: patch.content.websiteSubtitle,
        seo_title: patch.content.seoTitle,
        seo_description: patch.content.seoDescription,
        seo_keywords: patch.content.seoKeywords,
      },
      feature_flags: patch.featureFlags,
      billing: patch.billing && { trial_days: patch.billing.trialDays },
    });
    return mapPlatformSettings(updated);
  },
  async getPublicLegal() {
    // Öffentlich, ohne Auth (apiClient setzt für diese Route keinen Bearer).
    const w = await apiClient.getPublicLegal();
    return {
      impressum: { de: w.impressum.de, en: w.impressum.en },
      datenschutz: { de: w.datenschutz.de, en: w.datenschutz.en },
      agb: { de: w.agb.de, en: w.agb.en },
    };
  },
  async listPublicClubs() {
    // Öffentlich, ohne Auth. Der Server liefert nur Opt-in-Vereine + nur
    // nicht-personenbezogene Felder (routes/public-clubs.ts).
    const rows = await apiClient.getPublicClubs();
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city ?? undefined,
      discipline: c.discipline ?? undefined,
      publicDescription: c.public_description,
      publicImage: c.public_image,
    }));
  },

  /* ---------- Lizenzen ---------- */
  async platformListEntitlements() {
    const rows = await apiClient.getPlatformEntitlements();
    return rows.map(mapPlatformEntitlement);
  },
  async platformSetEntitlement(clubId, input) {
    const updated = await apiClient.patchPlatformEntitlementsByClubId(clubId, {
      tier: input.tier,
      status: input.status,
      valid_until: input.validUntil,
      trial_days: input.trialDays,
      reason: input.reason,
    });
    return mapPlatformEntitlement(updated);
  },

  /* ---------- Zahlungen / Abos ---------- */
  async platformListPayments(query) {
    const result = await apiClient.getPlatformPayments({
      provider: query?.provider,
      status: query?.status,
      limit: query?.limit,
      offset: query?.offset,
    });
    return mapPlatformPayments(result);
  },

  /* ---------- Produkte ---------- */
  async platformListProducts() {
    const rows = await apiClient.getPlatformProducts();
    return rows.map(mapPlatformProduct);
  },
  async platformUpdateProduct(id, patch) {
    const updated = await apiClient.patchPlatformProductsById(id, {
      price_cents: patch.priceCents,
      active: patch.active,
      name: patch.name,
      description: patch.description,
    });
    return mapPlatformProduct(updated);
  },

  /* ---------- Küren-Moderation ---------- */
  async platformListRoutines(query) {
    const rows = await request<PlatformRoutineWire[]>("/platform/routines", {
      club_id: query?.clubId,
      status: query?.status,
      q: query?.q,
      limit: query?.limit === undefined ? undefined : String(query.limit),
      offset: query?.offset === undefined ? undefined : String(query.offset),
    });
    return rows.map(mapPlatformRoutine);
  },

  /* ---------- System-Info ---------- */
  async platformSystemInfo() {
    return mapPlatformSystem(await apiClient.getPlatformSystem());
  },
};

/**
 * Wire-Form von GET /platform/routines (snake_case) — von Hand getippt, weil
 * das Generat die Route noch nicht kennt (siehe Block oben). Spiegelt
 * platformRoutineRowSchema (services/api/src/lib/platform-schemas.ts) wörtlich;
 * nach `npm run generate` ersetzt M.PlatformRoutineRow diesen Typ.
 */
interface PlatformRoutineWire {
  id: string;
  club_id: string;
  club_name: string;
  title: string;
  status: PlatformRoutineModeration["status"];
  category: string | null;
  music_title: string | null;
  music_artist: string | null;
  music_duration_ms: number | null;
  audio_asset_id: string | null;
  audio_mime_type: string | null;
  audio_size_bytes: number | null;
  skater_count: number;
  created_at: string;
  updated_at: string;
}

export type { PlatformRoutineWire };
