"use client";

import { useMemo, useState } from "react";
import type { Locker, LockerRental, LockerStatus, Member, MemberRole } from "@/lib/types";
import { errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { schliessfaecherDict, STATUS_KEY, STATUS_ORDER } from "../i18n";
import { activeRentalOf, monthlyRentalTotal } from "../derive";
import { LockerCard } from "./LockerCard";
import { AssignLockerSheet } from "./AssignLockerSheet";
import { LockerFormDialog, type LockerFormValue } from "./LockerFormDialog";
import { DeleteLockerDialog } from "./DeleteLockerDialog";
import { RentLockerSheet, type RentSheetValue } from "./RentLockerSheet";
import { EndRentalDialog } from "./EndRentalDialog";

/**
 * Schließfächer: Grid aller Fächer mit Status-Badge (frei/belegt/defekt),
 * Standort, Größe, LISTENPREIS und laufender VERMIETUNG. Trainer:innen ordnen
 * zu und geben frei (assign/release), Vereins-Admins pflegen die Stammdaten
 * (anlegen/bearbeiten/löschen) und melden defekt/repariert, Vorstand/Verwaltung/
 * Kassenwart vermieten und beenden Mietverträge (0070). Sichtbarkeit ist
 * Komfort — die verbindliche Durchsetzung bleibt serverseitig (RLS/API/Trigger,
 * 403 → Toast + Rollback).
 *
 * RLS-Verschärfung: Fächer LESEN dürfen nur owner/admin/treasurer (+ Plattform-
 * Admin) oder das eigene, zugeordnete Fach eines Mitglieds. Moderator/Coach
 * sehen KEINE Fächer. VERWALTEN/ZUORDNEN/VERMIETEN ist owner/admin/treasurer
 * vorbehalten. Die Zeilen-Sichtbarkeit erzwingt die RLS serverseitig; hier
 * gaten wir nur die Aktionen und die Ansicht (Verwaltungs- vs. Mitglieds-Sicht).
 *
 * ### WARUM DIE ROLLE JETZT AUCH IM MOCK GILT ###
 * Früher stand hier `|| isMock`, damit alle Schreibpfade in der Demo erreichbar
 * sind. Das hatte einen Preis: die MITGLIEDS-Ansicht („dein Fach, dein Preis")
 * war im mock-Modus überhaupt nicht erreichbar — und genau sie ist die, bei der
 * ein Fehler ein Kind betrifft. Jetzt zählt auch im Mock die Rolle der
 * Betrachter-Persona; die Standard-Persona ist eine Trainerin, über den
 * Demo-Umschalter (lib/data/mock/viewer.ts, localStorage `rsm.mock.viewer`)
 * lässt sich auf Vorstand oder auf ein Mitglied wechseln. Die Mock-Facade
 * kürzt die Daten dazu passend (modules-org.ts).
 */

const NO_LOCKERS: Locker[] = [];
const NO_MEMBERS: Member[] = [];
const NO_RENTALS: LockerRental[] = [];

/** Fächer verwalten/zuordnen/vermieten: owner/admin/treasurer (+ Plattform-Admin). */
const LOCKER_ADMIN_ROLES: readonly MemberRole[] = ["owner", "admin", "treasurer"];

/**
 * Mietverträge sind ein eigenes, jüngeres Modul. Fehlt der Endpunkt (api-Modus
 * ohne 0070), soll die Fächer-Seite trotzdem stehen — ohne Vertragsdaten, aber
 * ohne Fehlerbild. Andere Fehler werden NICHT geschluckt.
 */
async function softNotImplemented<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isNotImplemented(error)) return null;
    throw error;
  }
}

export function LockersScreen() {
  const t = useT(schliessfaecherDict);
  const { locale } = useLocale();

  const state = useData((repo) =>
    Promise.all([
      repo.listLockers(),
      repo.getMembers(),
      repo.getCurrentUser(),
      softNotImplemented(repo.listLockerRentals()),
    ] as const),
  );

  const lockers = state.data?.[0] ?? NO_LOCKERS;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;
  const rentals = state.data?.[3] ?? NO_RENTALS;

  const perms = permissions(currentUser);
  // Verwalten, Zuordnen UND Vermieten: owner/admin/treasurer (+ Plattform-
  // Admin). Moderator und Coach dürfen weder verwalten noch Fächer sehen.
  const canManage =
    (perms.role != null && LOCKER_ADMIN_ROLES.includes(perms.role)) || perms.isPlatformAdmin;
  const canAssign = canManage;
  const canRent = canManage;
  /** Mitglieds-/Nicht-Verwalter-Sicht: nur das eigene Fach (oder keins). */
  const memberView = !canManage;

  const [filter, setFilter] = useState<LockerStatus | "all">("all");
  const [form, setForm] = useState<LockerFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Locker | null>(null);
  const [assignTarget, setAssignTarget] = useState<Locker | null>(null);
  const [rentTarget, setRentTarget] = useState<RentSheetValue | null>(null);
  const [endTarget, setEndTarget] = useState<{ locker: Locker; rental: LockerRental } | null>(null);

  const counts = useMemo(() => {
    const base: Record<LockerStatus, number> = { free: 0, assigned: 0, broken: 0 };
    for (const locker of lockers) base[locker.status] += 1;
    return base;
  }, [lockers]);

  const visible = useMemo(
    () => (filter === "all" ? lockers : lockers.filter((l) => l.status === filter)),
    [lockers, filter],
  );

  /**
   * Monatssumme der laufenden Mieten. Nur für die Verwaltung — in der
   * Mitglieds-Ansicht wäre sie sinnlos (dort ist die Liste ohnehin auf das
   * eigene Fach gekürzt) und in einer Liste von Kindern hat eine
   * Einnahmen-Kennzahl nichts verloren.
   */
  const rentalTotal = useMemo(() => monthlyRentalTotal(rentals), [rentals]);

  const filterOptions: FilterChipOption<LockerStatus | "all">[] = [
    { value: "all", label: t("filterAll"), count: lockers.length },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: t(STATUS_KEY[status]),
      count: counts[status],
    })),
  ];

  const renderCards = (list: Locker[]) => (
    <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((locker) => (
        <LockerCard
          key={locker.id}
          locker={locker}
          rental={activeRentalOf(rentals, locker.id)}
          members={members}
          personalView={memberView}
          canManage={canManage}
          canAssign={canAssign}
          canRent={canRent}
          onAssign={() => setAssignTarget(locker)}
          onReassign={() => setAssignTarget(locker)}
          onEdit={() => setForm({ mode: "edit", locker })}
          onDelete={() => setToDelete(locker)}
          onRent={() => setRentTarget({ mode: "create", locker })}
          onEditRental={(rental) => setRentTarget({ mode: "edit", locker, rental })}
          onEndRental={(rental) => setEndTarget({ locker, rental })}
          onChanged={state.reload}
        />
      ))}
    </ul>
  );

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-9 w-full max-w-2xl rounded-full" />
        <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <SkeletonCard lines={3} />
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
  } else if (lockers.length === 0) {
    body = memberView ? (
      <EmptyState icon="lock" title={t("emptyMemberTitle")} body={t("emptyMemberBody")} />
    ) : (
      <EmptyState
        icon="lock"
        title={t("listEmptyTitle")}
        body={t("listEmptyBody")}
        action={
          <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
            {t("listEmptyCta")}
          </Button>
        }
      />
    );
  } else if (memberView) {
    // Mitglieds-Ansicht: KEIN Filter, keine Kennzahlen, kein Grid-Denken —
    // ein bis zwei Karten, die sagen „das ist dein Fach und das kostet es".
    // Die Miete steht in derselben Karte wie das Fach, weil die Frage „was
    // zahle ich dafür" genau dort entsteht.
    body = renderCards(lockers);
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
          renderCards(visible)
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      <SectionHeader
        level={1}
        title={memberView ? t("pageTitleMember") : t("pageTitle")}
        sub={memberView ? t("pageSubMember") : t("pageSub")}
        action={
          canManage && state.status === "ready" && lockers.length > 0 ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newLocker")}
            </Button>
          ) : undefined
        }
      />

      {/* Einnahmen-Kennzahl der laufenden Mieten. Erscheint nur, wenn es
          überhaupt etwas zu zählen gibt — eine Kachel mit „0,00 €" ist keine
          Information, sondern Lärm. Verträge ohne festgelegten Preis stehen in
          der Caption und werden NICHT als 0 mitsummiert: die Zahl soll stimmen,
          nicht vollständig aussehen. */}
      {!memberView &&
        state.status === "ready" &&
        (rentalTotal.counted > 0 || rentalTotal.withoutPrice > 0) && (
          <KpiTile
            tone="success"
            label={t("kpiRentedTitle")}
            value={t("kpiRentedSum", { sum: formatEUR(rentalTotal.cents, locale) })}
            sub={
              rentalTotal.withoutPrice > 0
                ? `${t("kpiRentedCount", { count: rentalTotal.counted })} · ${t("kpiRentedNoPrice", {
                    count: rentalTotal.withoutPrice,
                  })}`
                : t("kpiRentedCount", { count: rentalTotal.counted })
            }
            className="sm:max-w-sm"
          />
        )}

      {body}

      {assignTarget && (
        <AssignLockerSheet
          key={assignTarget.id}
          locker={assignTarget}
          members={members}
          onClose={() => setAssignTarget(null)}
          onAssigned={state.reload}
        />
      )}

      {form && (
        <LockerFormDialog
          key={form.mode === "edit" ? `edit-${form.locker.id}` : "create"}
          value={form}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}

      {rentTarget && (
        <RentLockerSheet
          key={
            rentTarget.mode === "edit"
              ? `rental-${rentTarget.rental.id}`
              : `rent-${rentTarget.locker.id}`
          }
          value={rentTarget}
          members={members}
          onClose={() => setRentTarget(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteLockerDialog
        locker={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />

      {/* key: frische Startwerte (Enddatum/Art) je geöffnetem Vertrag —
          sonst stünde die Auswahl vom letzten Mal noch drin. */}
      <EndRentalDialog
        key={endTarget ? `end-${endTarget.rental.id}` : "end-none"}
        locker={endTarget?.locker ?? null}
        rental={endTarget?.rental ?? null}
        onClose={() => setEndTarget(null)}
        onEnded={state.reload}
      />
    </div>
  );
}
