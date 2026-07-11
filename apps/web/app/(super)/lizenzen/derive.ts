import type {
  PlatformEntitlement,
  PlatformEntitlementSource,
  PlatformEntitlementStatus,
  PlatformTier,
} from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";
import type { LizenzenKey } from "./i18n";

/**
 * Reine Ableitungen der Lizenz-Sicht: Farbtöne (Chips/KPIs) und die
 * Dictionary-Schlüssel für Stufe/Status/Quelle. Keine Rechte-Logik — die
 * Sichtbarkeit steuert der (super)-Client, die Durchsetzung der Server.
 * „honey“ bleibt dem Musik-/Küren-Kontext vorbehalten (nicht verwenden).
 */

export const TIER_TONE: Record<PlatformTier, BadgeTone> = {
  basic: "neutral",
  pro: "brand",
  premium: "info",
};

export const STATUS_TONE: Record<PlatformEntitlementStatus, BadgeTone> = {
  trial: "info",
  active: "success",
  past_due: "warn",
  canceled: "danger",
};

export const SOURCE_TONE: Record<PlatformEntitlementSource, BadgeTone> = {
  stripe: "brand",
  revenuecat: "info",
  manual: "neutral",
};

export const TIER_LABEL_KEY: Record<PlatformTier, LizenzenKey> = {
  basic: "tierBasic",
  pro: "tierPro",
  premium: "tierPremium",
};

export const STATUS_LABEL_KEY: Record<PlatformEntitlementStatus, LizenzenKey> = {
  trial: "statusTrial",
  active: "statusActive",
  past_due: "statusPastDue",
  canceled: "statusCanceled",
};

export const SOURCE_LABEL_KEY: Record<PlatformEntitlementSource, LizenzenKey> = {
  stripe: "sourceStripe",
  revenuecat: "sourceRevenuecat",
  manual: "sourceManual",
};

/** Auswahlreihenfolge der Selects — deckt sich mit den Server-Enums. */
export const TIER_OPTIONS: readonly PlatformTier[] = ["basic", "pro", "premium"];
export const STATUS_OPTIONS: readonly PlatformEntitlementStatus[] = [
  "trial",
  "active",
  "past_due",
  "canceled",
];

/** Aggregierte Kennzahlen über alle Vereinszeilen (rein clientseitig gezählt). */
export interface LicenseTotals {
  clubs: number;
  licensed: number;
  active: number;
  trial: number;
  pastDue: number;
  canceled: number;
  members: number;
}

export function licenseTotals(rows: readonly PlatformEntitlement[]): LicenseTotals {
  return rows.reduce<LicenseTotals>(
    (acc, row) => {
      acc.clubs += 1;
      acc.members += row.memberCount;
      if (row.entitlementId) acc.licensed += 1;
      if (row.status === "active") acc.active += 1;
      else if (row.status === "trial") acc.trial += 1;
      else if (row.status === "past_due") acc.pastDue += 1;
      else if (row.status === "canceled") acc.canceled += 1;
      return acc;
    },
    { clubs: 0, licensed: 0, active: 0, trial: 0, pastDue: 0, canceled: 0, members: 0 },
  );
}
