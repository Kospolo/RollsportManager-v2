"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { EventType, ReportUpcomingEvent } from "@/lib/types";
import { auswertungDict, eventTypeLabelKey } from "../i18n";

/**
 * Kompakte Liste der nächsten Termine (max. 5 aus der Auswertung). Jeder
 * Eintrag zeigt Typ-Chip, Titel und Zeitpunkt (lokalisiert). Übersteigt die
 * Gesamtzahl die angezeigten Einträge, folgt ein dezenter „und N weitere“-Hinweis.
 */

const EVENT_TONE: Record<EventType, BadgeTone> = {
  training: "info",
  competition: "warn",
  other: "neutral",
};

export function UpcomingEventsCard({
  events,
  total,
  className = "",
}: {
  events: ReportUpcomingEvent[];
  /** Gesamtzahl kommender Termine (upcomingEventsCount) für den „+N“-Hinweis. */
  total: number;
  className?: string;
}) {
  const t = useT(auswertungDict);
  const { locale } = useLocale();
  const rest = Math.max(total - events.length, 0);

  return (
    <Card className={className}>
      <CardHeader eyebrow={t("eventsEyebrow")} title={t("eventsTitle")} />
      {events.length === 0 ? (
        <p className="text-body text-ink-soft">{t("eventsEmpty")}</p>
      ) : (
        <ul className="grid gap-2.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3.5 py-2.5"
            >
              <Badge tone={EVENT_TONE[event.type]}>{t(eventTypeLabelKey(event.type))}</Badge>
              <span className="min-w-0 flex-1 truncate font-display text-[14px] font-bold tracking-[-0.01em] text-ink">
                {event.title}
              </span>
              <span className="flex-none font-mono text-[12px] tabular-nums text-ink-faint">
                {formatDateTime(event.startsAt, locale)}
              </span>
            </li>
          ))}
          {rest > 0 && (
            <li className="pt-0.5 text-caption text-ink-faint">{t("eventsMore", { n: rest })}</li>
          )}
        </ul>
      )}
    </Card>
  );
}
