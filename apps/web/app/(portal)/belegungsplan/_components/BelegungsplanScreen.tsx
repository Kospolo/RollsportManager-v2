"use client";

import { useMemo, useState } from "react";
import type { Facility, FacilityBooking, FacilityKind, Member, Team } from "@/lib/types";
import { dataSource, errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { belegungsplanDict } from "../i18n";
import { KIND_LABEL_KEY, KIND_ORDER, upcomingBookings } from "../helpers";
import { FacilityCard } from "./FacilityCard";
import { FacilityDetailSheet } from "./FacilityDetailSheet";
import { FacilityFormDialog, type FacilityFormValue } from "./FacilityFormDialog";
import { DeleteFacilityDialog } from "./DeleteFacilityDialog";
import { BookingFormSheet } from "./BookingFormSheet";
import { DeleteBookingDialog } from "./DeleteBookingDialog";

/**
 * Belegungsplan-Screen: Karten-Grid der Hallen/Räume mit Art-Filter, Klick →
 * Detail-Sheet mit kommenden Buchungen (nach Datum). Buchen läuft über das
 * BookingFormSheet (Self-Service, Überschneidungs-Hinweis clientseitig).
 * Hallen anlegen/bearbeiten/löschen ist Trainer:innen vorbehalten — die
 * Sichtbarkeit ist Komfort, die Durchsetzung bleibt serverseitig (RLS/API,
 * 403 → Toast + Rollback). Nach jedem Schreiben lädt der Screen neu.
 *
 * Im mock-Modus gibt es keine echte Session; die Demo-Persona ist eine
 * Trainerin, damit die Schreibpfade erlebbar sind. Im api-Modus zählt die
 * echte Rolle.
 */

type KindFilter = "all" | FacilityKind;

const NO_FACILITIES: Facility[] = [];
const NO_BOOKINGS: FacilityBooking[] = [];
const NO_MEMBERS: Member[] = [];
const NO_TEAMS: Team[] = [];

export function BelegungsplanScreen() {
  const t = useT(belegungsplanDict);

  const state = useData(async (repo) => {
    const [facilities, bookings, members, currentUser] = await Promise.all([
      repo.listFacilities(),
      repo.listFacilityBookings(),
      repo.getMembers(),
      repo.getCurrentUser(),
    ]);
    // Teams sind im api-Modus evtl. nicht lesbar → Team-Feld entfällt still.
    let teams: Team[] = [];
    try {
      teams = await repo.getTeams();
    } catch (error) {
      if (!isNotImplemented(error)) throw error;
    }
    return { facilities, bookings, members, teams, currentUser };
  });

  const facilities = state.data?.facilities ?? NO_FACILITIES;
  const bookings = state.data?.bookings ?? NO_BOOKINGS;
  const members = state.data?.members ?? NO_MEMBERS;
  const teams = state.data?.teams ?? NO_TEAMS;
  const currentUser = state.data?.currentUser ?? null;

  const isTrainer = permissions(currentUser).isTrainer || dataSource === "mock";
  const canDeleteBooking = (booking: FacilityBooking) =>
    isTrainer || booking.bookedByMemberId === currentUser?.id;

  const [filter, setFilter] = useState<KindFilter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [facilityForm, setFacilityForm] = useState<FacilityFormValue | null>(null);
  const [toDeleteFacility, setToDeleteFacility] = useState<Facility | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingFacilityId, setBookingFacilityId] = useState<string | null>(null);
  const [toDeleteBooking, setToDeleteBooking] = useState<FacilityBooking | null>(null);

  const upcomingByFacility = useMemo(() => {
    const map = new Map<string, number>();
    for (const facility of facilities) {
      const own = bookings.filter((b) => b.facilityId === facility.id);
      map.set(facility.id, upcomingBookings(own).length);
    }
    return map;
  }, [facilities, bookings]);

  const visible = useMemo(
    () => (filter === "all" ? facilities : facilities.filter((f) => f.kind === filter)),
    [facilities, filter],
  );

  const filterOptions: FilterChipOption<KindFilter>[] = [
    { value: "all", label: t("filterAll"), count: facilities.length },
    ...KIND_ORDER.map((kind) => ({
      value: kind,
      label: t(KIND_LABEL_KEY[kind]),
      count: facilities.filter((f) => f.kind === kind).length,
    })),
  ];

  const detailFacility = detailId ? (facilities.find((f) => f.id === detailId) ?? null) : null;
  const detailBookings = detailFacility
    ? bookings.filter((b) => b.facilityId === detailFacility.id)
    : NO_BOOKINGS;

  function openBooking(facilityId?: string) {
    setDetailId(null);
    setBookingFacilityId(facilityId ?? null);
    setBookingOpen(true);
  }

  const headerActions =
    state.status === "ready" && facilities.length > 0 ? (
      <>
        {isTrainer && (
          <Button variant="secondary" icon="plus" onClick={() => setFacilityForm({ mode: "create" })}>
            {t("newFacility")}
          </Button>
        )}
        <Button icon="events" onClick={() => openBooking()}>
          {t("newBooking")}
        </Button>
      </>
    ) : undefined;

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-9 w-full max-w-2xl rounded-full" />
        <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <SkeletonCard lines={2} />
            </li>
          ))}
        </ul>
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
  } else if (facilities.length === 0) {
    body = (
      <EmptyState
        icon="sparkle"
        title={t("listEmptyTitle")}
        body={isTrainer ? t("listEmptyBodyTrainer") : t("listEmptyBodyMember")}
        action={
          isTrainer ? (
            <Button icon="plus" onClick={() => setFacilityForm({ mode: "create" })}>
              {t("listEmptyCta")}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div className="grid gap-5">
        <FilterChips
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          label={t("filterLabel")}
        />
        {visible.length === 0 ? (
          <EmptyState
            icon="search"
            title={t("filterEmptyTitle")}
            body={t("filterEmptyBody")}
            action={
              <Button variant="secondary" onClick={() => setFilter("all")}>
                {t("filterEmptyCta")}
              </Button>
            }
          />
        ) : (
          <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                upcomingCount={upcomingByFacility.get(facility.id) ?? 0}
                onOpen={() => setDetailId(facility.id)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader level={1} title={t("pageTitle")} sub={t("pageSub")} action={headerActions} />

      {body}

      {detailFacility && (
        <FacilityDetailSheet
          key={detailFacility.id}
          facility={detailFacility}
          bookings={detailBookings}
          members={members}
          teams={teams}
          canManageFacility={isTrainer}
          canDeleteBooking={canDeleteBooking}
          onBook={() => openBooking(detailFacility.id)}
          onEditFacility={() => {
            const target = detailFacility;
            setDetailId(null);
            setFacilityForm({ mode: "edit", facility: target });
          }}
          onDeleteFacility={() => {
            const target = detailFacility;
            setDetailId(null);
            setToDeleteFacility(target);
          }}
          onDeleteBooking={setToDeleteBooking}
          onClose={() => setDetailId(null)}
        />
      )}

      {facilityForm && (
        <FacilityFormDialog
          key={facilityForm.mode === "edit" ? `edit-${facilityForm.facility.id}` : "create"}
          value={facilityForm}
          onClose={() => setFacilityForm(null)}
          onSaved={state.reload}
        />
      )}

      <BookingFormSheet
        open={bookingOpen}
        initialFacilityId={bookingFacilityId}
        facilities={facilities}
        bookings={bookings}
        members={members}
        teams={teams}
        currentUser={currentUser}
        canChooseMember={isTrainer}
        onClose={() => setBookingOpen(false)}
        onSaved={state.reload}
      />

      <DeleteFacilityDialog
        facility={toDeleteFacility}
        onClose={() => setToDeleteFacility(null)}
        onDeleted={state.reload}
      />

      <DeleteBookingDialog
        booking={toDeleteBooking}
        onClose={() => setToDeleteBooking(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
