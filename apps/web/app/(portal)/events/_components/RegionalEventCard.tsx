"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import type { RegionalEvent } from "@/lib/types";
import { eventsDict } from "../i18n";
import { formatEventDateSpan, safeExternalUrl } from "../helpers";

/**
 * Karte eines überregionalen Events: Disziplin-/Vergangen-Chip, Titel,
 * Ausrichter, Ort, Datum(sspanne) und — falls hinterlegt — ein Anmelde-Link.
 * Ein randabdeckender Overlay-Button (z-10) öffnet die Detail-Ansicht; der
 * Anmelde-Link und die Trainer-Aktionsleiste liegen darüber (z-20). Vergangene
 * Events werden gedämpft dargestellt (opacity). Schreibrechte gaten nur die
 * Sichtbarkeit — die Durchsetzung bleibt serverseitig (RLS).
 */
export function RegionalEventCard({
  event,
  canWrite,
  isPast,
  onOpen,
  onEdit,
  onDelete,
}: {
  event: RegionalEvent;
  /** Trainer+ (is_club_trainer) — blendet die Aktionsleiste ein */
  canWrite: boolean;
  /** Vergangenes Event — gedämpfte Darstellung */
  isPast: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(eventsDict);
  const { locale } = useLocale();

  const registerUrl = safeExternalUrl(event.registrationUrl);

  return (
    <article
      className={`group relative grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-line-strong ${
        isPast ? "opacity-65" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("openAria", { title: event.title })}
        className="absolute inset-0 z-10 rounded-xl"
      />

      <div className="grid gap-2">
        {(event.discipline || isPast) && (
          <div className="flex flex-wrap items-center gap-2">
            {event.discipline && <Badge tone="info">{event.discipline}</Badge>}
            {isPast && <Badge tone="neutral">{t("pastBadge")}</Badge>}
          </div>
        )}

        <h3 className="text-[15.5px] font-bold leading-snug text-ink transition-colors duration-150 group-hover:text-brand-ink">
          {event.title}
        </h3>

        <div className="grid gap-1 text-caption text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="events" className="ic h-[14px] w-[14px] text-ink-faint" />
            {formatEventDateSpan(event.startsOn, event.endsOn, locale)}
          </span>
          {event.hostOrg && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="teams" className="ic h-[14px] w-[14px] text-ink-faint" />
              {event.hostOrg}
            </span>
          )}
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" className="ic h-[14px] w-[14px] text-ink-faint" />
              {event.location}
            </span>
          )}
        </div>

        {registerUrl && (
          <div className="relative z-20 mt-1 flex">
            <a
              href={registerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-brand-soft px-3.5 text-[13px] font-bold text-brand-ink no-underline transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
            >
              <Icon name="globe" className="ic h-[15px] w-[15px]" />
              {t("register")}
            </a>
          </div>
        )}
      </div>

      {canWrite && (
        <div className="relative z-20 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button
            variant="ghost"
            size="sm"
            icon="edit"
            aria-label={t("editAria", { title: event.title })}
            onClick={onEdit}
          >
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="!text-danger hover:!bg-danger-soft"
            aria-label={t("deleteAria", { title: event.title })}
            onClick={onDelete}
          >
            {t("delete")}
          </Button>
        </div>
      )}
    </article>
  );
}
