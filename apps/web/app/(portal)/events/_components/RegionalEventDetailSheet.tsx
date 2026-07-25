"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Modal";
import { Icon, type IconName } from "@/components/shell/icons";
import { useCapabilities } from "@/lib/capabilities";
import { useLocale, useT } from "@/lib/i18n";
import type { RegionalEvent } from "@/lib/types";
import { eventsDict } from "../i18n";
import { formatEventDateSpan, safeExternalUrl } from "../helpers";

/**
 * Detail-Ansicht eines überregionalen Events als rechtes Sheet: Disziplin-/
 * Vergangen-Chip, Ausrichter, Ort, Datum(sspanne), Anmelde-Link-Button und
 * die vollständige Beschreibung (Zeilenumbrüche erhalten). Bearbeiten/Löschen
 * im Fuß nur, wenn der Aufrufer den Schreib-Kontext meldet (canWrite) UND die
 * Fähigkeit `regional_events` auf Stufe `edit` erreicht ist — so schützt sich
 * das Sheet selbst und verlässt sich nicht allein auf die Elternkomponente. Ein
 * normales Mitglied sieht die reine Lese-Ansicht inkl. Anmelde-Link. Die
 * Durchsetzung bleibt serverseitig (RLS), ein 403 wird im Screen als Toast
 * behandelt.
 */
export function RegionalEventDetailSheet({
  event,
  canWrite,
  isPast,
  onClose,
  onEdit,
  onDelete,
}: {
  event: RegionalEvent;
  canWrite: boolean;
  isPast: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(eventsDict);
  const { locale } = useLocale();
  const { hasCap } = useCapabilities();

  // Eigenständige Gate: der Fuß mit Bearbeiten/Löschen erscheint nur, wenn der
  // Aufrufer den Schreib-Kontext meldet UND die Fähigkeit tatsächlich reicht.
  const canWriteEvents = canWrite && hasCap("regional_events", "edit");

  const registerUrl = safeExternalUrl(event.registrationUrl);

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("detailEyebrow")}
      title={event.title}
      footer={
        canWriteEvents ? (
          <>
            <Button variant="ghost" icon="edit" onClick={onEdit}>
              {t("edit")}
            </Button>
            <Button variant="danger" onClick={onDelete}>
              {t("delete")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid gap-4">
        {(event.discipline || isPast) && (
          <div className="flex flex-wrap items-center gap-2">
            {event.discipline && <Badge tone="info">{event.discipline}</Badge>}
            {isPast && <Badge tone="neutral">{t("pastBadge")}</Badge>}
          </div>
        )}

        <dl className="grid gap-3">
          <MetaRow icon="events">
            {formatEventDateSpan(event.startsOn, event.endsOn, locale)}
          </MetaRow>
          {event.hostOrg && (
            <MetaRow icon="teams" label={t("hostBy")}>
              {event.hostOrg}
            </MetaRow>
          )}
          {event.location && <MetaRow icon="pin">{event.location}</MetaRow>}
        </dl>

        {registerUrl && (
          <a
            href={registerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-brand-soft px-5 text-[14px] font-bold text-brand-ink no-underline transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
          >
            <Icon name="globe" className="ic h-[17px] w-[17px]" />
            {t("register")}
          </a>
        )}

        <p className="whitespace-pre-wrap text-body leading-[23px] text-ink">
          {event.description?.trim() ? (
            event.description
          ) : (
            <span className="text-ink-faint">{t("noDescription")}</span>
          )}
        </p>
      </div>
    </Sheet>
  );
}

/** Eine Metazeile (Icon + optionales Label + Wert) in der Detail-Ansicht. */
function MetaRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-body text-ink">
      <Icon name={icon} className="ic mt-0.5 h-[17px] w-[17px] flex-none text-ink-faint" />
      <span className="min-w-0">
        {label && <span className="text-ink-soft">{label}: </span>}
        {children}
      </span>
    </div>
  );
}
