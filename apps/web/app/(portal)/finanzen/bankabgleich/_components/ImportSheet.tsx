"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Id } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { bankabgleichDict } from "../i18n";
import {
  parseBankCsv,
  sumImportRows,
  type ImportRowError,
  type ImportRowErrorCode,
} from "../derive";

const REASON_KEY: Record<ImportRowErrorCode, "reasonColumns" | "reasonDate" | "reasonAmount"> = {
  columns: "reasonColumns",
  date: "reasonDate",
  amount: "reasonAmount",
};

/**
 * „Umsätze importieren"-Sheet: CSV einfügen oder Datei wählen, Live-Vorschau
 * (gültige Zeilen + Summe, übersprungene Zeilen mit Grund), dann Stapel-Import
 * über data.importBankTransactions. Alle Zeilen landen als offene Umsätze.
 * 403 → Klartext-Toast, Sheet bleibt offen. Kein Datei-Download — die Datei
 * wird nur lokal gelesen (FileReader).
 */
export function ImportSheet({
  clubId,
  onClose,
  onImported,
}: {
  clubId: Id;
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useT(bankabgleichDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [raw, setRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => parseBankCsv(raw), [raw]);
  const hasInput = raw.trim().length > 0;

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (submitting) return;
    if (parsed.rows.length === 0) {
      showToast(t("importNothing"), { tone: "danger" });
      return;
    }
    setSubmitting(true);
    try {
      const created = await data.importBankTransactions({ clubId, rows: parsed.rows });
      showToast(t("importToast", { n: created.length }), { tone: "success" });
      onImported();
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
      eyebrow={t("importEyebrow")}
      title={t("importTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            icon="check"
            onClick={() => void submit()}
            disabled={submitting || parsed.rows.length === 0}
          >
            {t("importConfirm", { n: parsed.rows.length })}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-body text-ink-soft">{t("importIntro")}</p>

        <Textarea
          label={t("importPasteLabel")}
          placeholder={t("importPastePlaceholder")}
          hint={t("importFormatHint")}
          className="[&_textarea]:min-h-40 [&_textarea]:font-mono [&_textarea]:text-[12.5px]"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
        />

        <label className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("importFileLabel")}</span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={onFile}
            className="block w-full text-[13px] text-ink-soft file:mr-3 file:min-h-9 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-4 file:text-[13px] file:font-bold file:text-ink hover:file:bg-sunken"
          />
        </label>

        {/* Vorschau */}
        <div className="grid gap-2 rounded-lg border border-line bg-canvas p-4">
          {!hasInput ? (
            <p className="text-[13.5px] text-ink-faint">{t("importEmpty")}</p>
          ) : (
            <>
              <p className="text-[13.5px] font-bold text-ink">
                {t("importPreviewValid", {
                  n: parsed.rows.length,
                  sum: formatEUR(sumImportRows(parsed.rows), locale),
                })}
              </p>
              {parsed.errors.length > 0 && (
                <div className="grid gap-1 border-t border-line pt-2">
                  <span className="text-caption font-semibold text-warn">
                    {t("importPreviewErrors", { n: parsed.errors.length })}
                  </span>
                  <ul className="grid list-none gap-0.5">
                    {parsed.errors.slice(0, 5).map((err: ImportRowError) => (
                      <li key={err.line} className="truncate text-caption text-ink-faint">
                        {t("importErrorLine", { line: err.line, reason: t(REASON_KEY[err.code]) })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
