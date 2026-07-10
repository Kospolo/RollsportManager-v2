"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateLedgerEntryInput } from "@/lib/data";
import type { Id, LedgerCategory, LedgerCounterparty, Member } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { kassenbuchDict } from "../i18n";

const FORM_ID = "ledger-entry-form";

type Direction = "income" | "expense";
type Cp = "person" | "org";

function todayISODate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Euro-Eingabe („49,00“ / „49.00“) → Cents; null bei ungültig/≤ 0. */
function parseAmountCents(raw: string): number | null {
  const n = Number(raw.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * „Buchung erfassen"-Sheet: Datum, Kategorie (aus listLedgerCategories),
 * Art (Einnahme/Ausgabe → Vorzeichen), Betrag, Zweck und Gegenpartei
 * (Mitglied ODER Organisation). Schreibt über data.createLedgerEntry
 * (GoBD-Append, amountCents SIGNED). Erfolg → Toast + onSaved() + schließen;
 * 403 → Klartext-Toast, Sheet bleibt offen.
 */
export function BookingSheet({
  clubId,
  categories,
  members,
  onClose,
  onSaved,
}: {
  clubId: Id;
  categories: LedgerCategory[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(kassenbuchDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const today = useMemo(() => todayISODate(), []);
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [members],
  );

  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("expense");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [cpKind, setCpKind] = useState<Cp>("person");
  const [memberId, setMemberId] = useState<string>("");
  const [orgName, setOrgName] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  // Kategorie wählt die Art vor (Einnahme/Ausgabe) — bleibt danach editierbar.
  const onCategoryChange = (value: string) => {
    setCategoryId(value);
    clearError("category");
    const cat = categories.find((c) => c.id === value);
    if (cat) setDirection(cat.kind);
  };

  const submit = async () => {
    if (submitting) return;
    const cents = parseAmountCents(amount);
    const next: Record<string, string> = {};
    if (!date || date > today) next.date = t("errDate");
    if (!categoryId) next.category = t("errCategory");
    if (cents === null) next.amount = t("errAmount");
    if (!purpose.trim()) next.purpose = t("errPurpose");
    if (cpKind === "person" && !memberId) next.member = t("errMember");
    if (cpKind === "org" && !orgName.trim()) next.org = t("errOrg");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const counterparty: LedgerCounterparty =
      cpKind === "person"
        ? { kind: "person", memberId }
        : { kind: "org", name: orgName.trim() };
    const signedCents = direction === "income" ? cents! : -cents!;
    const category = categories.find((c) => c.id === categoryId);

    const input: CreateLedgerEntryInput = {
      clubId,
      entryOn: date,
      description: purpose.trim(),
      counterparty,
      amountCents: signedCents,
      categoryId,
      category: category?.name,
    };

    setSubmitting(true);
    try {
      await data.createLedgerEntry(input);
      showToast(
        t("entryCreatedToast", {
          desc: input.description,
          amount: formatEUR(signedCents, locale),
        }),
        { tone: "success" },
      );
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
        <Input
          label={t("fDate")}
          type="date"
          max={today}
          value={date}
          error={errors.date}
          onChange={(event) => {
            setDate(event.target.value);
            clearError("date");
          }}
        />

        <Select
          label={t("fCategory")}
          value={categoryId}
          error={errors.category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="" disabled>
            {t("fCategoryPlaceholder")}
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} · {cat.kind === "income" ? t("income") : t("expense")}
            </option>
          ))}
        </Select>

        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("fDirection")}</span>
          <FilterChips<Direction>
            label={t("fDirection")}
            value={direction}
            onChange={setDirection}
            options={[
              { value: "income", label: t("income") },
              { value: "expense", label: t("expense") },
            ]}
          />
        </div>

        <Input
          label={t("fAmount")}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          hint={t("fAmountHint")}
          value={amount}
          error={errors.amount}
          onChange={(event) => {
            setAmount(event.target.value);
            clearError("amount");
          }}
        />

        <Textarea
          label={t("fPurpose")}
          placeholder={t("fPurposePlaceholder")}
          value={purpose}
          error={errors.purpose}
          onChange={(event) => {
            setPurpose(event.target.value);
            clearError("purpose");
          }}
        />

        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("fCounterparty")}</span>
          <FilterChips<Cp>
            label={t("fCounterparty")}
            value={cpKind}
            onChange={setCpKind}
            options={[
              { value: "person", label: t("cpPerson") },
              { value: "org", label: t("cpOrg") },
            ]}
          />
        </div>

        {cpKind === "person" ? (
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
        ) : (
          <Input
            label={t("fOrgName")}
            placeholder={t("fOrgNamePlaceholder")}
            value={orgName}
            error={errors.org}
            onChange={(event) => {
              setOrgName(event.target.value);
              clearError("org");
            }}
          />
        )}

        <p className="text-caption text-ink-faint">{t("sheetGobd")}</p>
      </form>
    </Sheet>
  );
}
