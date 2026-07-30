import type { EntitlementTier } from "@/lib/types";

/**
 * Stufen-Umschalter des MOCK-Modus (rein für Entwicklung/Demo).
 *
 * Der Demo-Verein ist von Haus aus 'pro' (Galerie/Dokumente frei, Kür-Kontingent
 * hoch). Für das Durchspielen der PRO-STAFFELUNG — „was sieht ein Verein OHNE
 * Pro? wo beißt das Kür-Limit?" — lässt sich die Stufe über localStorage
 * `rsm.mock.tier` = free|pro|premium umstellen, ohne echte Auth.
 *
 * Nur der Mock liest das; der api-Modus kennt es nicht (dort kommt die Stufe aus
 * dem echten Entitlement, app.is_club_pro). Fehlt/ungültig → Vorgabe 'pro'.
 *
 * Schwester von {@link ./viewer.ts} (rsm.mock.viewer): dieselbe Idee, dieselbe
 * Fail-safe-Vorgabe, damit eine normale Besucherin nichts davon merkt.
 */
export const MOCK_TIER_KEY = "rsm.mock.tier";

const VALID: readonly EntitlementTier[] = ["free", "pro", "premium"];

/** Vorgabe = die bisherige Demo-Stufe. Wer nichts wählt, sieht 'pro'. */
export const DEFAULT_TIER: EntitlementTier = "pro";

export function mockTier(): EntitlementTier {
  if (typeof window !== "undefined") {
    try {
      const t = window.localStorage.getItem(MOCK_TIER_KEY);
      if (t && (VALID as readonly string[]).includes(t)) return t as EntitlementTier;
    } catch {
      /* localStorage nicht verfügbar → Vorgabe */
    }
  }
  return DEFAULT_TIER;
}
