"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { OfferRideInput, Ride, RideRider } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import type { Event, Member } from "@/lib/types";
import { termineDict } from "../i18n";
import { isAdultMember } from "../helpers";
import { RideCard } from "./RideCard";
import { OfferRideSheet } from "./OfferRideSheet";
import { ConfirmRideDialog, JoinRideModal, type RideCandidate } from "./RideDialogs";

/** Stabiler Leer-Fallback, solange die Facade lädt (kein useMemo-Flackern). */
const NO_RIDES: Ride[] = [];

/**
 * Bereich „Fahrgemeinschaften" im Termin-Detail. Lädt die Fahrten des Termins
 * über die Facade und hält sie in einem lokalen Stand: jeder Schreibpfad
 * liefert die GANZE Fahrt zurück, deshalb wird sie ersetzt statt nachgerechnet
 * — Platzzahl und Rückrufnummer stammen so immer aus der letzten Antwort und
 * nie aus einer Client-Schätzung.
 *
 * ### KEIN OPTIMISTISCHES SCHREIBEN ###
 * Bewusst anders als bei den RSVPs. Ob eine Zusage durchgeht, hängt an Dingen,
 * die der Browser nicht sicher weiß: freier Platz (zwei Eltern können
 * gleichzeitig tippen), Vormundschaft, Alter. Eine optimistisch gefüllte Karte,
 * die eine Sekunde später zurückspringt, wäre hier keine Beschleunigung,
 * sondern eine Falschaussage über einen Sitzplatz.
 *
 * ### DIE GATES HIER SIND ANZEIGE, NICHT SICHERHEIT ###
 * „Fahrt anbieten" verschwindet bei Minderjährigen, „Mitfahren" nur bei freien
 * Plätzen — beides, damit die Oberfläche nicht lügt. Durchgesetzt wird alles
 * serverseitig (Trigger + RLS); ein 403/422 bleibt jederzeit möglich und landet
 * als Klartext-Toast.
 */
export function RidesPanel({
  event,
  currentUser,
  members,
}: {
  event: Event;
  currentUser: Member;
  members: Member[];
}) {
  const t = useT(termineDict);
  const { showToast } = useToast();

  const ridesState = useData((repo) => repo.getEventRides(event.id), [event.id]);
  const guardianState = useData((repo) => repo.getGuardianships(), []);

  /** Nach dem ersten Schreiben führt dieser Stand; davor der geladene. */
  const [overrides, setOverrides] = useState<Record<string, Ride>>({});
  const [created, setCreated] = useState<Ride[]>([]);
  const [busyRideId, setBusyRideId] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [joinFor, setJoinFor] = useState<Ride | null>(null);
  const [leaving, setLeaving] = useState<{ ride: Ride; rider: RideRider } | null>(null);
  const [cancelling, setCancelling] = useState<Ride | null>(null);

  const rides = useMemo(() => {
    const loaded = ridesState.status === "ready" ? ridesState.data : NO_RIDES;
    return [...loaded, ...created].map((ride) => overrides[ride.id] ?? ride);
  }, [ridesState, created, overrides]);

  /** Kinder der eingeloggten Person — die Vormund-Auswahl beim Zusagen. */
  const children = useMemo(() => {
    if (guardianState.status !== "ready") return [];
    const ids = guardianState.data
      .filter((g) => g.guardianId === currentUser.id)
      .map((g) => g.childId);
    return members.filter((m) => ids.includes(m.id));
  }, [guardianState, members, currentUser.id]);

  const canOffer = isAdultMember(currentUser);
  const isManagement = ["owner", "admin", "moderator", "treasurer"].includes(currentUser.role);

  /** Für wen kann auf DIESER Fahrt noch zugesagt werden? */
  function candidatesFor(ride: Ride): RideCandidate[] {
    const taken = new Set(ride.riders.map((r) => r.memberId));
    const list: RideCandidate[] = [];
    if (!taken.has(currentUser.id) && ride.driverMemberId !== currentUser.id) {
      list.push({ memberId: currentUser.id, label: t("rideJoinSelf") });
    }
    for (const child of children) {
      if (!taken.has(child.id)) {
        list.push({ memberId: child.id, label: `${child.firstName} ${child.lastName}` });
      }
    }
    return list;
  }

  /** Die eigene Zusage — oder die des eigenen Kindes (dann darf man sie auch zurückziehen). */
  function ownRiderOf(ride: Ride): RideRider | undefined {
    const ownIds = new Set([currentUser.id, ...children.map((c) => c.id)]);
    return ride.riders.find((r) => ownIds.has(r.memberId));
  }

  function nameOfRider(rider: RideRider): string {
    return `${rider.memberFirstName} ${rider.memberLastName}`;
  }

  function fail(error: unknown) {
    // 403 bekommt den eigenen Satz; 422 (voll, abgesagt) trägt bereits den
    // deutschen Klartext des Servers — der wird wörtlich gezeigt.
    showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), { tone: "danger" });
  }

  function remember(ride: Ride) {
    setOverrides((current) => ({ ...current, [ride.id]: ride }));
  }

  async function offer(input: OfferRideInput): Promise<boolean> {
    try {
      const ride = await data.offerRide(event.id, input);
      setCreated((current) => [...current, ride]);
      showToast(t("rideOfferedToast"), { tone: "success" });
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  async function join(ride: Ride, memberId: string) {
    setBusyRideId(ride.id);
    try {
      const updated = await data.joinRide(ride.id, memberId);
      remember(updated);
      const rider = updated.riders.find((r) => r.memberId === memberId);
      const person = members.find((m) => m.id === memberId);
      showToast(
        t("rideJoinedToast", {
          name: rider ? nameOfRider(rider) : (person ? `${person.firstName} ${person.lastName}` : ""),
        }),
        { tone: "success" },
      );
      setJoinFor(null);
    } catch (error) {
      fail(error);
    } finally {
      setBusyRideId(null);
    }
  }

  async function leave(ride: Ride, rider: RideRider) {
    setBusyRideId(ride.id);
    try {
      const updated = await data.setRideRiderStatus(ride.id, rider.id, "cancelled");
      remember(updated);
      showToast(t("rideLeftToast", { name: nameOfRider(rider) }), { tone: "success" });
      setLeaving(null);
    } catch (error) {
      fail(error);
    } finally {
      setBusyRideId(null);
    }
  }

  async function cancelRide(ride: Ride) {
    setBusyRideId(ride.id);
    try {
      const updated = await data.updateRide(ride.id, { status: "cancelled" });
      remember(updated);
      showToast(t("rideCancelledToast"), { tone: "success" });
      setCancelling(null);
    } catch (error) {
      fail(error);
    } finally {
      setBusyRideId(null);
    }
  }

  /** „Mitfahren": bei genau einer möglichen Person ohne Zwischenfrage. */
  function startJoin(ride: Ride) {
    const candidates = candidatesFor(ride);
    if (candidates.length === 1) {
      void join(ride, candidates[0]!.memberId);
      return;
    }
    setJoinFor(ride);
  }

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h3 className="inline-flex items-center gap-2 text-[14px] font-bold text-ink">
            <Icon name="car" className="ic h-4 w-4 flex-none text-ink-faint" />
            {t("ridesTitle")}
          </h3>
          <p className="text-caption text-ink-faint">{t("ridesSub")}</p>
        </div>
        {canOffer && (
          <Button size="sm" variant="secondary" onClick={() => setOfferOpen(true)}>
            {t("ridesOffer")}
          </Button>
        )}
      </header>

      {!canOffer && <p className="text-caption text-ink-faint">{t("ridesMinorHint")}</p>}

      {ridesState.status === "loading" && <SkeletonCard />}

      {ridesState.status === "error" && (
        <EmptyState
          title={t("ridesErrorTitle")}
          body={errorMessage(ridesState.error)}
          action={
            <Button variant="secondary" size="sm" onClick={ridesState.reload}>
              {t("retry")}
            </Button>
          }
        />
      )}

      {ridesState.status === "ready" && rides.length === 0 && (
        <EmptyState title={t("ridesEmptyTitle")} body={t("ridesEmptyBody")} />
      )}

      {rides.length > 0 && (
        <ul className="grid gap-3">
          {rides.map((ride) => {
            const ownRider = ownRiderOf(ride);
            return (
              <li key={ride.id}>
                <RideCard
                  ride={ride}
                  ownRider={ownRider}
                  canJoin={!ownRider && candidatesFor(ride).length > 0}
                  canManage={ride.driverMemberId === currentUser.id || isManagement}
                  busy={busyRideId === ride.id}
                  onJoin={() => startJoin(ride)}
                  onLeave={(rider) => setLeaving({ ride, rider })}
                  onCancelRide={() => setCancelling(ride)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {offerOpen && (
        <OfferRideSheet
          event={event}
          ownMemberId={currentUser.id}
          onClose={() => setOfferOpen(false)}
          onSubmit={offer}
        />
      )}

      {joinFor && (
        <JoinRideModal
          candidates={candidatesFor(joinFor)}
          busy={busyRideId === joinFor.id}
          onClose={() => setJoinFor(null)}
          onConfirm={(memberId) => void join(joinFor, memberId)}
        />
      )}

      {leaving && (
        <ConfirmRideDialog
          title={t("rideLeaveTitle")}
          body={t("rideLeaveBody", { name: nameOfRider(leaving.rider) })}
          confirmLabel={t("rideLeave")}
          busy={busyRideId === leaving.ride.id}
          onClose={() => setLeaving(null)}
          onConfirm={() => void leave(leaving.ride, leaving.rider)}
        />
      )}

      {cancelling && (
        <ConfirmRideDialog
          title={t("rideCancelTitle")}
          body={t("rideCancelBody")}
          confirmLabel={t("rideCancelRide")}
          busy={busyRideId === cancelling.id}
          onClose={() => setCancelling(null)}
          onConfirm={() => void cancelRide(cancelling)}
        />
      )}
    </section>
  );
}
