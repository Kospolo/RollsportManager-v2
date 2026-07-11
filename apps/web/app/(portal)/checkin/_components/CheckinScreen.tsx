"use client";

import { useMemo, useState } from "react";
import type { Checkin, Event, Id, Member } from "@/lib/types";
import { dataSource, errorMessage, fullName, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { checkinDict } from "../i18n";
import { MyQrCard } from "./MyQrCard";
import { SelfCheckinCard } from "./SelfCheckinCard";
import { CheckinList } from "./CheckinList";
import { ScanCheckinCard } from "./ScanCheckinCard";
import { TrainerCheckinCard } from "./TrainerCheckinCard";
import { ClubCheckins } from "./ClubCheckins";
import { DeleteCheckinDialog } from "./DeleteCheckinDialog";

/**
 * Check-in-Screen (QR-Ersatz im Web): oben „Mein QR-Code" zum Vorzeigen, das
 * Selbst-Einchecken für den heutigen/nächsten Termin und die eigene Historie
 * (Selbst-Service für jedes Mitglied). Trainer:innen sehen zusätzlich das
 * manuelle Einchecken eines Mitglieds und die Vereins-Historie inkl. Löschen.
 * Sichtbarkeit ist Komfort — die verbindliche Durchsetzung bleibt serverseitig
 * (RLS/API, Referenz 1.3; 403 → Toast + Rollback).
 *
 * Im mock-Modus ist die Demo-Persona eine Trainerin, damit alle Schreib- und
 * Trainer-Pfade erlebbar sind; im api-Modus zählt allein die echte Rolle.
 */

const NO_CHECKINS: Checkin[] = [];
const NO_MEMBERS: Member[] = [];
const NO_EVENTS: Event[] = [];

export function CheckinScreen() {
  const t = useT(checkinDict);
  const now = useMemo(() => new Date(), []);

  const state = useData((repo) =>
    Promise.all([
      repo.getCurrentUser(),
      repo.getMembers(),
      repo.getEvents(),
      repo.listCheckins(),
    ] as const),
  );

  const currentUser = state.data?.[0] ?? null;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const events = state.data?.[2] ?? NO_EVENTS;
  const checkins = state.data?.[3] ?? NO_CHECKINS;

  const isTrainer =
    (currentUser != null && permissions(currentUser).isTrainer) || dataSource === "mock";

  const [toDelete, setToDelete] = useState<Checkin | null>(null);

  const memberName = useMemo(() => {
    const map = new Map<Id, Member>(members.map((m) => [m.id, m]));
    return (memberId: Id): string => {
      const member = map.get(memberId);
      return member ? fullName(member) : t("unknownMember");
    };
  }, [members, t]);

  const eventTitle = useMemo(() => {
    const map = new Map<Id, Event>(events.map((e) => [e.id, e]));
    return (eventId?: Id): string | undefined =>
      eventId ? (map.get(eventId)?.title ?? t("unknownEvent")) : undefined;
  }, [events, t]);

  const myCheckins = useMemo(
    () => (currentUser ? checkins.filter((c) => c.memberId === currentUser.id) : NO_CHECKINS),
    [checkins, currentUser],
  );

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-6" aria-hidden="true">
        <SkeletonCard lines={4} />
        <Skeleton className="h-28 w-full rounded-lg" />
        <SkeletonCard lines={3} />
      </div>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("notConnectedTitle")} body={t("notConnectedBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (currentUser) {
    body = (
      <div className="grid gap-8">
        <MyQrCard member={currentUser} />

        <SelfCheckinCard
          memberId={currentUser.id}
          events={events}
          myCheckins={myCheckins}
          now={now}
          onCheckedIn={state.reload}
        />

        <section className="grid gap-3">
          <SectionHeader level={2} title={t("historyTitle")} sub={t("historySub")} />
          <CheckinList
            entries={myCheckins}
            eventTitle={eventTitle}
            emptyTitle={t("historyEmptyTitle")}
            emptyBody={t("historyEmptyBody")}
          />
        </section>

        {isTrainer && (
          <>
            <ScanCheckinCard
              members={members}
              events={events}
              now={now}
              onCheckedIn={state.reload}
            />
            <TrainerCheckinCard
              members={members}
              events={events}
              now={now}
              onCheckedIn={state.reload}
            />
            <ClubCheckins
              checkins={checkins}
              memberName={memberName}
              eventTitle={eventTitle}
              now={now}
              onDelete={setToDelete}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <SectionHeader level={1} title={t("pageTitle")} sub={t("pageSub")} />

      {body}

      <DeleteCheckinDialog
        checkin={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
