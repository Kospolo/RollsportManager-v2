"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Locker, LockerRental, LockerRentalStatus } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { schliessfaecherDict } from "../i18n";
import { todayIso } from "../derive";

const FORM_ID = "end-rental-form";

/**
 * Eine laufende Vermietung BEENDEN (0070) — Status auf „beendet" oder
 * „gekündigt" plus Enddatum.
 *
 * ### WARUM BEENDEN UND NICHT LÖSCHEN ###
 * Ein Vertrag, den es wirklich gab, verschwindet nicht: er bekommt ein Ende.
 * Nur so bleibt später nachvollziehbar, wofür jemand acht Monate lang gezahlt
 * hat. Löschen (deleteLockerRental) ist ausschließlich für versehentlich
 * erfasste Verträge gedacht und liegt deshalb NICHT auf diesem Knopf.
 *
 * ### WARUM DAS FACH DABEI ZUGEORDNET BLEIBT ###
 * „Freigeben" ist eine Schlüssel-Frage, „Miete beenden" eine Geld-Frage. Der
 * Server koppelt beides bewusst nicht (v1-Regel), und diese Oberfläche erfindet
 * die Kopplung auch nicht heimlich — sie SAGT sie stattdessen (endKeepsLocker).
 * Eine stille Automatik hier hieße: jemand beendet die Miete, das Kind hat den
 * Schlüssel noch, und das Fach steht in der Liste als frei.
 *
 * Wird NIE automatisch bestätigt — der Vorgang startet nur über den Klick.
 */
export function EndRentalDialog({
  locker,
  rental,
  onClose,
  onEnded,
}: {
  locker: Locker | null;
  rental: LockerRental | null;
  onClose: () => void;
  onEnded: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { showToast } = useToast();

  const [how, setHow] = useState<Extract<LockerRentalStatus, "beendet" | "gekuendigt">>("beendet");
  const [endDate, setEndDate] = useState(todayIso());
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const open = locker !== null && rental !== null;

  const confirm = async () => {
    if (!open || !rental || !locker || submitting) return;
    if (!endDate) {
      setDateError(t("endDateError"));
      return;
    }
    setSubmitting(true);
    try {
      await data.updateLockerRental(rental.id, { status: how, endOn: endDate });
      showToast(t("endedToast", { label: locker.label }), { tone: "success" });
      onEnded();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenRental") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("endEyebrow")}
      title={locker ? t("endTitle", { label: locker.label }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={submitting}>
            {t("endConfirm")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <p className="text-body text-ink-soft">{t("endBody")}</p>

        {/* Steht bewusst als eigener Kasten da und nicht als Fußnote: es ist
            die eine Sache, die hier regelmäßig missverstanden wird. */}
        <p
          role="note"
          className="rounded-md bg-sunken px-3 py-2 text-caption leading-[18px] text-ink-soft"
        >
          {t("endKeepsLocker")}
        </p>

        <Select
          label={t("endHowLabel")}
          value={how}
          onChange={(event) =>
            setHow(event.target.value as Extract<LockerRentalStatus, "beendet" | "gekuendigt">)
          }
        >
          <option value="beendet">{t("endHowEnded")}</option>
          <option value="gekuendigt">{t("endHowCancelled")}</option>
        </Select>

        <Input
          label={t("endDateLabel")}
          type="date"
          error={dateError}
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value);
            if (dateError) setDateError(undefined);
          }}
        />
      </form>
    </Modal>
  );
}
