import type { PlatformConsoleRepository } from "../inputs-platform";
import { apiClient } from "./client";
import {
  mapPlatformEntitlement,
  mapPlatformPayments,
  mapPlatformProduct,
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
        datenschutz: patch.legal.datenschutz,
        agb: patch.legal.agb,
      },
      content: patch.content && {
        website_title: patch.content.websiteTitle,
        website_subtitle: patch.content.websiteSubtitle,
        seo_title: patch.content.seoTitle,
        seo_description: patch.content.seoDescription,
        seo_keywords: patch.content.seoKeywords,
      },
      feature_flags: patch.featureFlags,
    });
    return mapPlatformSettings(updated);
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

  /* ---------- System-Info ---------- */
  async platformSystemInfo() {
    return mapPlatformSystem(await apiClient.getPlatformSystem());
  },
};
