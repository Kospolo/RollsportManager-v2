import type { BadgeTone } from "@/components/ui/Badge";
import type { ChatReportStatus } from "@/lib/types";

/** Badge-Ton je Bearbeitungsstand (Status nie nur über Farbe — immer + Wort). */
export const REPORT_STATUS_TONE: Record<ChatReportStatus, BadgeTone> = {
  open: "warn",
  in_review: "info",
  resolved: "success",
  dismissed: "neutral",
};

/** Reihenfolge der Status im Auswahlfeld. */
export const REPORT_STATUS_ORDER: readonly ChatReportStatus[] = [
  "open",
  "in_review",
  "resolved",
  "dismissed",
];
