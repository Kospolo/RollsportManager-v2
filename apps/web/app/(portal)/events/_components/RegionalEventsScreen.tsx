"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { errorMessage, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import { useT } from "@/lib/i18n";
import type { RegionalEvent } from "@/lib/types";
import { eventsDict } from "../i18n";
import { isPastEvent, todayIso } from "../helpers";
import { RegionalEventCard } from "./RegionalEventCard";
import { RegionalEventDetailSheet } from "./RegionalEventDetailSheet";
import { RegionalEventFormSheet } from "./RegionalEventFormSheet";
import { DeleteRegionalEventDialog } from "./DeleteRegionalEventDialog";

/** Stabiler Leer-Fallback, solange die Facade noch lädt (kein useMemo-Flackern). */
const NO_EVENTS: RegionalEvent[] = [];

/**
 * Screen der überregionalen Events: liest die Events über die Facade. Kommende
 * Events (frühester zuerst) stehen oben, vergangene gedämpft in einer eigenen
 * Sektion darunter (neueste zuerst). Wer die Fähigkeit `regional_events` auf
 * Stufe `edit` erreicht (Vorstand/Owner, Admin, Trainerstab), sieht „Event
 * anlegen“ sowie Bearbeiten/Löschen — ein normales Mitglied nur die Lese-
 * Ansicht inkl. Anmelde-Link. Die Sichtbarkeit ist kosmetisch, die Durchsetzung
 * bleibt serverseitig (RLS); ein 403 wird als Toast behandelt.
 */
export function RegionalEventsScreen() {
  const t = useT(eventsDict);
  const { hasCap } = useCapabilities();

  const core = useData(async (repo) => {
    const events = await repo.listRegionalEvents();
    return { events };
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RegionalEvent | null>(null);
  const [detail, setDetail] = useState<RegionalEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegionalEvent | null>(null);

  const events = core.status === "ready" ? core.data.events : NO_EVENTS;
  // Schreib-/Admin-Controls (Anlegen/Bearbeiten/Löschen) hängen an der Fähigkeit
  // `regional_events` auf Stufe `edit`. Ein normales Mitglied fällt fail-closed
  // darunter und sieht nur die Lese-Ansicht; Vorstand/Owner (protected → Rang 5)
  // sieht weiterhin alles. Der Server bleibt die eigentliche Durchsetzung.
  const canManage = hasCap("regional_events", "edit");

  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const up: RegionalEvent[] = [];
    const pastList: RegionalEvent[] = [];
    for (const event of events) (isPastEvent(event, today) ? pastList : up).push(event);
    up.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
    pastList.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    return { upcoming: up, past: pastList };
  }, [events]);

  function create() {
    setEditing(null);
    setFormOpen(true);
  }
  function startEdit(event: RegionalEvent) {
    setDetail(null);
    setEditing(event);
    setFormOpen(true);
  }
  function askDelete(event: RegionalEvent) {
    setDetail(null);
    setDeleteTarget(event);
  }

  const isPast = (event: RegionalEvent) => isPastEvent(event, todayIso());

  const cardsOf = (list: RegionalEvent[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((event) => (
        <RegionalEventCard
          key={event.id}
          event={event}
          canWrite={canManage}
          isPast={isPast(event)}
          onOpen={() => setDetail(event)}
          onEdit={() => startEdit(event)}
          onDelete={() => askDelete(event)}
        />
      ))}
    </div>
  );

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={t("pageTitle")}
      sub={t("pageSub")}
      action={
        canManage ? (
          <Button icon="plus" disabled={core.status !== "ready"} onClick={create}>
            {t("create")}
          </Button>
        ) : undefined
      }
    />
  );

  if (core.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={
              <Button variant="secondary" onClick={core.reload}>
                {t("retry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (core.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <Skeleton className="h-5 w-40 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl content-start gap-8">
      {header}

      {events.length === 0 ? (
        <EmptyState
          icon="events"
          title={t("emptyTitle")}
          body={canManage ? t("emptyBodyTrainer") : t("emptyBodyMember")}
          action={
            canManage ? (
              <Button icon="plus" onClick={create}>
                {t("emptyCta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="grid gap-4">
            <SectionHeader level={2} title={t("upcomingTitle")} sub={t("upcomingSub")} />
            {upcoming.length === 0 ? (
              <EmptyState
                icon="events"
                title={t("upcomingEmptyTitle")}
                body={t("upcomingEmptyBody")}
              />
            ) : (
              cardsOf(upcoming)
            )}
          </section>

          {past.length > 0 && (
            <section className="grid gap-4">
              <SectionHeader level={2} title={t("pastTitle")} sub={t("pastSub")} />
              {cardsOf(past)}
            </section>
          )}
        </>
      )}

      {detail && (
        <RegionalEventDetailSheet
          event={detail}
          canWrite={canManage}
          isPast={isPast(detail)}
          onClose={() => setDetail(null)}
          onEdit={() => startEdit(detail)}
          onDelete={() => askDelete(detail)}
        />
      )}

      <RegionalEventFormSheet
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={core.reload}
      />

      <DeleteRegionalEventDialog
        event={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={core.reload}
      />
    </div>
  );
}
