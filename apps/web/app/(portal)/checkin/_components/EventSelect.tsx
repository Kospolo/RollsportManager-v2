"use client";

import { useMemo } from "react";
import type { Event } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateShort, formatTime } from "@/lib/format";
import { Select } from "@/components/ui/Field";
import { checkinDict } from "../i18n";
import { isSameDay, selectableEvents } from "../logic";

/**
 * Geteilte Termin-Auswahl fürs Einchecken (Selbst-Service + Trainer). Zeigt
 * „Ohne Termin" plus zwei Gruppen: heutige Termine zuerst, danach die
 * kommenden. Der Wert ist die Event-ID ("" = ohne Termin).
 */
export function EventSelect({
  value,
  onChange,
  events,
  now,
}: {
  value: string;
  onChange: (eventId: string) => void;
  events: Event[];
  now: Date;
}) {
  const t = useT(checkinDict);
  const { locale } = useLocale();

  const { today, upcoming } = useMemo(() => {
    const selectable = selectableEvents(events, now);
    return {
      today: selectable.filter((event) => isSameDay(event.startsAt, now)),
      upcoming: selectable.filter((event) => !isSameDay(event.startsAt, now)),
    };
  }, [events, now]);

  return (
    <Select
      label={t("eventLabel")}
      hint={t("eventHint")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("noEvent")}</option>
      {today.length > 0 && (
        <optgroup label={t("todayGroup")}>
          {today.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} · {formatTime(event.startsAt, locale)}
            </option>
          ))}
        </optgroup>
      )}
      {upcoming.length > 0 && (
        <optgroup label={t("upcomingGroup")}>
          {upcoming.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} · {formatDateShort(event.startsAt, locale)}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
