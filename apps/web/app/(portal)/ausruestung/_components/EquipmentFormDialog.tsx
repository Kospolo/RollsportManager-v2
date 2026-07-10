"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateEquipmentInput, UpdateEquipmentInput } from "@/lib/data";
import type { Equipment, EquipmentCondition } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ausruestungDict, CONDITION_KEY, CONDITION_ORDER } from "../i18n";

/**
 * Anlegen ODER Bearbeiten eines Ausrüstungsgegenstands über die Facade
 * (data.*Equipment). Nur bei geöffnetem Zustand gemountet → frische useState-
 * Startwerte je Öffnung. „Davon verfügbar" darf den Gesamtbestand nicht
 * übersteigen; leer beim Anlegen = alles verfügbar (Facade-Default = Gesamt).
 * Erfolg: Toast + onSaved() + schließen; 403 → Klartext-Toast, Dialog bleibt offen.
 */
export type EquipmentFormValue = { mode: "create" } | { mode: "edit"; equipment: Equipment };

const numOrEmpty = (n: number | undefined): string => (n !== undefined ? String(n) : "");

export function EquipmentFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: EquipmentFormValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(ausruestungDict);
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.equipment : undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [condition, setCondition] = useState<EquipmentCondition>(initial?.condition ?? "good");
  const [total, setTotal] = useState(numOrEmpty(initial?.totalQuantity));
  const [available, setAvailable] = useState(numOrEmpty(initial?.availableQuantity));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [totalError, setTotalError] = useState<string | undefined>(undefined);
  const [availableError, setAvailableError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  /** "" → undefined; sonst geparste, nicht-negative ganze Zahl oder null (=ungültig). */
  const parseQty = (raw: string): number | null | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  };

  const submit = async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    let ok = true;
    if (!trimmedName) {
      setNameError(t("fNameError"));
      ok = false;
    }

    const totalQty = parseQty(total);
    if (totalQty === null) {
      setTotalError(t("fTotalError"));
      ok = false;
    }
    const availableQty = parseQty(available);
    if (availableQty === null) {
      setAvailableError(t("fAvailableError"));
      ok = false;
    } else if (
      availableQty !== undefined &&
      totalQty !== undefined &&
      totalQty !== null &&
      availableQty > totalQty
    ) {
      setAvailableError(t("fAvailableError"));
      ok = false;
    }
    if (!ok) return;

    const trimmedCategory = category.trim();
    const trimmedNotes = notes.trim();

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateEquipmentInput = {
          name: trimmedName,
          category: trimmedCategory || undefined,
          condition,
          totalQuantity: totalQty ?? undefined,
          availableQuantity: availableQty ?? undefined,
          notes: trimmedNotes || undefined,
        };
        const created = await data.createEquipment(input);
        showToast(t("createdToast", { name: created.name }), { tone: "success" });
      } else {
        const patch: UpdateEquipmentInput = {
          name: trimmedName,
          category: trimmedCategory || null,
          condition,
          totalQuantity: totalQty ?? undefined,
          availableQuantity: availableQty ?? undefined,
          notes: trimmedNotes || null,
        };
        const updated = await data.updateEquipment(value.equipment.id, patch);
        showToast(t("updatedToast", { name: updated.name }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
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
          <Input
            label={t("fCategory")}
            placeholder={t("fCategoryPlaceholder")}
            autoComplete="off"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />

          <Select
            label={t("fCondition")}
            value={condition}
            onChange={(event) => setCondition(event.target.value as EquipmentCondition)}
          >
            {CONDITION_ORDER.map((cond) => (
              <option key={cond} value={cond}>
                {t(CONDITION_KEY[cond])}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fTotal")}
            hint={t("fTotalHint")}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            autoComplete="off"
            error={totalError}
            value={total}
            onChange={(event) => {
              setTotal(event.target.value);
              if (totalError) setTotalError(undefined);
            }}
          />
          <Input
            label={t("fAvailable")}
            hint={t("fAvailableHint")}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            autoComplete="off"
            error={availableError}
            value={available}
            onChange={(event) => {
              setAvailable(event.target.value);
              if (availableError) setAvailableError(undefined);
            }}
          />
        </div>

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
