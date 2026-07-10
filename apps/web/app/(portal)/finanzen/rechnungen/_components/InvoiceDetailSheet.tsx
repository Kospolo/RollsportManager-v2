"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatEUR } from "@/lib/format";
import { ApiError, data, errorMessage, fullName, isForbidden } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, InvoiceDetail, LedgerCategory, Member } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill, DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { invoicesDict } from "../i18n";
import { STATUS_KEY, STATUS_TONE } from "../derive";
import { Meta, SettlePanel, type ViaKey } from "./InvoiceDetailPanels";

type SheetMode = "view" | "settle" | "cancel";

/** Ein Verlaufseintrag der Rechnung (ausgestellt → Mahnungen → bezahlt/storniert). */
type HistoryItem = { key: string; label: string; note?: string; dateIso?: string };

/**
 * Rechnungs-Detail als seitliches Sheet: Empfänger, Positionen, Verlauf
 * (inkl. Mahnprotokoll aus der Facade) und die terminalen Aktionen
 * „als bezahlt markieren" (Zahlweg + optionale Kassenbuch-Einnahme) und
 * „stornieren" (mit expliziter Bestätigung — GoBD, kein Re-Open).
 */
export function InvoiceDetailSheet({
  invoice,
  member,
  categories,
  clubId,
  onClose,
  onChanged,
}: {
  invoice: InvoiceDetail;
  member: Member | undefined;
  categories: LedgerCategory[];
  clubId: Id;
  onClose: () => void;
  /** Aktualisierte Rechnung nach bezahlt/storniert. */
  onChanged: (invoice: InvoiceDetail) => void;
}) {
  const t = useT(invoicesDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [mode, setMode] = useState<SheetMode>("view");
  const [via, setVia] = useState<ViaKey>("viaSepa");
  const [postToLedger, setPostToLedger] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const log = useData(
    (repo) => repo.listDunningLog(clubId, { invoiceId: invoice.id }),
    [clubId, invoice.id],
  );

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.kind === "income"),
    [categories],
  );

  const history = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      { key: "issued", label: t("histIssued"), dateIso: invoice.issuedAt },
    ];
    const entries = log.status === "ready" ? log.data : [];
    for (const entry of entries) {
      const stage =
        entry.toStage ?? (entry.action === "reminder" ? 1 : entry.action === "handover" ? 4 : 2);
      const key =
        entry.action === "reminder"
          ? "histReminder"
          : entry.action === "handover"
            ? "histHandover"
            : "histDunning";
      items.push({
        key: entry.id,
        label: t(key, { stage }),
        note: entry.note,
        dateIso: entry.createdAt.slice(0, 10),
      });
    }
    if (invoice.status === "paid") {
      const viaSuffix = invoice.paidVia ? t("histPaidVia", { via: invoice.paidVia }) : "";
      items.push({ key: "paid", label: t("histPaid", { via: viaSuffix }), dateIso: invoice.paidAt });
    }
    if (invoice.status === "cancelled") {
      items.push({ key: "cancelled", label: t("histCancelled") });
    }
    return items.sort((a, b) => (a.dateIso ?? "9999").localeCompare(b.dateIso ?? "9999"));
  }, [invoice, log, t]);

  const positionColumns: Column<InvoiceDetail>[] = [
    {
      id: "desc",
      header: t("posColDesc"),
      cell: (row) => <span className="text-[13.5px] text-ink">{row.title}</span>,
      footer: t("posTotal"),
    },
    {
      id: "amount",
      header: t("posColAmount"),
      mono: true,
      cell: (row) => formatEUR(row.amountCents, locale),
      footer: formatEUR(invoice.amountCents, locale),
    },
  ];

  const canMarkPaid = invoice.status === "open";
  const canCancel = invoice.status === "open" || invoice.status === "draft";

  const doSettle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await data.settleInvoice(invoice.id, {
        status: "paid",
        paidVia: t(via),
        postToLedger,
        ledgerCategoryId: postToLedger && categoryId ? categoryId : undefined,
      });
      onChanged(updated);
      showToast(t("settleToast", { number: invoice.number }), { tone: "success" });
      setMode("view");
    } catch (caught) {
      const msg =
        caught instanceof ApiError && caught.status === 409
          ? t("settleNotOpen")
          : isForbidden(caught)
            ? t("forbidden")
            : errorMessage(caught);
      showToast(msg, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await data.settleInvoice(invoice.id, { status: "cancelled" });
      onChanged(updated);
      showToast(t("cancelToast", { number: invoice.number }), { tone: "success" });
      onClose();
    } catch (caught) {
      const msg =
        caught instanceof ApiError && caught.status === 409
          ? t("cancelNotAllowed")
          : isForbidden(caught)
            ? t("forbidden")
            : errorMessage(caught);
      showToast(msg, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const footer =
    mode === "settle" ? (
      <>
        <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>
          {t("settleBack")}
        </Button>
        <Button icon="check" onClick={doSettle} disabled={busy}>
          {t("settleConfirm")}
        </Button>
      </>
    ) : mode === "cancel" ? (
      <>
        <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>
          {t("cancelBack")}
        </Button>
        <Button variant="danger" onClick={doCancel} disabled={busy}>
          {t("cancelConfirm")}
        </Button>
      </>
    ) : canMarkPaid || canCancel ? (
      <>
        {canCancel && (
          <Button variant="ghost" onClick={() => setMode("cancel")}>
            {t("actionCancel")}
          </Button>
        )}
        {canMarkPaid && (
          <Button icon="check" onClick={() => setMode("settle")}>
            {t("actionMarkPaid")}
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("detEyebrow")}
      title={invoice.title}
      footer={footer}
    >
      {/* Betrag + Status + Nummer (mono) */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-5">
        <span className="font-mono text-[24px] font-bold tabular-nums text-ink">
          {formatEUR(invoice.amountCents, locale)}
        </span>
        <StatusPill tone={STATUS_TONE[invoice.status]}>
          {t(STATUS_KEY[invoice.status])}
        </StatusPill>
        {invoice.status === "open" && invoice.dunningLevel > 0 && (
          <DunningBadge level={invoice.dunningLevel} />
        )}
        <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-faint">
          {invoice.number}
        </span>
      </div>

      {mode === "settle" && (
        <SettlePanel
          via={via}
          onViaChange={setVia}
          postToLedger={postToLedger}
          onPostChange={setPostToLedger}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          categories={incomeCategories}
        />
      )}

      {mode === "cancel" && (
        <div className="mb-5 grid gap-2 rounded-lg border border-danger/40 bg-danger-soft/40 p-4">
          <p className="text-[14px] font-bold text-ink">{t("cancelTitle")}</p>
          <p className="text-[13px] text-ink-soft">{t("cancelWarning")}</p>
        </div>
      )}

      {mode === "view" && (
        <div className="grid gap-6">
          {/* Empfänger */}
          <section className="grid gap-2">
            <span className="eyebrow">{t("detRecipient")}</span>
            <span className="flex items-center gap-3">
              {member ? (
                <>
                  <Avatar
                    personId={member.id}
                    firstName={member.firstName}
                    lastName={member.lastName}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-[14px] font-bold text-ink">
                      {fullName(member)}
                    </span>
                    <span className="truncate text-caption text-ink-faint">
                      {member.email ?? "—"}
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-[14px] text-ink-soft">{t("unknownMember")}</span>
              )}
            </span>
          </section>

          {/* Eckdaten */}
          <section className="grid grid-cols-2 gap-4">
            <Meta label={t("detIssued")} value={formatDateShort(invoice.issuedAt, locale)} />
            <Meta label={t("detDue")} value={formatDateShort(invoice.dueAt, locale)} />
            {invoice.status === "paid" && invoice.paidAt && (
              <Meta label={t("detPaidAt")} value={formatDateShort(invoice.paidAt, locale)} />
            )}
            {invoice.status === "paid" && invoice.paidVia && (
              <Meta label={t("detPaidVia")} value={invoice.paidVia} />
            )}
          </section>

          {/* Positionen */}
          <section className="grid gap-2">
            <span className="eyebrow">{t("posTitle")}</span>
            <DataTable
              columns={positionColumns}
              rows={[invoice]}
              rowKey={(row) => row.id}
              caption={t("posTitle")}
            />
          </section>

          {/* EPC-QR-Hinweis (nur für offene Rechnungen) */}
          {invoice.status === "open" && (
            <section className="grid gap-1 rounded-lg border border-line bg-sunken/60 p-4">
              <span className="text-[13px] font-bold text-ink">{t("epcTitle")}</span>
              <p className="text-caption text-ink-soft">{t("epcBody")}</p>
            </section>
          )}

          {/* Verlauf */}
          <section className="grid gap-3">
            <span className="eyebrow">{t("histTitle")}</span>
            <ol className="grid gap-3">
              {history.map((item) => (
                <li key={item.key} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[6px] h-2 w-2 flex-none rounded-full bg-brand"
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-[13.5px] font-semibold text-ink">{item.label}</span>
                    {item.note && <span className="text-caption text-ink-soft">{item.note}</span>}
                    {item.dateIso && (
                      <span className="font-mono text-[11.5px] tabular-nums text-ink-faint">
                        {formatDateShort(item.dateIso, locale)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {log.status === "loading" && (
              <span className="text-caption text-ink-faint">{t("histLoading")}</span>
            )}
          </section>

          {/* Terminal-Hinweis, wenn keine Aktion mehr möglich ist */}
          {invoice.status === "paid" && (
            <p className="text-caption text-ink-faint">{t("terminalPaid")}</p>
          )}
          {invoice.status === "cancelled" && (
            <p className="text-caption text-ink-faint">{t("terminalCancelled")}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
