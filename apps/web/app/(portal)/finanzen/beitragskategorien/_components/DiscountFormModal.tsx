"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateFamilyDiscountInput, UpdateFamilyDiscountInput } from "@/lib/data";
import type { FamilyDiscount, FamilyDiscountKind, Id } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { beitragskategorienDict } from "../i18n";
import { centsToAmountInput, parseAmountToCents, parsePercent } from "../derive";

/**
 * Anlege-/Bearbeiten-Dialog eines Familienrabatts. Die Art (Prozent/Festbetrag)
 * steuert Label, Hinweis und Parsing des Wertfelds: percent → 0..100, fixed →
 * Integer-Cent aus einer Euro-Eingabe. `discount` gesetzt → Bearbeiten. Schreibt
 * über die Facade; onSaved lädt neu. 403 → sauberer Toast (Durchsetzung serverseitig).
 */
export function DiscountFormModal({
  clubId,
  discount,
  onClose,
  onSaved,
}: {
  clubId: Id;
  discount: FamilyDiscount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(beitragskategorienDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const isEdit = discount !== null;

  const [label, setLabel] = useState(discount?.label ?? "");
  const [kind, setKind] = useState<FamilyDiscountKind>(discount?.kind ?? "percent");
  const [value, setValue] = useState(() => initialValue(discount, locale));
  const [fromChild, setFromChild] = useState(String(discount?.appliesFromChild ?? 2));
  const [isActive, setIsActive] = useState(discount?.isActive ?? true);
  const [labelError, setLabelError] = useState<string | undefined>();
  const [valueError, setValueError] = useState<string | undefined>();
  const [fromChildError, setFromChildError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const parseValue = (): number | null => {
    if (kind === "percent") {
      const percent = parsePercent(value);
      if (percent === null) {
        setValueError(t("discValueError"));
        return null;
      }
      if (percent < 0 || percent > 100) {
        setValueError(t("discValueRangeError"));
        return null;
      }
      return percent;
    }
    const cents = parseAmountToCents(value);
    if (cents === null) {
      setValueError(t("discValueError"));
      return null;
    }
    return cents;
  };

  const submit = async () => {
    if (submitting) return;
    const trimmedLabel = label.trim();
    const fromChildNum = Number.parseInt(fromChild, 10);
    const valueNumeric = parseValue();
    let ok = valueNumeric !== null;
    if (!trimmedLabel) {
      setLabelError(t("discLabelError"));
      ok = false;
    }
    if (!Number.isInteger(fromChildNum) || fromChildNum < 1) {
      setFromChildError(t("discFromChildError"));
      ok = false;
    }
    if (!ok || valueNumeric === null) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        const patch: UpdateFamilyDiscountInput = {
          label: trimmedLabel,
          kind,
          valueNumeric,
          appliesFromChild: fromChildNum,
          isActive,
        };
        const saved = await data.updateFamilyDiscount(discount.id, patch);
        showToast(t("discUpdatedToast", { name: saved.label }), { tone: "success" });
      } else {
        const input: CreateFamilyDiscountInput = {
          clubId,
          label: trimmedLabel,
          kind,
          valueNumeric,
          appliesFromChild: fromChildNum,
          isActive,
        };
        const created = await data.createFamilyDiscount(input);
        showToast(t("discCreatedToast", { name: created.label }), { tone: "success" });
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
      eyebrow={t("discFormEyebrow")}
      title={isEdit ? t("discEditTitle") : t("discCreateTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="discount-form" icon="check" disabled={submitting}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form
        id="discount-form"
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("discLabelLabel")}
          placeholder={t("discLabelPlaceholder")}
          value={label}
          error={labelError}
          onChange={(event) => {
            setLabel(event.target.value);
            if (labelError) setLabelError(undefined);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("discKindLabel")}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as FamilyDiscountKind);
              setValueError(undefined);
            }}
          >
            <option value="percent">{t("discKindPercent")}</option>
            <option value="fixed">{t("discKindFixed")}</option>
          </Select>
          <Input
            label={kind === "percent" ? t("discValuePercentLabel") : t("discValueFixedLabel")}
            hint={kind === "percent" ? t("discValuePercentHint") : t("discValueFixedHint")}
            error={valueError}
            inputMode="decimal"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (valueError) setValueError(undefined);
            }}
          />
        </div>
        <Input
          label={t("discFromChildLabel")}
          hint={t("discFromChildHint")}
          error={fromChildError}
          inputMode="numeric"
          value={fromChild}
          onChange={(event) => {
            setFromChild(event.target.value);
            if (fromChildError) setFromChildError(undefined);
          }}
        />
        <Switch checked={isActive} onChange={setIsActive} label={t("discActiveLabel")} />
      </form>
    </Modal>
  );
}

/** Vorbelegung des Wertfelds: percent als Zahl, fixed als Euro-Text. */
function initialValue(discount: FamilyDiscount | null, locale: "de" | "en"): string {
  if (!discount) return "";
  return discount.kind === "fixed"
    ? centsToAmountInput(discount.valueNumeric, locale)
    : String(discount.valueNumeric);
}
