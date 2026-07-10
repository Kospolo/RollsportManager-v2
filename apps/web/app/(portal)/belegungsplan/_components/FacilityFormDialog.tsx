"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateFacilityInput, UpdateFacilityInput } from "@/lib/data";
import type { Facility, FacilityKind } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { belegungsplanDict } from "../i18n";
import { KIND_LABEL_KEY, KIND_ORDER } from "../helpers";

/**
 * Anlegen ODER Bearbeiten einer Halle über die Facade (data.*Facility). Nur
 * für Trainer:innen (is_club_trainer) — die Sichtbarkeit ist Komfort, die
 * Wahrheit bleibt serverseitig (RLS/API). Erfolg: Toast + onSaved() (Reload) +
 * schließen. Fehler: Toast (403 → Klartext „nur Trainer:innen"), Dialog bleibt
 * für einen erneuten Versuch offen.
 */
export type FacilityFormValue = { mode: "create" } | { mode: "edit"; facility: Facility };

export function FacilityFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: FacilityFormValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(belegungsplanDict);
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.facility : undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<FacilityKind>(initial?.kind ?? "hall");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [capacity, setCapacity] = useState(
    initial?.capacity !== undefined ? String(initial.capacity) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [capacityError, setCapacityError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();
    const trimmedCapacity = capacity.trim();
    let ok = true;

    if (!trimmedName) {
      setNameError(t("fNameError"));
      ok = false;
    }
    let capacityValue: number | undefined;
    if (trimmedCapacity) {
      const parsed = Number(trimmedCapacity);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setCapacityError(t("fCapacityError"));
        ok = false;
      } else {
        capacityValue = Math.round(parsed);
      }
    }
    if (!ok) return;

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateFacilityInput = {
          name: trimmedName,
          kind,
          address: trimmedAddress || undefined,
          capacity: capacityValue,
          notes: trimmedNotes || undefined,
        };
        const created = await data.createFacility(input);
        showToast(t("facilityCreatedToast", { name: created.name }), { tone: "success" });
      } else {
        const patch: UpdateFacilityInput = {
          name: trimmedName,
          kind,
          address: trimmedAddress || null,
          capacity: capacityValue ?? null,
          notes: trimmedNotes || null,
        };
        const updated = await data.updateFacility(value.facility.id, patch);
        showToast(t("facilityUpdatedToast", { name: updated.name }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenFacility") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={isEdit ? t("editEyebrow") : t("createEyebrow")}
      title={isEdit ? t("editTitle") : t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="check" onClick={submit} disabled={submitting}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("fName")}
          placeholder={t("fNamePlaceholder")}
          autoComplete="off"
          error={nameError}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("fKind")}
            value={kind}
            onChange={(event) => setKind(event.target.value as FacilityKind)}
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {t(KIND_LABEL_KEY[k])}
              </option>
            ))}
          </Select>

          <Input
            label={t("fCapacity")}
            hint={t("fCapacityHint")}
            type="number"
            min={1}
            inputMode="numeric"
            autoComplete="off"
            error={capacityError}
            value={capacity}
            onChange={(event) => {
              setCapacity(event.target.value);
              if (capacityError) setCapacityError(undefined);
            }}
          />
        </div>

        <Input
          label={t("fAddress")}
          placeholder={t("fAddressPlaceholder")}
          autoComplete="off"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />

        <Textarea
          label={t("fNotes")}
          placeholder={t("fNotesPlaceholder")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Modal>
  );
}
