"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDate } from "@/lib/format";
import { errorMessage, isNotImplemented, memberById, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, InvoiceDetail, Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile, type KpiTone } from "@/components/ui/KpiTile";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { treasurerOf } from "../derive";
import { mahnungenDict } from "./i18n";
import { buildDunningItems, groupByStage, sumCents } from "./derive";
import { StageGroupCard } from "./_components/StageGroupCard";
import { MahnHistoryCard } from "./_components/MahnHistoryCard";
import { MahnlaufModal } from "./_components/MahnlaufModal";
import { MailPreviewModal, type MailStage } from "../_components/MailPreviewModal";

/**
 * Mahnwesen-Screen (/finanzen/mahnungen, Seriositätszone). Offene überfällige
 * Posten gruppiert nach Mahnstufe (Ampel 0–3), oben der Mahnlauf (Vorschau →
 * Anwenden), darunter das unveränderliche Mahnprotokoll. Daten über die Facade
 * (mock|api). KONSISTENZ: KPI-Zeile, Ampel-Gruppen und der Lauf rechnen alle
 * über DENSELBEN buildDunningItems() — die Summen gehen quer über den Screen auf.
 *
 * Rechte SERVERSEITIG (RLS): alle Reads/Writes = can_manage_finance. Das Gate
 * hier ist nur Anzeige (ein Mitglied sieht NIE Kassenbuch/Mahnprotokoll); der
 * Server bleibt die Wahrheit — ein 403 wird als ruhiger Toast behandelt.
 */
export function MahnungenClient() {
  const t = useT(mahnungenDict);

  const core = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    const [invoices, members] = await Promise.all([
      repo.listInvoices(currentUser.clubId),
      repo.getMembers(),
    ]);
    return { currentUser, clubId: currentUser.clubId, invoices, members };
  });

  if (core.status === "loading") return <MahnungenSkeleton />;

  if (core.status === "error") {
    return (
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

  const canManageFinance =
    permissions(core.data.currentUser).canManageFinance;

  if (!canManageFinance) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Breadcrumb current={t("pageTitle")} />
        <EmptyState icon="lock" title={t("pageTitle")} body={t("readOnlyNote")} />
      </div>
    );
  }

  return (
    <MahnungenContent
      currentUser={core.data.currentUser}
      clubId={core.data.clubId}
      invoices={core.data.invoices}
      members={core.data.members}
      reloadCore={core.reload}
    />
  );
}

/* ------------------------------------------------------------------ */

function MahnungenContent({
  currentUser,
  clubId,
  invoices,
  members,
  reloadCore,
}: {
  currentUser: Member;
  clubId: Id;
  invoices: InvoiceDetail[];
  members: Member[];
  reloadCore: () => void;
}) {
  const t = useT(mahnungenDict);
  const { locale } = useLocale();

  const dunningLog = useData((repo) => repo.listDunningLog(clubId), [clubId]);

  const [runOpen, setRunOpen] = useState(false);
  const [mail, setMail] = useState<{ invoiceId: Id; stage: MailStage } | null>(null);

  const nowIso = useMemo(() => new Date().toISOString(), []);

  /* ---------- Eine Datenbasis für KPIs, Ampel-Gruppen UND Lauf ---------- */
  const items = useMemo(() => buildDunningItems(invoices, members), [invoices, members]);
  const overdueItems = useMemo(() => items.filter((i) => i.overdue), [items]);
  const stage2Plus = useMemo(() => items.filter((i) => i.level >= 2), [items]);
  const handoverItems = useMemo(() => items.filter((i) => i.level >= 3), [items]);
  const stages = useMemo(() => groupByStage(items), [items]);

  const dunningTone: KpiTone =
    handoverItems.length > 0 ? "danger" : stage2Plus.length > 0 ? "warn" : "neutral";

  /* ---------- E-Mail-Vorschau (nur Lesen) ---------- */
  const mailItem = mail ? items.find((i) => i.invoice.id === mail.invoiceId) : undefined;
  const mailMember = mailItem ? memberById(members, mailItem.invoice.memberId) : undefined;
  const sender = useMemo(() => treasurerOf(members), [members]);

  const onApplied = () => {
    reloadCore();
    dunningLog.reload();
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb current={t("pageTitle")} />

      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", { date: formatDate(nowIso, locale) })}
        action={
          <Button icon="bell" onClick={() => setRunOpen(true)}>
            {t("runButton")}
          </Button>
        }
      />

      {/* KPI-Zeile — dieselbe Datenbasis wie Ampel-Gruppen und Lauf */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          label={t("kpiOverdue")}
          value={formatEUR(sumCents(overdueItems), locale)}
          sub={
            overdueItems.length > 0
              ? t("kpiOverdueSub", { n: overdueItems.length })
              : t("kpiOverdueNone")
          }
          tone={overdueItems.length > 0 ? "warn" : "neutral"}
        />
        <KpiTile
          label={t("kpiDunning")}
          value={String(stage2Plus.length)}
          sub={
            stage2Plus.length > 0
              ? t("kpiDunningSub", { sum: formatEUR(sumCents(stage2Plus), locale) })
              : t("kpiDunningNone")
          }
          tone={dunningTone}
        />
        <KpiTile
          label={t("kpiHandover")}
          value={String(handoverItems.length)}
          sub={handoverItems.length > 0 ? t("kpiHandoverSub") : t("kpiHandoverNone")}
          tone={handoverItems.length > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Ampel-Gruppen (0–3) oder leerer Zustand, wenn nichts offen ist */}
      {items.length === 0 ? (
        <EmptyState icon="check" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div className="grid gap-5">
          {stages.map((bucket) => (
            <StageGroupCard
              key={bucket.level}
              bucket={bucket}
              onPreviewMail={(invoiceId, stage) => setMail({ invoiceId, stage })}
            />
          ))}
        </div>
      )}

      {/* Mahnprotokoll (Historie) */}
      {dunningLog.status === "ready" ? (
        <MahnHistoryCard log={dunningLog.data} invoices={invoices} members={members} />
      ) : dunningLog.status === "loading" ? (
        <SkeletonCard lines={4} />
      ) : isNotImplemented(dunningLog.error) ? null : (
        <Card>
          <div className="grid justify-items-start gap-3">
            <p className="text-[13.5px] text-ink-soft">{errorMessage(dunningLog.error)}</p>
            <Button variant="secondary" size="sm" onClick={dunningLog.reload}>
              {t("retry")}
            </Button>
          </div>
        </Card>
      )}

      {/* Pro Öffnen frisch gemountet — Freigaben/Notiz starten immer leer. */}
      {runOpen && (
        <MahnlaufModal
          open
          onClose={() => setRunOpen(false)}
          clubId={clubId}
          items={items}
          onApplied={onApplied}
        />
      )}

      {mail && mailItem && mailMember && sender && (
        <MailPreviewModal
          open
          onClose={() => setMail(null)}
          stage={mail.stage}
          onStageChange={(stage) => setMail((current) => current && { ...current, stage })}
          invoice={mailItem.invoice}
          member={mailMember}
          sender={sender}
          currentUserEmail={currentUser.email}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Brotkrumen: zurück zur Finanz-Übersicht → aktuelle Seite. */
function Breadcrumb({ current }: { current: string }) {
  const t = useT(mahnungenDict);
  return (
    <nav aria-label={t("crumbNav")} className="flex items-center gap-1.5 text-[13px]">
      <Link
        href="/finanzen"
        className="inline-flex min-h-11 items-center font-semibold text-ink-soft no-underline transition-colors duration-150 hover:text-ink hover:underline"
      >
        {t("financeCrumb")}
      </Link>
      <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
      <span aria-current="page" className="font-bold text-ink">
        {current}
      </span>
    </nav>
  );
}

/** Lade-Zustand — spiegelt das Layout (Kopf, KPI-Zeile, Ampel, Historie). */
function MahnungenSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-2">
        <Skeleton className="h-7 w-56" />
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
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  );
}
