"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/lib/data";
import type { Department, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { abteilungenDict } from "../i18n";

/**
 * Anlegen ODER Bearbeiten einer Abteilung über die Facade (data.*Department).
 * Nur bei geöffnetem Zustand gemountet → frische useState-Startwerte je Öffnung.
 * Leitung ist optional (Select mit „— keine —"); Reihenfolge ist eine ganze Zahl
 * ab 0. Erfolg: Toast + onSaved() + schließen; 403 → Klartext-Toast, Dialog offen.
 */
export type DepartmentFormValue = { mode: "create" } | { mode: "edit"; department: Department };

export function DepartmentFormDialog({
  value,
  members,
  onClose,
  onSaved,
}: {
  value: DepartmentFormValue;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(abteilungenDict);
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.department : undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [leadMemberId, setLeadMemberId] = useState(initial?.leadMemberId ?? "");
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder !== undefined ? String(initial.sortOrder) : "",
  );

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [sortError, setSortError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  /** "" → undefined; sonst geparste, nicht-negative ganze Zahl oder null (=ungültig). */
  const parseSort = (raw: string): number | null | undefined => {
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
    const sort = parseSort(sortOrder);
    if (sort === null) {
      setSortError(t("fSortOrderError"));
      ok = false;
    }
    if (!ok) return;

    const trimmedDescription = description.trim();
    const lead = leadMemberId || undefined;

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateDepartmentInput = {
          name: trimmedName,
          description: trimmedDescription || undefined,
          leadMemberId: lead,
          sortOrder: sort ?? undefined,
        };
        const created = await data.createDepartment(input);
        showToast(t("createdToast", { name: created.name }), { tone: "success" });
      } else {
        const patch: UpdateDepartmentInput = {
          name: trimmedName,
          description: trimmedDescription || null,
          leadMemberId: lead ?? null,
          sortOrder: sort ?? undefined,
        };
        const updated = await data.updateDepartment(value.department.id, patch);
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

        <Textarea
          label={t("fDescription")}
          placeholder={t("fDescriptionPlaceholder")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("fLead")}
            hint={t("fLeadHint")}
            value={leadMemberId}
            onChange={(event) => setLeadMemberId(event.target.value)}
          >
            <option value="">{t("leadNone")}</option>
            {sortedMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)}
              </option>
            ))}
          </Select>

          <Input
            label={t("fSortOrder")}
            hint={t("fSortOrderHint")}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            autoComplete="off"
            error={sortError}
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              if (sortError) setSortError(undefined);
            }}
          />
        </div>

        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Modal>
  );
}
