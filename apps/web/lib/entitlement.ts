import type { EntitlementTier } from "@/lib/types";

/**
 * Kür-Kontingent je Vereins-Stufe.
 *
 * BEOBACHTUNG — die Werte stammen 1:1 aus der alten Seite
 * (`rollsportmanager-backend/migrations/20260109_monetization.sql`):
 *   free_kueren_limit    = 1   (Zeile 93)
 *   premium_kueren_limit = 10  (Zeile 98)
 *   Trainer-verwaltet/oberste Stufe = unbegrenzt (dort v_kueren_limit := 999999)
 *
 * ANALYSE — Zuordnung auf v2s drei Stufen (umkehrbar, reine Produktentscheidung):
 *   free    → 1     (wie v1 kostenlos)
 *   pro     → 10    (wie v1 premium)
 *   premium → null  (unbegrenzt)
 *
 * `null` bedeutet unbegrenzt. Dies ist im mock-Modus nur die ANZEIGE; die
 * verbindliche Durchsetzung gehört wie in v1 auf den Server (get_user_limits +
 * Prüfung im Anlege-Pfad), sobald v2 einen echten Login hat.
 */
export const ROUTINE_LIMIT_BY_TIER: Record<EntitlementTier, number | null> = {
  free: 1,
  pro: 10,
  premium: null,
};

/** Kür-Kontingent der Stufe — null = unbegrenzt. */
export function routineLimit(tier: EntitlementTier): number | null {
  return ROUTINE_LIMIT_BY_TIER[tier];
}

/** Anzeigename der Stufe je Sprache (echte Umlaute, DE/EN). */
export function tierName(tier: EntitlementTier, locale: "de" | "en"): string {
  const de: Record<EntitlementTier, string> = {
    free: "Kostenlos",
    pro: "Pro",
    premium: "Premium",
  };
  const en: Record<EntitlementTier, string> = {
    free: "Free",
    pro: "Pro",
    premium: "Premium",
  };
  return (locale === "de" ? de : en)[tier];
}
