"use client";

import { useMemo, useState } from "react";
import { ApiError, data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { MatchBankTransactionInput } from "@/lib/data";
import type { BankTransaction, Invoice, LedgerCategory, Member } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile } from "@/components/ui/IconTile";
import { bankabgleichDict } from "../i18n";
import { bestSuggestion, rankInvoices, type MatchConfidence, type ScoredInvoice } from "../derive";

const CONFIDENCE_TONE: Record<MatchConfidence, "success" | "info" | "neutral"> = {
  high: "success",
  medium: "info",
  low: "neutral",
};

/**
 * „Umsatz zuordnen"-Sheet: zeigt den Kontoumsatz und die nach Betrag/Name
 * bewerteten offenen Rechnungen (bester Vorschlag vorausgewählt). „Als bezahlt
 * buchen" (postToLedger, Default an) setzt eine offene Rechnung auf bezahlt und
 * bucht eine Kassenbuch-Einnahme (optionale Kategorie); eine bereits bezahlte
 * Rechnung wird nur verknüpft. Schreibt über data.matchBankTransaction.
 * 409 (ignoriert) und 422 (fremder Verein) werden als Klartext-Toast gemeldet.
 */
export function MatchSheet({
  transaction,
  invoices,
  members,
  categories,
  onClose,
  onMatched,
}: {
  transaction: BankTransaction;
  invoices: Invoice[];
  members: Member[];
  categories: LedgerCategory[];
  onClose: () => void;
  onMatched: () => void;
}) {
  const t = useT(bankabgleichDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const scored = useMemo(
    () => rankInvoices(transaction, invoices, members),
    [transaction, invoices, members],
  );
  const suggestedId = useMemo(() => bestSuggestion(scored)?.invoice.id, [scored]);
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.kind === "income" && !category.deletedAt),
    [categories],
  );

  const [invoiceId, setInvoiceId] = useState<string>(suggestedId ?? "");
  const [postToLedger, setPostToLedger] = useState(true);
  const [categoryId, setCategoryId] = useState<string>("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const selected = scored.find((candidate) => candidate.invoice.id === invoiceId);

  const submit = async () => {
    if (submitting) return;
    if (!invoiceId) {
      setError(t("errPickInvoice"));
      return;
    }
    const input: MatchBankTransactionInput = {
      invoiceId,
      postToLedger,
      ledgerCategoryId: postToLedger && categoryId ? categoryId : undefined,
    };
    setSubmitting(true);
    try {
      await data.matchBankTransaction(transaction.id, input);
      const number = selected?.invoice.number ?? "";
      const booked = postToLedger && selected?.invoice.status === "open";
      showToast(booked ? t("matchPaidToast", { number }) : t("matchToast", { number }), {
        tone: "success",
      });
      onMatched();
      onClose();
    } catch (caught) {
      showToast(matchErrorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const matchErrorMessage = (caught: unknown): string => {
    if (isForbidden(caught)) return t("forbidden");
    if (caught instanceof ApiError) {
      if (caught.status === 409) return t("errIgnored");
      if (caught.status === 422) return t("errOtherClub");
    }
    return errorMessage(caught);
  };

  const noCandidates = scored.length === 0;

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("matchEyebrow")}
      title={t("matchTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            icon="check"
            onClick={() => void submit()}
            disabled={submitting || noCandidates}
          >
            {t("matchConfirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {/* Kontoumsatz (Bankdaten) */}
        <section className="grid gap-2 rounded-lg border border-line bg-canvas p-4">
          <span className="eyebrow">{t("matchTxLabel")}</span>
          <div className="flex items-center gap-3">
            <IconTile icon="bank" size="m" />
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-[14px] font-bold text-ink">
                {transaction.counterparty || t("noCounterparty")}
              </span>
              <span className="truncate font-mono text-[11.5px] text-ink-faint">
                {transaction.purpose || t("noPurpose")}
              </span>
            </span>
            <span className="ml-auto whitespace-nowrap font-mono text-mono-table tabular-nums text-success">
              +{formatEUR(transaction.amountCents, locale)}
            </span>
          </div>
          <span className="text-caption text-ink-faint">
            {formatDateShort(transaction.bookedOn, locale)}
          </span>
        </section>

        {noCandidates ? (
          <p className="rounded-lg border border-line bg-sunken px-4 py-3 text-[13.5px] text-ink-soft">
            {t("noOpenInvoices")}
          </p>
        ) : (
          <>
            {/* Offene Rechnungen als Auswahl (bester Vorschlag vorausgewählt) */}
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[13px] font-bold text-ink">{t("matchPickLabel")}</legend>
              <div role="radiogroup" aria-label={t("matchPickLabel")} className="grid gap-2">
                {scored.map((candidate) => (
                  <InvoiceOption
                    key={candidate.invoice.id}
                    candidate={candidate}
                    transaction={transaction}
                    selected={candidate.invoice.id === invoiceId}
                    isSuggestion={candidate.invoice.id === suggestedId}
                    onSelect={() => {
                      setInvoiceId(candidate.invoice.id);
                      setError(undefined);
                    }}
                  />
                ))}
              </div>
              {error && <p className="text-caption font-semibold text-danger">{error}</p>}
            </fieldset>

            {/* Als bezahlt buchen + Kassenbuch-Einnahme */}
            <section className="grid gap-2 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-bold text-ink">{t("postToLedgerLabel")}</span>
                <Switch
                  checked={postToLedger}
                  onChange={setPostToLedger}
                  label={t("postToLedgerLabel")}
                />
              </div>
              <p className="text-caption text-ink-faint">{t("postToLedgerHint")}</p>
              {postToLedger && incomeCategories.length > 0 && (
                <Select
                  className="mt-1"
                  label={t("categoryLabel")}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">{t("categoryNone")}</option>
                  {incomeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function InvoiceOption({
  candidate,
  transaction,
  selected,
  isSuggestion,
  onSelect,
}: {
  candidate: ScoredInvoice;
  transaction: BankTransaction;
  selected: boolean;
  isSuggestion: boolean;
  onSelect: () => void;
}) {
  const t = useT(bankabgleichDict);
  const { locale } = useLocale();
  const { invoice, member } = candidate;
  const amountDiffers = invoice.amountCents !== transaction.amountCents;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`grid gap-2 rounded-lg border p-3 text-left transition-colors duration-150 ${
        selected
          ? "border-brand bg-brand-soft/40"
          : "border-line bg-canvas hover:border-line-strong hover:bg-sunken"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {member ? (
          <Avatar
            personId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            size="s"
          />
        ) : (
          <IconTile icon="user" size="s" />
        )}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[13.5px] font-bold text-ink">
            {member ? fullName(member) : invoice.title}
          </span>
          <span className="truncate font-mono text-[11.5px] tabular-nums text-ink-faint">
            {invoice.number} · {formatEUR(invoice.amountCents, locale)}
          </span>
        </span>
        {candidate.score > 0 && (
          <Badge tone={CONFIDENCE_TONE[candidate.confidence]} className="ml-auto flex-none">
            {candidate.confidence === "high"
              ? t("confidenceHigh")
              : candidate.confidence === "medium"
                ? t("confidenceMedium")
                : t("confidenceLow")}
          </Badge>
        )}
      </div>
      {(isSuggestion || amountDiffers) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[42px]">
          {isSuggestion && <span className="eyebrow">{t("suggestionLabel")}</span>}
          {amountDiffers && (
            <span className="text-caption font-semibold text-warn">{t("amountDiff")}</span>
          )}
        </div>
      )}
    </button>
  );
}
