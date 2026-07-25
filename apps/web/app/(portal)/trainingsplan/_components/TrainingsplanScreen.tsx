"use client";

import { useMemo, useState } from "react";
import type { Facility, Member, Team, TrainingSlot } from "@/lib/types";
import { errorMessage, fullName, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { trainingsplanDict } from "../i18n";
import { groupByWeekday, type SlotLookups } from "../helpers";
import { WeekGrid } from "./WeekGrid";
import { SlotList } from "./SlotList";
import { SlotFormDialog, type SlotFormValue } from "./SlotFormDialog";
import { DeleteSlotDialog } from "./DeleteSlotDialog";

/**
 * Trainingsplan-Screen: Wochenraster Mo–So (Karten je Slot, gruppiert nach
 * Wochentag) mit Umschalter Wochenraster/Liste. Wer training_slots auf Stufe
 * „edit" hat (Trainer:innen, Vorstand, Admin …), legt Trainingszeiten an,
 * bearbeitet und löscht sie (data.*TrainingSlot). Ein normales Mitglied
 * (read_all) sieht ausschließlich die Lese-Ansicht — die Schreib-Controls
 * fehlen komplett.
 *
 * ### Das Gating ###
 * Über useCapabilities().hasCap("training_slots", "edit"), NICHT über die alte
 * permissions()-Attrappe: die Rechte werden serverseitig live am Betrachter
 * aufgelöst (GET /me/capabilities), wirken also auch im mock-Modus korrekt.
 * Die Sichtbarkeit ist Komfort — die Durchsetzung bleibt serverseitig (RLS/API,
 * 403 → Toast + kein optimistisches Update). Nach jedem Schreiben lädt der
 * Screen neu.
 *
 * Teams/Hallen sind Anreicherung — fehlt der Endpoint (api), entfallen die
 * Namen still (isNotImplemented → leer), der Plan bleibt sichtbar.
 */

type ViewMode = "grid" | "list";

const NO_SLOTS: TrainingSlot[] = [];
const NO_TEAMS: Team[] = [];
const NO_FACILITIES: Facility[] = [];
const NO_MEMBERS: Member[] = [];

export function TrainingsplanScreen() {
  const t = useT(trainingsplanDict);
  const { hasCap } = useCapabilities();

  const state = useData(async (repo) => {
    const [slots, members] = await Promise.all([
      repo.listTrainingSlots(),
      repo.getMembers(),
    ]);
    // Teams & Hallen sind im api-Modus evtl. nicht lesbar → Namen entfallen still.
    let teams: Team[] = [];
    let facilities: Facility[] = [];
    try {
      teams = await repo.getTeams();
    } catch (error) {
      if (!isNotImplemented(error)) throw error;
    }
    try {
      facilities = await repo.listFacilities();
    } catch (error) {
      if (!isNotImplemented(error)) throw error;
    }
    return { slots, members, teams, facilities };
  });

  const slots = state.data?.slots ?? NO_SLOTS;
  const teams = state.data?.teams ?? NO_TEAMS;
  const facilities = state.data?.facilities ?? NO_FACILITIES;
  const members = state.data?.members ?? NO_MEMBERS;

  // Schreib-/Admin-Controls (Anlegen/Bearbeiten/Löschen) nur ab Stufe „edit".
  // Ein normales Mitglied (read_all) fällt hier auf false → reine Lese-Ansicht.
  const canManage = hasCap("training_slots", "edit");

  const [view, setView] = useState<ViewMode>("grid");
  const [slotForm, setSlotForm] = useState<SlotFormValue | null>(null);
  const [toDelete, setToDelete] = useState<TrainingSlot | null>(null);

  const lookups: SlotLookups = useMemo(
    () => ({
      teamNames: new Map(teams.map((team) => [team.id, team.name])),
      facilityNames: new Map(facilities.map((facility) => [facility.id, facility.name])),
      memberNames: new Map(members.map((member) => [member.id, fullName(member)])),
    }),
    [teams, facilities, members],
  );

  const gridGroups = useMemo(() => groupByWeekday(slots, true), [slots]);
  const listGroups = useMemo(() => groupByWeekday(slots, false), [slots]);

  const headerActions =
    canManage && state.status === "ready" && slots.length > 0 ? (
      <Button icon="plus" onClick={() => setSlotForm({ mode: "create" })}>
        {t("newSlot")}
      </Button>
    ) : undefined;

  const viewTabs = [
    { value: "grid" as const, label: t("viewGrid") },
    { value: "list" as const, label: t("viewList") },
  ];

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-9 w-48 rounded-full" />
        <ul className="grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
  } else if (slots.length === 0) {
    body = (
      <EmptyState
        icon="clock"
        title={t("listEmptyTitle")}
        body={canManage ? t("listEmptyBodyTrainer") : t("listEmptyBodyMember")}
        action={
          canManage ? (
            <Button icon="plus" onClick={() => setSlotForm({ mode: "create" })}>
              {t("listEmptyCta")}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div className="grid gap-5">
        <Tabs tabs={viewTabs} value={view} onChange={setView} label={t("viewLabel")} />
        {view === "grid" ? (
          <WeekGrid
            groups={gridGroups}
            lookups={lookups}
            canManage={canManage}
            onEdit={(slot) => setSlotForm({ mode: "edit", slot })}
            onDelete={setToDelete}
          />
        ) : (
          <SlotList
            groups={listGroups}
            lookups={lookups}
            canManage={canManage}
            onEdit={(slot) => setSlotForm({ mode: "edit", slot })}
            onDelete={setToDelete}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader level={1} title={t("pageTitle")} sub={t("pageSub")} action={headerActions} />

      {body}

      {/* Die Schreib-Dialoge sind nur über Controls erreichbar, die bereits an
          canManage hängen — der zusätzliche Gate hält sie auch dann geschlossen,
          falls doch einmal State gesetzt würde (fail-closed). */}
      {canManage && slotForm && (
        <SlotFormDialog
          key={slotForm.mode === "edit" ? `edit-${slotForm.slot.id}` : "create"}
          value={slotForm}
          teams={teams}
          facilities={facilities}
          members={members}
          onClose={() => setSlotForm(null)}
          onSaved={state.reload}
        />
      )}

      {canManage && (
        <DeleteSlotDialog
          slot={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={state.reload}
        />
      )}
    </div>
  );
}
