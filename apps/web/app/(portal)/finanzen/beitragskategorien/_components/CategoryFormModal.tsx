"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type {
  CreateMembershipCategoryInput,
  UpdateMembershipCategoryInput,
} from "@/lib/data";
import type { Id, MembershipCategory, MembershipPeriod } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { beitragskategorienDict } from "../i18n";
import { PERIOD_LABEL_KEY, PERIOD_ORDER, centsToAmountInput, parseAmountToCents } from "../derive";

/**
 * Anlege-/Bearbeiten-Dialog einer Beitragskategorie. `category` gesetzt →
 * Bearbeiten (PATCH nur geänderter Felder), sonst Anlegen. Der Euro-Betrag wird
 * verlustfrei in Integer-Cent geparst. Schreibt über die Facade; onSaved lädt
 * den Screen neu. 403 → sauberer Toast (die echte Durchsetzung ist serverseitig).
 */
export function CategoryFormModal({
  clubId,
  category,
  onClose,
  onSaved,
}: {
  clubId: Id;
  category: MembershipCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(beitragskategorienDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const isEdit = category !== null;

  const [name, setName] = useState(category?.name ?? "");
  const [amount, setAmount] = useState(
    category ? centsToAmountInput(category.amountCents, locale) : "",
  );
  const [period, setPeriod] = useState<MembershipPeriod>(category?.period ?? "monthly");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [nameError, setNameError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const trimmedName = name.trim();
    const amountCents = parseAmountToCents(amount);
    let ok = true;
    if (!trimmedName) {
      setNameError(t("catNameError"));
      ok = false;
    }
    if (amountCents === null) {
      setAmountError(t("catAmountError"));
      ok = false;
    }
    if (!ok || amountCents === null) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        const patch: UpdateMembershipCategoryInput = {
          name: trimmedName,
          amountCents,
          period,
          isActive,
        };
        const saved = await data.updateMembershipCategory(category.id, patch);
        showToast(t("catUpdatedToast", { name: saved.name }), { tone: "success" });
      } else {
        const input: CreateMembershipCategoryInput = {
          clubId,
          name: trimmedName,
          amountCents,
          period,
          isActive,
        };
        const created = await data.createMembershipCategory(input);
        showToast(t("catCreatedToast", { name: created.name }), { tone: "success" });
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
      onClose={submitting ? () => {} : onClose}
      eyebrow={t("catFormEyebrow")}
      title={isEdit ? t("catEditTitle") : t("catCreateTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="category-form" icon="check" disabled={submitting}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("catNameLabel")}
          placeholder={t("catNamePlaceholder")}
          value={name}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("catAmountLabel")}
            hint={t("catAmountHint")}
            error={amountError}
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              if (amountError) setAmountError(undefined);
            }}
          />
          <Select
            label={t("catPeriodLabel")}
            value={period}
            onChange={(event) => setPeriod(event.target.value as MembershipPeriod)}
          >
            {PERIOD_ORDER.map((p) => (
              <option key={p} value={p}>
                {t(PERIOD_LABEL_KEY[p])}
              </option>
            ))}
          </Select>
        </div>
        <Switch checked={isActive} onChange={setIsActive} label={t("catActiveLabel")} />
      </form>
    </Modal>
  );
}
