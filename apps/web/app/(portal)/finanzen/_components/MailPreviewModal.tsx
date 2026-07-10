"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { fullName, currentUser } from "@/lib/mock";
import type { Invoice, Member } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { useToast } from "@/components/ui/Toast";
import { financeDict } from "../i18n";
import { treasurer } from "../derive";

export type MailStage = 1 | 2 | 3;

/**
 * E-Mail-Vorschau der Mahn-Automatik: „Vor jedem Versand siehst du die
 * E-Mail pro Empfänger." Anrede, Beträge und Fristen kommen aus der
 * konkreten Rechnung — die Stufe bestimmt Betreff und Tonlage.
 */
export function MailPreviewModal({
  open,
  onClose,
  stage,
  onStageChange,
  invoice,
  member,
}: {
  open: boolean;
  onClose: () => void;
  stage: MailStage;
  onStageChange: (stage: MailStage) => void;
  invoice: Invoice;
  member: Member;
}) {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const subjectKey: `mailSubject${MailStage}` = `mailSubject${stage}`;
  const bodyKey: `mailBody${MailStage}` = `mailBody${stage}`;
  const params = {
    name: member.firstName,
    number: invoice.number,
    amount: formatEUR(invoice.amountCents, locale),
    due: formatDateShort(invoice.dueAt, locale),
    sender: fullName(treasurer),
  };

  const stageOptions: FilterChipOption<"1" | "2" | "3">[] = [
    { value: "1", label: t("step1") },
    { value: "2", label: t("step2") },
    { value: "3", label: t("step3") },
  ];

  const fieldRow = (label: string, value: string) => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line py-2">
      <span className="w-16 flex-none text-caption font-bold text-ink-faint">{label}</span>
      <span className="min-w-0 text-[13.5px] text-ink">{value}</span>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("mailEyebrow")}
      title={t(subjectKey, params)}
      maxWidthClass="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("mailClose")}
          </Button>
          <Button
            icon="mail"
            onClick={() =>
              showToast(t("mailTestToast", { email: currentUser.email ?? "" }), {
                tone: "success",
              })
            }
          >
            {t("mailTest")}
          </Button>
        </>
      }
    >
      <FilterChips
        options={stageOptions}
        value={String(stage) as "1" | "2" | "3"}
        onChange={(value) => onStageChange(Number(value) as MailStage)}
        label={t("mailStageLabel")}
        className="mb-3"
      />
      <div className="grid">
        {fieldRow(t("mailFrom"), `${fullName(treasurer)} <${treasurer.email ?? ""}>`)}
        {fieldRow(
          t("mailTo"),
          `${fullName(member)} <${member.email ?? t("mailNoEmail")}>`,
        )}
        {fieldRow(t("mailSubject"), t(subjectKey, params))}
      </div>
      <p className="mt-4 whitespace-pre-line rounded-md bg-sunken p-4 text-[13.5px] leading-relaxed text-ink">
        {t(bodyKey, params)}
      </p>
      <p className="mt-3 text-caption text-ink-faint">{t("mailNote")}</p>
    </Modal>
  );
}
