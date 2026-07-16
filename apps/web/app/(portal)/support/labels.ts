import type { SupportTicketPriority, SupportTicketStatus } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";
import type { supportDict } from "./i18n";

type Key = keyof (typeof supportDict)["de"];

/**
 * Status/Priorität -> Beschriftung + Farbton. EINE Stelle, damit Liste und
 * Verlauf nie auseinanderlaufen.
 *
 * "honey" fehlt hier bewusst: der Ton ist laut Badge.tsx NUR für Musik/Küren.
 */
export const STATUS_KEY: Record<SupportTicketStatus, Key> = {
  open: "statusOpen",
  in_progress: "statusInProgress",
  waiting_on_club: "statusWaiting",
  closed: "statusClosed",
};

export const STATUS_TONE: Record<SupportTicketStatus, BadgeTone> = {
  open: "info",
  in_progress: "brand",
  waiting_on_club: "warn",
  closed: "neutral",
};

export const PRIORITY_KEY: Record<SupportTicketPriority, Key> = {
  low: "prioLow",
  normal: "prioNormal",
  high: "prioHigh",
  urgent: "prioUrgent",
};

export const PRIORITY_TONE: Record<SupportTicketPriority, BadgeTone> = {
  low: "neutral",
  normal: "neutral",
  high: "warn",
  urgent: "danger",
};
