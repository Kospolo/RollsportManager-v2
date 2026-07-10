"use client";

import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { fullName, dateFromNow } from "@/lib/mock";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile } from "@/components/ui/IconTile";
import { Sheet } from "@/components/ui/Modal";
import { financeDict } from "../i18n";
import { BANK_TOTAL, type BankSuggestion } from "../derive";

/**
 * Bankabgleich (DESIGN-SYSTEM §3.7, aus A): „Automatisch zugeordnet:
 * 31 von 34" + Fortschrittsbalken. Die 3 Vorschläge werden im Sheet
 * geprüft — Annehmen markiert die Rechnung lokal als bezahlt.
 */
export function BankReconCard({
  matched,
  suggestions,
  onAccept,
  onDecline,
}: {
  matched: number;
  suggestions: BankSuggestion[];
  onAccept: (suggestion: BankSuggestion) => void;
  onDecline: (suggestion: BankSuggestion) => void;
}) {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);

  const n = suggestions.length;

  return (
    <>
      <Card>
        <CardHeader eyebrow={t("bankEyebrow")} title={t("bankTitle")} />
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-display text-[24px] font-extrabold tracking-[-0.015em] text-ink tabular-nums">
            {t("bankMatched", { matched, total: BANK_TOTAL })}
          </span>
          <span className="text-[13px] text-ink-faint">{t("bankMatchedSub")}</span>
        </div>
        <ProgressBar
          value={matched}
          max={BANK_TOTAL}
          tone="success"
          label={t("bankProgressLabel", { matched, total: BANK_TOTAL })}
          className="mt-3"
        />
        <p className="mt-2 text-caption text-ink-faint">
          {t("bankImportMeta", { date: formatDateShort(dateFromNow(-2), locale) })}
        </p>
        <div className="mt-4">
          {n > 0 ? (
            <Button
              variant="secondary"
              icon="check"
              className="w-full"
              onClick={() => setSheetOpen(true)}
            >
              {n === 1 ? t("bankReviewOne") : t("bankReviewMany", { n })}
            </Button>
          ) : (
            <Badge tone="success" icon="check">
              {t("bankAllDone")}
            </Badge>
          )}
        </div>
      </Card>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        eyebrow={t("bankEyebrow")}
        title={t("sheetTitle")}
      >
        {n === 0 ? (
          <div className="grid justify-items-start gap-2 rounded-lg border border-line bg-canvas p-4">
            <Badge tone="success" icon="check">
              {t("sheetEmptyTitle")}
            </Badge>
            <p className="text-[13.5px] text-ink-soft">
              {t("sheetEmptyBody", { matched, total: BANK_TOTAL })}
            </p>
          </div>
        ) : (
          <ul className="grid list-none gap-3">
            {suggestions.map((suggestion) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={onAccept}
                onDecline={onDecline}
              />
            ))}
          </ul>
        )}
        <p className="mt-4 text-caption text-ink-faint">{t("sheetMicro")}</p>
      </Sheet>
    </>
  );
}

function SuggestionItem({
  suggestion,
  onAccept,
  onDecline,
}: {
  suggestion: BankSuggestion;
  onAccept: (suggestion: BankSuggestion) => void;
  onDecline: (suggestion: BankSuggestion) => void;
}) {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const { invoice, member } = suggestion;

  return (
    <li className="grid gap-3 rounded-lg border border-line bg-canvas p-4">
      {/* Kontoumsatz (Bankdaten) */}
      <div className="flex items-center gap-3">
        <IconTile icon="bank" size="m" />
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[13.5px] font-bold text-ink">{suggestion.payer}</span>
          <span className="truncate font-mono text-[11.5px] text-ink-faint">
            {suggestion.reference}
          </span>
        </span>
        <span className="ml-auto whitespace-nowrap font-mono text-mono-table tabular-nums text-success">
          +{formatEUR(invoice.amountCents, locale)}
        </span>
      </div>
      <p className="text-caption text-ink-faint">
        {t("sugTransfer", { date: formatDateShort(suggestion.dateIso, locale) })}
      </p>

      {/* Vorgeschlagene Rechnung */}
      <div className="grid gap-2 border-t border-line pt-3">
        <span className="eyebrow">{t("suggestionMatches")}</span>
        <div className="flex items-center gap-2.5">
          <Avatar
            personId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            size="s"
          />
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-[13.5px] font-bold text-ink">{fullName(member)}</span>
            <span className="truncate font-mono text-[11.5px] tabular-nums text-ink-faint">
              {invoice.number} · {formatEUR(invoice.amountCents, locale)}
            </span>
          </span>
          <Badge
            tone={suggestion.confidence === "high" ? "success" : "info"}
            className="ml-auto"
          >
            {suggestion.confidence === "high" ? t("confidenceHigh") : t("confidenceMedium")}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onDecline(suggestion)}>
          {t("decline")}
        </Button>
        <Button variant="secondary" size="sm" icon="check" onClick={() => onAccept(suggestion)}>
          {t("accept")}
        </Button>
      </div>
    </li>
  );
}
