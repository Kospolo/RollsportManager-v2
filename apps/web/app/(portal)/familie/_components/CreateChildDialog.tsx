"use client";

import { useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateChildInput, GuardianRelation } from "@/lib/data";
import type { ChildCreated } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { familieDict, GUARDIAN_RELATION_OPTIONS } from "../i18n";

const FORM_ID = "create-child-form";

/**
 * Kind (ohne eigenen Zugang) anlegen und direkt mit der eingeloggten Person
 * verknüpfen — Selfservice (guardianMemberId wird bewusst NICHT gesetzt, der
 * Server macht die eingeloggte Person zum Guardian). Nur bei geöffnetem Zustand
 * gemountet → frische Startwerte. Erfolg: Toast + onCreated(result) + schließen;
 * 403 → Klartext-Toast, Dialog bleibt offen (Server ist die Wahrheit).
 */
export function CreateChildDialog({
  onCreated,
  onClose,
}: {
  onCreated: (result: ChildCreated) => void;
  onClose: () => void;
}) {
  const t = useT(familieDict);
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relation, setRelation] = useState<GuardianRelation>("parent");

  const [firstNameError, setFirstNameError] = useState<string | undefined>(undefined);
  const [lastNameError, setLastNameError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst) setFirstNameError(t("fFirstNameError"));
    if (!trimmedLast) setLastNameError(t("fLastNameError"));
    if (!trimmedFirst || !trimmedLast) return;

    const input: CreateChildInput = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      birthDate: birthDate || undefined,
      relation,
    };

    setSubmitting(true);
    try {
      const result = await data.createChild(input);
      showToast(t("createdToast", { name: fullName(result.child) }), { tone: "success" });
      onCreated(result);
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
      eyebrow={t("createEyebrow")}
      title={t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {t("createSubmit")}
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
        <p className="text-caption leading-[18px] text-ink-soft">{t("createLead")}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fFirstName")}
            placeholder={t("fFirstNamePlaceholder")}
            autoComplete="off"
            error={firstNameError}
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              if (firstNameError) setFirstNameError(undefined);
            }}
          />
          <Input
            label={t("fLastName")}
            placeholder={t("fLastNamePlaceholder")}
            autoComplete="off"
            error={lastNameError}
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              if (lastNameError) setLastNameError(undefined);
            }}
          />
        </div>

        <Input
          type="date"
          label={t("fBirthDate")}
          hint={t("fBirthDateHint")}
          autoComplete="off"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
        />

        <Select
          label={t("fRelation")}
          value={relation}
          onChange={(event) => setRelation(event.target.value as GuardianRelation)}
        >
          {GUARDIAN_RELATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  );
}
