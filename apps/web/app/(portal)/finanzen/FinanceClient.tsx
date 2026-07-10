"use client";

import { useMemo, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDate } from "@/lib/format";
import { ledger, memberById } from "@/lib/mock";
import type { DunningLevel } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { financeDict } from "./i18n";
import {
  BANK_AUTO_MATCHED,
  buildSuggestions,
  deriveOpenItems,
  income30d,
  sumCents,
  type BankSuggestion,
  type OpenItem,
} from "./derive";
import { OpenItemsCard } from "./_components/OpenItemsCard";
import { DunningAutomationCard } from "./_components/DunningAutomationCard";
import { MailPreviewModal, type MailStage } from "./_components/MailPreviewModal";
import { BankReconCard } from "./_components/BankReconCard";
import { LedgerCard } from "./_components/LedgerCard";

/**
 * Admin-Finanzen (Mockup Screen 3, Seriositätszone).
 * EINE lokale Datenbasis für KPI-Zeile UND Tabellen-Footer: beide rechnen
 * über dieselben abgeleiteten offenen Posten — die Zahlen gehen quer über
 * den Screen auf (Pflicht-Abnahmekriterium). Alles optimistisch, ohne API.
 */
export function FinanceClient() {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  /* ---------- Lokaler, optimistischer Zustand ---------- */
  const [levelOverrides, setLevelOverrides] = useState<Record<string, DunningLevel>>({});
  const [paidIds, setPaidIds] = useState<ReadonlySet<string>>(new Set());
  const [autoMasterOn, setAutoMasterOn] = useState(true);
  const [stagesOn, setStagesOn] = useState<boolean[]>([true, true, true, true]);
  const [suggestions, setSuggestions] = useState<BankSuggestion[]>(buildSuggestions);
  const [matched, setMatched] = useState(BANK_AUTO_MATCHED);
  const [mail, setMail] = useState<{ stage: MailStage; invoiceId: string } | null>(null);

  const nowIso = useMemo(() => new Date().toISOString(), []);

  /* ---------- Gemeinsame Datenbasis für KPIs und Tabelle ---------- */
  const items = useMemo(
    () => deriveOpenItems(levelOverrides, paidIds),
    [levelOverrides, paidIds],
  );
  const openSumCents = sumCents(items);
  const dunningItems = items.filter((item) => item.level >= 2);
  const dunningSumCents = sumCents(dunningItems);
  const oldestDunningDays = dunningItems.reduce(
    (max, item) => Math.max(max, item.overdueDays),
    0,
  );

  /* ---------- Aktionen ---------- */
  const remind = (item: OpenItem) =>
    setLevelOverrides((current) => ({ ...current, [item.invoice.id]: 1 }));

  const openMailForItem = (item: OpenItem) => {
    const stage: MailStage = item.level >= 3 ? 3 : item.level === 2 ? 2 : 1;
    setMail({ stage, invoiceId: item.invoice.id });
  };

  const openMailExample = () => {
    const example = items.find((item) => item.level === 1) ?? items[0];
    if (example) setMail({ stage: 1, invoiceId: example.invoice.id });
  };

  const acceptSuggestion = (suggestion: BankSuggestion) => {
    setSuggestions((current) => current.filter((s) => s.id !== suggestion.id));
    setMatched((current) => current + 1);
    setPaidIds((current) => new Set([...current, suggestion.invoice.id]));
    showToast(t("acceptToast", { number: suggestion.invoice.number }), {
      tone: "success",
      actionLabel: t("undo"),
      onAction: () => {
        setSuggestions((current) => [...current, suggestion]);
        setMatched((current) => current - 1);
        setPaidIds((current) => {
          const next = new Set(current);
          next.delete(suggestion.invoice.id);
          return next;
        });
      },
    });
  };

  const declineSuggestion = (suggestion: BankSuggestion) => {
    setSuggestions((current) => current.filter((s) => s.id !== suggestion.id));
    showToast(t("declineToast"), {
      tone: "neutral",
      actionLabel: t("undo"),
      onAction: () => setSuggestions((current) => [...current, suggestion]),
    });
  };

  /* ---------- E-Mail-Vorschau: Rechnung + Mitglied auflösen ---------- */
  const mailInvoice = mail
    ? items.find((item) => item.invoice.id === mail.invoiceId) ?? items[0]
    : undefined;
  const mailMember = mailInvoice ? memberById(mailInvoice.invoice.memberId) : undefined;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub", { date: formatDate(nowIso, locale) })}
        action={
          <>
            <Button
              variant="ghost"
              icon="download"
              onClick={() =>
                showToast(t("exportDatevToast", { n: ledger.length }), { tone: "success" })
              }
            >
              {t("exportDatev")}
            </Button>
            <Button
              icon="plus"
              onClick={() => showToast(t("invoiceRunToast"), { tone: "info" })}
            >
              {t("invoiceRun")}
            </Button>
          </>
        }
      />

      {/* KPI-Zeile — Offene Posten identisch mit dem Tabellen-Footer */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          label={t("kpiOpen")}
          value={formatEUR(openSumCents, locale)}
          sub={t("kpiOpenSub", { n: items.length })}
          tone="neutral"
        />
        <KpiTile
          label={t("kpiIncome")}
          value={formatEUR(income30d.sumCents, locale)}
          sub={t("kpiIncomeSub", { n: income30d.count })}
          tone="success"
        />
        <KpiTile
          label={t("kpiDunning")}
          value={String(dunningItems.length)}
          sub={
            dunningItems.length > 0
              ? t("kpiDunningSub", {
                  sum: formatEUR(dunningSumCents, locale),
                  n: oldestDunningDays,
                })
              : t("kpiDunningNone")
          }
          tone={dunningItems.some((item) => item.level === 3) ? "danger" : "warn"}
        />
      </div>

      <DunningAutomationCard
        masterOn={autoMasterOn}
        onMasterChange={setAutoMasterOn}
        stagesOn={stagesOn}
        onStageChange={(index, on) =>
          setStagesOn((current) => current.map((v, i) => (i === index ? on : v)))
        }
        onPreview={openMailExample}
      />

      <OpenItemsCard items={items} onRemind={remind} onViewDunning={openMailForItem} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <BankReconCard
          matched={matched}
          suggestions={suggestions}
          onAccept={acceptSuggestion}
          onDecline={declineSuggestion}
        />
        <LedgerCard />
      </div>

      {mail && mailInvoice && mailMember && (
        <MailPreviewModal
          open
          onClose={() => setMail(null)}
          stage={mail.stage}
          onStageChange={(stage) => setMail((current) => current && { ...current, stage })}
          invoice={mailInvoice.invoice}
          member={mailMember}
        />
      )}
    </div>
  );
}
