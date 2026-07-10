"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateLedgerCategoryInput } from "@/lib/data";
import type { Id, LedgerCategory, LedgerCategoryKind } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { kassenbuchDict } from "../i18n";

const FORM_ID = "ledger-category-form";

/**
 * „Kategorien verwalten" (klein): Liste der aktiven Kategorien mit Art-Chip
 * plus ein kompaktes Anlege-Formular (Name + Art). GoBD: Kategorien werden
 * nie gelöscht (nur soft) — der Dialog bietet daher bewusst kein Löschen.
 * Schreibt über data.createLedgerCategory; onCreated lädt die Facade neu.
 */
export function CategoriesModal({
  clubId,
  categories,
  onClose,
  onCreated,
}: {
  clubId: Id;
  categories: LedgerCategory[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT(kassenbuchDict);
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<LedgerCategoryKind>("income");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (!name.trim()) {
      setNameError(t("catNameError"));
      return;
    }
    const input: CreateLedgerCategoryInput = { clubId, name: name.trim(), kind };
    setSubmitting(true);
    try {
      await data.createLedgerCategory(input);
      showToast(t("categoryCreatedToast", { name: input.name }), { tone: "success" });
      setName("");
      onCreated();
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
      eyebrow={t("catsEyebrow")}
      title={t("catsTitle")}
      footer={
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          {t("close")}
        </Button>
      }
    >
      <div className="grid gap-5">
        <p className="text-body text-ink-soft">{t("catsIntro")}</p>

        <ul className="grid gap-2">
          {categories.length === 0 && (
            <li className="text-body text-ink-faint">{t("catEmpty")}</li>
          )}
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-sunken px-3.5 py-2.5"
            >
              <span className="truncate text-[14px] font-semibold text-ink">{cat.name}</span>
              <Badge tone={cat.kind === "income" ? "success" : "neutral"}>
                {cat.kind === "income" ? t("catKindIncome") : t("catKindExpense")}
              </Badge>
            </li>
          ))}
        </ul>

        <form
          id={FORM_ID}
          noValidate
          className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
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
          <Select
            label={t("catKindLabel")}
            value={kind}
            onChange={(event) => setKind(event.target.value as LedgerCategoryKind)}
          >
            <option value="income">{t("catKindIncome")}</option>
            <option value="expense">{t("catKindExpense")}</option>
          </Select>
          <Button type="submit" icon="plus" disabled={submitting}>
            {t("catAdd")}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
