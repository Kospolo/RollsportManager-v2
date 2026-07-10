"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateReservationInput } from "@/lib/data";
import type { Equipment, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ausruestungDict, availableCap, defaultReserveRange } from "../i18n";

const FORM_ID = "reserve-form";

/**
 * „Reservieren"-Sheet: Menge + Zeitraum (von/bis) für einen Gegenstand über die
 * Facade (data.createReservation). Selbst-Service: Nicht-Trainer:innen buchen FEST
 * auf ihr eigenes Mitglied (reservedByMemberId), nur Trainer:innen dürfen ein
 * Mitglied wählen. Die verfügbare Menge wird als Obergrenze geprüft (Bestand nicht
 * DB-erzwungen). Erfolg: Toast + onReserved() + schließen; 403 → Klartext-Toast.
 */
export function ReserveSheet({
  equipment,
  members,
  currentUser,
  canSelectMember,
  onClose,
  onReserved,
}: {
  equipment: Equipment;
  members: Member[];
  currentUser: Member;
  /** Trainer:innen dürfen für ein Mitglied reservieren; sonst fest auf sich selbst. */
  canSelectMember: boolean;
  onClose: () => void;
  onReserved: () => void;
}) {
  const t = useT(ausruestungDict);
  const { showToast } = useToast();

  const cap = availableCap(equipment);
  const range = useMemo(() => defaultReserveRange(), []);

  const selectable = useMemo(
    () =>
      [...members]
        .filter((m) => m.status === "active")
        .sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  const [memberId, setMemberId] = useState(currentUser.id);
  const [quantity, setQuantity] = useState("1");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const [quantityError, setQuantityError] = useState<string | undefined>(undefined);
  const [rangeError, setRangeError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    let ok = true;
    const parsedQty = Number(quantity.trim());
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      setQuantityError(t("errQuantityMin"));
      ok = false;
    } else if (cap !== undefined && parsedQty > cap) {
      setQuantityError(t("errQuantityMax", { n: cap }));
      ok = false;
    }
    if (!from || !to || new Date(to).getTime() <= new Date(from).getTime()) {
      setRangeError(t("errRange"));
      ok = false;
    }
    if (!ok) return;

    const input: CreateReservationInput = {
      equipmentId: equipment.id,
      reservedByMemberId: canSelectMember ? memberId : currentUser.id,
      quantity: Math.round(parsedQty),
      fromAt: new Date(from).toISOString(),
      toAt: new Date(to).toISOString(),
    };

    setSubmitting(true);
    try {
      await data.createReservation(input);
      showToast(t("reservedToast", { name: equipment.name }), { tone: "success" });
      onReserved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("reserveForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("reserveEyebrow")}
      title={t("reserveTitle", { name: equipment.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {t("reserveSubmit")}
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
          void submit();
        }}
      >
        {canSelectMember ? (
          <Select
            label={t("fMember")}
            hint={t("fMemberHint")}
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
          >
            {selectable.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)}
              </option>
            ))}
          </Select>
        ) : (
          <p className="rounded-md bg-sunken px-3 py-2 text-caption leading-[18px] text-ink-soft">
            {t("forMemberFixed", { name: fullName(currentUser) })}
          </p>
        )}

        <Input
          label={t("fQuantity")}
          type="number"
          min={1}
          max={cap ?? undefined}
          step={1}
          inputMode="numeric"
          autoComplete="off"
          hint={cap === undefined ? t("fQuantityUnknownHint") : t("fQuantityHint", { n: cap })}
          error={quantityError}
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            if (quantityError) setQuantityError(undefined);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fFrom")}
            type="datetime-local"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              if (rangeError) setRangeError(undefined);
            }}
          />
          <Input
            label={t("fTo")}
            type="datetime-local"
            error={rangeError}
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              if (rangeError) setRangeError(undefined);
            }}
          />
        </div>
      </form>
    </Sheet>
  );
}
