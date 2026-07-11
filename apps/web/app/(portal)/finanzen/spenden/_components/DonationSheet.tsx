"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateDonationInput } from "@/lib/data";
import type { Id, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { spendenDict } from "../i18n";
import { parseAmountCents, todayISODate } from "../derive";

const FORM_ID = "donation-form";

/**
 * „Spende erfassen"-Sheet: optionale Mitglieds-Verknüpfung (leer = anonym),
 * Spendername, Anschrift, Betrag (Euro → Cents), Spendendatum und Zweck.
 * Schreibt über data.createDonation — die Beleg-Nr. (SP-JJJJ-NNNN) vergibt der
 * Server race-frei, NIE der Client. Die Spende ist zunächst Entwurf und wird
 * erst später ausgestellt. Erfolg → Toast (mit Beleg-Nr.) + onSaved() +
 * schließen; 403 bleibt ein ruhiger Klartext-Toast, das Sheet bleibt offen.
 */
export function DonationSheet({
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
  const t = useT(spendenDict);
  const { showToast } = useToast();

  const today = useMemo(() => todayISODate(), []);
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [members],
  );

  const [memberId, setMemberId] = useState<string>("");
  const [donorName, setDonorName] = useState("");
  const [donorAddress, setDonorAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [donationDate, setDonationDate] = useState(today);
  const [purpose, setPurpose] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  // Mitglied wählen füllt den Spendernamen vor, solange das Feld leer ist —
  // freie Eingabe (z. B. abweichender Name) bleibt jederzeit möglich.
  const onMemberChange = (value: string) => {
    setMemberId(value);
    if (value && !donorName.trim()) {
      const member = members.find((m) => m.id === value);
      if (member) setDonorName(fullName(member));
    }
  };

  const submit = async () => {
    if (submitting) return;
    const cents = parseAmountCents(amount);
    const next: Record<string, string> = {};
    if (!donorName.trim()) next.donor = t("errDonor");
    if (cents === null) next.amount = t("errAmount");
    if (!donationDate || donationDate > today) next.date = t("errDate");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const input: CreateDonationInput = {
      clubId,
      // leer = anonyme Spende (memberId weglassen)
      memberId: memberId || undefined,
      donorName: donorName.trim(),
      donorAddress: donorAddress.trim() || undefined,
      amountCents: cents!,
      donationDate,
      purpose: purpose.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const created = await data.createDonation(input);
      showToast(t("createdToast", { number: created.receiptNumber }), { tone: "success" });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
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
          hint={t("fMemberHint")}
          value={memberId}
          onChange={(event) => onMemberChange(event.target.value)}
        >
          <option value="">{t("fMemberAnon")}</option>
          {sortedMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {fullName(member)}
            </option>
          ))}
        </Select>

        <Input
          label={t("fDonor")}
          placeholder={t("fDonorPlaceholder")}
          autoComplete="off"
          value={donorName}
          error={errors.donor}
          onChange={(event) => {
            setDonorName(event.target.value);
            clearError("donor");
          }}
        />

        <Textarea
          label={t("fAddress")}
          placeholder={t("fAddressPlaceholder")}
          hint={t("fAddressHint")}
          rows={2}
          value={donorAddress}
          onChange={(event) => setDonorAddress(event.target.value)}
        />

        <Input
          label={t("fAmount")}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          hint={t("fAmountHint")}
          className="max-w-[220px] [&_input]:font-mono [&_input]:tabular-nums"
          value={amount}
          error={errors.amount}
          onChange={(event) => {
            setAmount(event.target.value);
            clearError("amount");
          }}
        />

        <Input
          label={t("fDate")}
          type="date"
          max={today}
          value={donationDate}
          error={errors.date}
          onChange={(event) => {
            setDonationDate(event.target.value);
            clearError("date");
          }}
        />

        <Input
          label={t("fPurpose")}
          placeholder={t("fPurposePlaceholder")}
          hint={t("fPurposeHint")}
          autoComplete="off"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        />

        <p className="text-caption text-ink-faint">{t("sheetGobd")}</p>
      </form>
    </Sheet>
  );
}
