"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Equipment, EquipmentReservation, ReservationStatus } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  ausruestungDict,
  RES_STATUS_KEY,
  RES_STATUS_TONE,
  RES_STATUS_WEIGHT,
} from "../i18n";

/**
 * „Meine Reservierungen": die Ausleihen des angemeldeten Mitglieds — aktiv
 * zuerst, danach zurückgegeben/storniert. Aktive Reservierungen lassen sich
 * zurückgeben oder stornieren (data.updateReservation, Ersteller ODER Trainer).
 * Bei Erfolg lädt der Screen neu (onChanged); ein 403/Fehler kommt als Toast,
 * der Stand bleibt unverändert (Rollback).
 */
export function MyReservations({
  reservations,
  equipment,
  onChanged,
}: {
  /** bereits auf das eigene Mitglied gefiltert */
  reservations: EquipmentReservation[];
  equipment: Equipment[];
  onChanged: () => void;
}) {
  const t = useT(ausruestungDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map(equipment.map((e) => [e.id, e.name]));
    return (equipmentId: string) => map.get(equipmentId) ?? t("unknownEquipment");
  }, [equipment, t]);

  const sorted = useMemo(
    () =>
      [...reservations].sort((a, b) => {
        const byStatus = RES_STATUS_WEIGHT[a.status] - RES_STATUS_WEIGHT[b.status];
        return byStatus !== 0 ? byStatus : b.fromAt.localeCompare(a.fromAt);
      }),
    [reservations],
  );

  const setStatus = async (
    reservation: EquipmentReservation,
    status: ReservationStatus,
    toastKey: "returnedToast" | "cancelledToast",
  ) => {
    if (busyId) return;
    setBusyId(reservation.id);
    try {
      await data.updateReservation(reservation.id, { status });
      showToast(t(toastKey, { name: nameOf(reservation.equipmentId) }), { tone: "success" });
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("reserveForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="grid gap-3">
      <SectionHeader level={2} title={t("myResTitle")} sub={t("myResSub")} />
      {sorted.length === 0 ? (
        <EmptyState icon="sparkle" title={t("myResEmptyTitle")} body={t("myResEmptyBody")} />
      ) : (
        <ul className="grid list-none gap-3">
          {sorted.map((reservation) => {
            const isActive = reservation.status === "active";
            const busy = busyId === reservation.id;
            return (
              <li
                key={reservation.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 shadow-card"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                      {nameOf(reservation.equipmentId)}
                    </span>
                    <Badge tone={RES_STATUS_TONE[reservation.status]}>
                      {t(RES_STATUS_KEY[reservation.status])}
                    </Badge>
                  </div>
                  <span className="text-caption text-ink-soft">
                    {reservation.quantity !== undefined && (
                      <>
                        <span className="font-mono tabular-nums text-ink">
                          {t("resQuantity", { n: reservation.quantity })}
                        </span>
                        {" · "}
                      </>
                    )}
                    {t("resPeriod", {
                      from: formatDateTime(reservation.fromAt, locale),
                      to: formatDateTime(reservation.toAt, locale),
                    })}
                  </span>
                </div>

                {isActive && (
                  <div className="flex flex-none flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setStatus(reservation, "returned", "returnedToast")}
                    >
                      {t("resReturn")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setStatus(reservation, "cancelled", "cancelledToast")}
                    >
                      {t("resCancel")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
