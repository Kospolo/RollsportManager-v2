"use client";

import { useMemo, useState } from "react";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateInvoiceItemDraft } from "@/lib/data/inputs-finance";
import type { Id, InvoiceDetail, Member } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { invoicesDict } from "../i18n";
import { lineCents, parseEuroToCents, parseQuantity, VAT_RATE_OPTIONS } from "../derive";

type Mode = "simple" | "itemized";

/** Eine Positions-Zeile im Formular (Rohtext, wird beim Absenden geparst). */
interface DraftRow {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: number;
}

let rowSeq = 0;
const emptyRow = (vatRate: number): DraftRow => ({
  key: `row-${++rowSeq}`,
  description: "",
  quantity: "1",
  unitPrice: "",
  vatRate,
});

/**
 * „Rechnung erstellen" — Sheet mit zwei Modi:
 *  • Einzelbetrag: Mitglied, Zweck, Betrag, Fälligkeit (wie bisher; direkt offen
 *    oder als Entwurf über den Schalter).
 *  • Positionen: Menge × Einzelpreis + MwSt je Position. Positionen erzeugen
 *    ZWINGEND einen Entwurf; Netto/MwSt/Brutto rechnet die Datenbank, der Betrag
 *    ergibt sich aus den Positionen. Mit „Sofort offen stellen" wird der Entwurf
 *    danach ausgestellt.
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
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>("simple");
  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [issue, setIssue] = useState(true);
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(0)]);
  const [errors, setErrors] = useState<{ member?: string; title?: string; amount?: string; items?: string }>({});
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

  /** Live-Summen der Positionen (dieselbe Rundung wie die DB, 0072). */
  const totals = useMemo(() => {
    let net = 0;
    let vat = 0;
    for (const row of rows) {
      const qty = parseQuantity(row.quantity);
      const price = parseEuroToCents(row.unitPrice);
      if (qty === null || price === null) continue;
      const line = lineCents(qty, price, row.vatRate);
      net += line.net;
      vat += line.vat;
    }
    return { net, vat, gross: net + vat };
  }, [rows]);

  const reset = () => {
    setMode("simple");
    setMemberId("");
    setTitle("");
    setAmount("");
    setDueOn("");
    setIssue(true);
    setRows([emptyRow(0)]);
    setErrors({});
  };

  const close = () => {
    reset();
    onClose();
  };

  const setRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = () => setRows((current) => [...current, emptyRow(0)]);
  const removeRow = (key: string) =>
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));

  /** Vollständige, gültige Positionen aus den Roh-Zeilen (für den Submit). */
  const collectItems = (): CreateInvoiceItemDraft[] | null => {
    const items: CreateInvoiceItemDraft[] = [];
    for (const row of rows) {
      const desc = row.description.trim();
      const qty = parseQuantity(row.quantity);
      const price = parseEuroToCents(row.unitPrice);
      if (!desc && qty === null && price === null) continue; // leere Zeile ignorieren
      if (!desc || qty === null || qty <= 0 || price === null) return null;
      items.push({ description: desc, quantity: qty, unitPriceCents: price, vatRate: row.vatRate });
    }
    return items.length > 0 ? items : null;
  };

  const submit = async () => {
    if (submitting) return;
    const nextErrors: typeof errors = {};
    if (!memberId) nextErrors.member = t("cMemberError");
    if (!title.trim()) nextErrors.title = t("cTitleError");

    let items: CreateInvoiceItemDraft[] | undefined;
    let amountCents = 0;
    if (mode === "itemized") {
      const collected = collectItems();
      if (!collected) nextErrors.items = t("cPosItemsError");
      else {
        items = collected;
        amountCents = totals.gross;
      }
    } else {
      const parsed = parseEuroToCents(amount);
      if (parsed === null || parsed <= 0) nextErrors.amount = t("cAmountError");
      else amountCents = parsed;
    }

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
        amountCents,
        dueOn: dueOn || undefined,
        issue,
        items,
      });
      onCreated(invoice);
      const toastKey =
        items && !issue ? "createToastItemized" : issue ? "createToastOpen" : "createToastDraft";
      showToast(t(toastKey, { number: invoice.number }), { tone: "success" });
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

        {/* Modus: Einzelbetrag vs. Positionen */}
        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("cModeLabel")}</span>
          <div className="flex gap-1 rounded-lg border border-line bg-sunken/50 p-1">
            {(["simple", "itemized"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setErrors((e) => ({ ...e, amount: undefined, items: undefined }));
                }}
                aria-pressed={mode === value}
                className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors duration-150 ${
                  mode === value ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"
                }`}
              >
                {t(value === "simple" ? "cModeSimple" : "cModeItemized")}
              </button>
            ))}
          </div>
          {mode === "itemized" && <p className="text-caption text-ink-faint">{t("cModeHint")}</p>}
        </div>

        {mode === "simple" ? (
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
        ) : (
          <PositionsEditor
            rows={rows}
            error={errors.items}
            totals={totals}
            locale={locale}
            onChange={(key, patch) => {
              setRow(key, patch);
              if (errors.items) setErrors((e) => ({ ...e, items: undefined }));
            }}
            onAdd={addRow}
            onRemove={removeRow}
          />
        )}

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

/* ------------------------------------------------------------------ */

/** Positions-Editor: Zeilen mit Menge × Einzelpreis + MwSt und Live-Summe. */
function PositionsEditor({
  rows,
  error,
  totals,
  locale,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: DraftRow[];
  error?: string;
  totals: { net: number; vat: number; gross: number };
  locale: Locale;
  onChange: (key: string, patch: Partial<DraftRow>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const t = useT(invoicesDict);
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-sunken/40 p-3">
      {rows.map((row) => (
        <div key={row.key} className="grid gap-2 rounded-md border border-line bg-surface p-3">
          <Input
            label={t("cPosDesc")}
            placeholder={t("cPosDescPlaceholder")}
            value={row.description}
            onChange={(event) => onChange(row.key, { description: event.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              label={t("cPosQty")}
              inputMode="decimal"
              value={row.quantity}
              onChange={(event) => onChange(row.key, { quantity: event.target.value })}
            />
            <Input
              label={t("cPosPrice")}
              inputMode="decimal"
              placeholder="0,00"
              value={row.unitPrice}
              onChange={(event) => onChange(row.key, { unitPrice: event.target.value })}
            />
            <Select
              label={t("cPosVat")}
              value={String(row.vatRate)}
              onChange={(event) => onChange(row.key, { vatRate: Number(event.target.value) })}
            >
              {VAT_RATE_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} %
                </option>
              ))}
            </Select>
          </div>
          {rows.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start text-danger"
              onClick={() => onRemove(row.key)}
            >
              <Icon name="trash" className="ic h-4 w-4" />
              {t("cPosRemove")}
            </Button>
          )}
        </div>
      ))}

      <Button type="button" variant="ghost" size="sm" icon="plus" onClick={onAdd} className="justify-self-start">
        {t("cPosAdd")}
      </Button>

      {error && <p className="text-caption text-danger">{error}</p>}

      <dl className="grid gap-1 border-t border-line pt-2 text-[13px]">
        <SummaryRow label={t("cTotalNet")} value={formatEUR(totals.net, locale)} />
        <SummaryRow label={t("cTotalVat")} value={formatEUR(totals.vat, locale)} />
        <SummaryRow label={t("cTotalGross")} value={formatEUR(totals.gross, locale)} strong />
      </dl>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-bold text-ink" : "text-ink-soft"}>{label}</dt>
      <dd className={`font-mono tabular-nums ${strong ? "font-bold text-ink" : "text-ink-soft"}`}>
        {value}
      </dd>
    </div>
  );
}
