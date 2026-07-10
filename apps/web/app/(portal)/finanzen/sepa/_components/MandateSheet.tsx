"use client";

import { useMemo, useState } from "react";
import { ApiError, data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateSepaMandateInput } from "@/lib/data";
import type { Id, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { sepaDict } from "../i18n";

const FORM_ID = "sepa-mandate-form";

function todayISODate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Nur Ziffern, max. vier — die IBAN wird NIE vollständig gehalten. */
function sanitizeLast4(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

/**
 * „SEPA-Mandat erfassen"-Sheet: Mitglied, Mandatsreferenz, letzte vier
 * IBAN-Ziffern (DATENSCHUTZ — nie die volle IBAN), Kontoinhaber und
 * Unterschrifts-Datum. Schreibt über data.createSepaMandate; ein neues Mandat
 * ist immer aktiv (Status wird nicht abgefragt). Erfolg → Toast + onSaved() +
 * schließen; 409 (doppelte Referenz) und 403 bleiben ruhige Klartext-Toasts,
 * das Sheet bleibt offen.
 */
export function MandateSheet({
  clubId,
  members,
  onClose,
  onSaved,
}: {
  clubId: Id;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(sepaDict);
  const { showToast } = useToast();

  const today = useMemo(() => todayISODate(), []);
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [members],
  );

  const [memberId, setMemberId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [ibanLast4, setIbanLast4] = useState("");
  const [holder, setHolder] = useState("");
  const [signedOn, setSignedOn] = useState(today);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const submit = async () => {
    if (submitting) return;
    const next: Record<string, string> = {};
    if (!memberId) next.member = t("errMember");
    if (!reference.trim()) next.reference = t("errReference");
    if (!/^\d{4}$/.test(ibanLast4)) next.iban = t("errIban");
    if (!holder.trim()) next.holder = t("errHolder");
    if (!signedOn || signedOn > today) next.signedOn = t("errSignedOn");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const input: CreateSepaMandateInput = {
      clubId,
      memberId,
      mandateReference: reference.trim(),
      // DATENSCHUTZ: NUR ibanLast4 — nie eine volle IBAN.
      ibanLast4,
      accountHolder: holder.trim(),
      signedOn,
    };

    setSubmitting(true);
    try {
      const created = await data.createSepaMandate(input);
      const member = members.find((m) => m.id === memberId);
      showToast(
        t("createdToast", {
          reference: created.mandateReference,
          name: member ? fullName(member) : created.accountHolder,
        }),
        { tone: "success" },
      );
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setErrors({ reference: t("referenceConflict") });
        showToast(t("referenceConflict"), { tone: "danger" });
      } else {
        showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), {
          tone: "danger",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("sheetEyebrow")}
      title={t("sheetTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {t("create")}
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
        <Select
          label={t("fMember")}
          value={memberId}
          error={errors.member}
          onChange={(event) => {
            setMemberId(event.target.value);
            clearError("member");
          }}
        >
          <option value="" disabled>
            {t("fMemberPlaceholder")}
          </option>
          {sortedMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {fullName(member)}
            </option>
          ))}
        </Select>

        <Input
          label={t("fReference")}
          placeholder={t("fReferencePlaceholder")}
          hint={t("fReferenceHint")}
          autoComplete="off"
          value={reference}
          error={errors.reference}
          onChange={(event) => {
            setReference(event.target.value);
            clearError("reference");
          }}
        />

        <Input
          label={t("fIban")}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("fIbanPlaceholder")}
          hint={t("fIbanHint")}
          maxLength={4}
          className="max-w-[160px] [&_input]:font-mono [&_input]:tabular-nums [&_input]:tracking-[0.3em]"
          value={ibanLast4}
          error={errors.iban}
          onChange={(event) => {
            setIbanLast4(sanitizeLast4(event.target.value));
            clearError("iban");
          }}
        />

        <Input
          label={t("fHolder")}
          placeholder={t("fHolderPlaceholder")}
          autoComplete="off"
          value={holder}
          error={errors.holder}
          onChange={(event) => {
            setHolder(event.target.value);
            clearError("holder");
          }}
        />

        <Input
          label={t("fSignedOn")}
          type="date"
          max={today}
          value={signedOn}
          error={errors.signedOn}
          onChange={(event) => {
            setSignedOn(event.target.value);
            clearError("signedOn");
          }}
        />

        <p className="text-caption text-ink-faint">{t("sheetPrivacy")}</p>
      </form>
    </Sheet>
  );
}
