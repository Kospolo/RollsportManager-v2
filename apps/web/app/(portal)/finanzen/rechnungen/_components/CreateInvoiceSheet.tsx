"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Id, InvoiceDetail, Member } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { invoicesDict } from "../i18n";
import { parseEuroToCents } from "../derive";

/**
 * „Rechnung erstellen" — Sheet mit Formular (Mitglied, Zweck, Betrag,
 * Fälligkeit) über die Facade (createInvoice). Der Schalter „Sofort offen
 * stellen" entscheidet zwischen Status „Offen" (versandbereit) und „Entwurf".
 * Rechte sind serverseitig (can_manage_finance) — ein 403 wird als Toast
 * behandelt, nicht als Absturz.
 */
export function CreateInvoiceSheet({
  open,
  onClose,
  clubId,
  members,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clubId: Id;
  members: Member[];
  /** Neue Rechnung — wird oben in die Liste übernommen. */
  onCreated: (invoice: InvoiceDetail) => void;
}) {
  const t = useT(invoicesDict);
  const { showToast } = useToast();

  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [issue, setIssue] = useState(true);
  const [errors, setErrors] = useState<{ member?: string; title?: string; amount?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName, "de") ||
          a.firstName.localeCompare(b.firstName, "de"),
      ),
    [members],
  );

  const reset = () => {
    setMemberId("");
    setTitle("");
    setAmount("");
    setDueOn("");
    setIssue(true);
    setErrors({});
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (submitting) return;
    const amountCents = parseEuroToCents(amount);
    const nextErrors: typeof errors = {};
    if (!memberId) nextErrors.member = t("cMemberError");
    if (!title.trim()) nextErrors.title = t("cTitleError");
    if (amountCents === null || amountCents <= 0) nextErrors.amount = t("cAmountError");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    try {
      const invoice = await data.createInvoice({
        clubId,
        memberId,
        title: title.trim(),
        amountCents: amountCents as number,
        dueOn: dueOn || undefined,
        issue,
      });
      onCreated(invoice);
      showToast(
        t(issue ? "createToastOpen" : "createToastDraft", { number: invoice.number }),
        { tone: "success" },
      );
      close();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow={t("createEyebrow")}
      title={t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("cCancel")}
          </Button>
          <Button icon="plus" onClick={submit} disabled={submitting}>
            {t("cSubmit")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Select
          label={t("cMember")}
          value={memberId}
          error={errors.member}
          onChange={(event) => {
            setMemberId(event.target.value);
            if (errors.member) setErrors((e) => ({ ...e, member: undefined }));
          }}
        >
          <option value="" disabled>
            {t("cMemberPlaceholder")}
          </option>
          {sortedMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {fullName(member)}
            </option>
          ))}
        </Select>

        <Input
          label={t("cTitle")}
          placeholder={t("cTitlePlaceholder")}
          value={title}
          error={errors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
          }}
        />

        <Input
          label={t("cAmount")}
          inputMode="decimal"
          placeholder={t("cAmountPlaceholder")}
          hint={t("cAmountHint")}
          error={errors.amount}
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
          }}
        />

        <Input
          label={t("cDue")}
          type="date"
          hint={t("cDueHint")}
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
        />

        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("cIssueLabel")}</span>
          <Switch
            checked={issue}
            onChange={setIssue}
            label={t("cIssueLabel")}
            words={{ on: t("cIssueOn"), off: t("cIssueOff") }}
          />
          <p className="text-caption text-ink-faint">{t("cIssueHint")}</p>
        </div>

        {/* Enter im Formular löst „Anlegen" aus */}
        <button type="submit" className="sr-only">
          {t("cSubmit")}
        </button>
      </form>
    </Sheet>
  );
}
