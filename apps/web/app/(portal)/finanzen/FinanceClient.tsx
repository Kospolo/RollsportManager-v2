"use client";

import { useMemo, useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDate } from "@/lib/format";
import { data, memberById, permissions, isNotImplemented, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { DunningLevel, Invoice, Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { financeDict } from "./i18n";
import {
  BANK_AUTO_MATCHED,
  buildSuggestions,
  deriveOpenItems,
  income30d,
  sumCents,
  treasurerOf,
  type BankSuggestion,
  type OpenItem,
} from "./derive";
import { FinanceHubNav } from "./_components/FinanceHubNav";
import { MemberFinanceView } from "./_components/MemberFinanceView";
import { OpenItemsCard } from "./_components/OpenItemsCard";
import { DunningAutomationCard } from "./_components/DunningAutomationCard";
import { MailPreviewModal, type MailStage } from "./_components/MailPreviewModal";
import { BankReconCard } from "./_components/BankReconCard";
import { LedgerCard } from "./_components/LedgerCard";
import { DunningRunSheet, type DunningRunState } from "./_components/DunningRunSheet";

/**
 * Admin-Finanzen (Mockup Screen 3, Seriositätszone) — Daten aus der Facade.
 *
 * Rechnungen + Mitglieder + eingeloggte Person laden gemeinsam (Kern des
 * Screens); das Kassenbuch lädt SEPARAT, weil es im api-Modus noch keinen
 * Endpoint hat (NotImplemented) und den Rest nie blockieren darf.
 *
 * EINE lokale Datenbasis für KPI-Zeile UND Tabellen-Footer: beide rechnen
 * über dieselben abgeleiteten offenen Posten — die Zahlen gehen quer über
 * den Screen auf (Pflicht-Abnahmekriterium). Interaktionen optimistisch.
 */
export function FinanceClient() {
  const t = useT(financeDict);

  const core = useData(async (repo) => {
    const [invoices, members, currentUser] = await Promise.all([
      repo.getInvoices(),
      repo.getMembers(),
      repo.getCurrentUser(),
    ]);
    return { invoices, members, currentUser };
  });

  if (core.status === "loading") return <FinanceSkeleton />;

  if (core.status === "error") {
    return isNotImplemented(core.error) ? (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <EmptyState
          icon="sparkle"
          title={t("notImplementedTitle")}
          body={t("notImplementedBody")}
        />
      </div>
    ) : (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(core.error)}
          action={<Button onClick={core.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  /* ---------- Rechte-Weiche (Bugfix) ----------
   * Nur can_manage_finance (treasurer/moderator/admin/owner) sieht die
   * Verwaltungs-Übersicht. Nicht-Finanz-Rollen bekommen die schlanke
   * „Meine Rechnungen"-Ansicht — keine Verwaltungs-Karten, keine Vereinssummen.
   * Der echte Schutz bleibt serverseitig (RLS + API-DB-Check). Im mock-Modus
   * gilt (wie in allen Finanz-Screens) die Verwaltungssicht, um die Demo zu
   * zeigen; die Mitglieder-Sicht greift real im api-Modus. */
  const canManageFinance =
    permissions(core.data.currentUser).canManageFinance;

  if (!canManageFinance) {
    return (
      <MemberFinanceView invoices={core.data.invoices} currentUser={core.data.currentUser} />
    );
  }

  return (
    <FinanceContent
      invoices={core.data.invoices}
      members={core.data.members}
      currentUser={core.data.currentUser}
    />
  );
}

/* ------------------------------------------------------------------ */

function FinanceContent({
  invoices,
  members,
  currentUser,
}: {
  invoices: Invoice[];
  members: Member[];
  currentUser: Member;
}) {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  /* ---------- Kassenbuch separat: im api-Modus evtl. noch NotImplemented,
       darf den Rest des Screens nie blockieren. ---------- */
  const ledger = useData((repo) => repo.getLedger());

  /* ---------- Lokaler, optimistischer Zustand ---------- */
  const [levelOverrides, setLevelOverrides] = useState<Record<string, DunningLevel>>({});
  const [paidIds, setPaidIds] = useState<ReadonlySet<string>>(new Set());
  const [autoMasterOn, setAutoMasterOn] = useState(true);
  const [stagesOn, setStagesOn] = useState<boolean[]>([true, true, true, true]);
  const [suggestions, setSuggestions] = useState<BankSuggestion[]>(() =>
    buildSuggestions(invoices, members),
  );
  const [matched, setMatched] = useState(BANK_AUTO_MATCHED);
  const [mail, setMail] = useState<{ stage: MailStage; invoiceId: string } | null>(null);

  /* ---------- Mahnlauf (Vorschau) — Sheet-Zustand ---------- */
  const [dunningSheetOpen, setDunningSheetOpen] = useState(false);
  const [dunningRun, setDunningRun] = useState<DunningRunState>({ status: "running" });

  const startDunningPreview = () => {
    setDunningSheetOpen(true);
    setDunningRun({ status: "running" });
    data
      .runDunning({ dryRun: true })
      .then((outcome) => setDunningRun({ status: "ready", outcome }))
      .catch((error: unknown) => setDunningRun({ status: "error", error }));
  };

  const nowIso = useMemo(() => new Date().toISOString(), []);

  /* ---------- Gemeinsame Datenbasis für KPIs und Tabelle ---------- */
  const items = useMemo(
    () => deriveOpenItems(invoices, members, levelOverrides, paidIds),
    [invoices, members, levelOverrides, paidIds],
  );
  const openSumCents = sumCents(items);
  const dunningItems = items.filter((item) => item.level >= 2);
  const dunningSumCents = sumCents(dunningItems);
  const oldestDunningDays = dunningItems.reduce(
    (max, item) => Math.max(max, item.overdueDays),
    0,
  );

  /* ---------- Einnahmen-KPI aus dem (separat geladenen) Kassenbuch ---------- */
  const income = ledger.status === "ready" ? income30d(ledger.data) : undefined;
  const incomeSub =
    ledger.status === "ready"
      ? t("kpiIncomeSub", { n: income?.count ?? 0 })
      : ledger.status === "loading"
        ? t("kpiIncomeLoading")
        : isNotImplemented(ledger.error)
          ? t("kpiIncomeNotImplemented")
          : t("kpiIncomeError");

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

  /* ---------- E-Mail-Vorschau: Rechnung, Mitglied & Absenderin auflösen ---------- */
  const mailInvoice = mail
    ? items.find((item) => item.invoice.id === mail.invoiceId) ?? items[0]
    : undefined;
  const mailMember = mailInvoice
    ? memberById(members, mailInvoice.invoice.memberId)
    : undefined;
  const sender = useMemo(() => treasurerOf(members), [members]);

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
              disabled={ledger.status !== "ready"}
              onClick={() =>
                showToast(
                  t("exportDatevToast", {
                    n: ledger.status === "ready" ? ledger.data.length : 0,
                  }),
                  { tone: "success" },
                )
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

      {/* Navigationsleiste zu den Finanz-Unterbereichen — FinanceContent
          rendert ausschließlich für can_manage_finance, also immer sichtbar. */}
      <FinanceHubNav canManageFinance />

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
          value={income ? formatEUR(income.sumCents, locale) : t("kpiUnavailable")}
          sub={incomeSub}
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
        onDryRun={startDunningPreview}
      />

      <OpenItemsCard items={items} onRemind={remind} onViewDunning={openMailForItem} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <BankReconCard
          matched={matched}
          suggestions={suggestions}
          onAccept={acceptSuggestion}
          onDecline={declineSuggestion}
        />
        <LedgerCard ledger={ledger} members={members} invoices={invoices} />
      </div>

      {mail && mailInvoice && mailMember && sender && (
        <MailPreviewModal
          open
          onClose={() => setMail(null)}
          stage={mail.stage}
          onStageChange={(stage) => setMail((current) => current && { ...current, stage })}
          invoice={mailInvoice.invoice}
          member={mailMember}
          sender={sender}
          currentUserEmail={currentUser.email}
        />
      )}

      <DunningRunSheet
        open={dunningSheetOpen}
        onClose={() => setDunningSheetOpen(false)}
        state={dunningRun}
        onRetry={startDunningPreview}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Lade-Zustand des gesamten Screens — spiegelt das fertige Layout. */
function FinanceSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface px-5 py-[18px] shadow-card"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-6 w-32" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={6} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}
