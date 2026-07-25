"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatEUR } from "@/lib/format";
import { ApiError, data, errorMessage, fullName, isForbidden } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, InvoiceDetail, InvoiceItem, LedgerCategory, Member } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill, DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { invoicesDict } from "../i18n";
import { STATUS_KEY, STATUS_TONE } from "../derive";
import { Meta, SettlePanel, type ViaKey } from "./InvoiceDetailPanels";
import { InvoiceItemsEditor } from "./InvoiceItemsEditor";

type SheetMode = "view" | "settle" | "cancel" | "issue" | "editItems";

/** Ein Verlaufseintrag der Rechnung (ausgestellt → Mahnungen → bezahlt/storniert). */
type HistoryItem = { key: string; label: string; note?: string; dateIso?: string };

/**
 * Rechnungs-Detail als seitliches Sheet: Empfänger, echte Positionen (mit MwSt),
 * Verlauf (inkl. Mahnprotokoll) und die Aktionen — je nach Status:
 *  • Entwurf: Positionen bearbeiten, ausstellen (Entwurf → offen), stornieren.
 *  • Offen: als bezahlt markieren, stornieren.
 *  • Bezahlt/Storniert: terminal (GoBD, kein Re-Open).
 * „Als PDF / Drucken" öffnet die Druckansicht (Briefkopf + Fusszeile) in einem
 * neuen Tab — dort macht der Nutzer Cmd+P → als PDF speichern.
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
  /** Aktualisierte Rechnung nach bezahlt/storniert/ausgestellt/Positionsänderung. */
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
  const [items, setItems] = useState<InvoiceItem[] | null>(null);

  const log = useData(
    (repo) => repo.listDunningLog(clubId, { invoiceId: invoice.id }),
    [clubId, invoice.id],
  );

  const loadedItems = useData(
    (repo) => repo.listInvoiceItems(clubId, invoice.id),
    [clubId, invoice.id],
  );

  const settings = useData((repo) => repo.getInvoiceSettings(clubId), [clubId]);

  /** Optimistisch überlagerte Positionen (nach dem Bearbeiten) oder die geladenen. */
  const currentItems = useMemo<InvoiceItem[]>(
    () => items ?? (loadedItems.status === "ready" ? loadedItems.data : []),
    [items, loadedItems],
  );

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.kind === "income"),
    [categories],
  );

  const history = useMemo<HistoryItem[]>(() => {
    const list: HistoryItem[] = [
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
      list.push({
        key: entry.id,
        label: t(key, { stage }),
        note: entry.note,
        dateIso: entry.createdAt.slice(0, 10),
      });
    }
    if (invoice.status === "paid") {
      const viaSuffix = invoice.paidVia ? t("histPaidVia", { via: invoice.paidVia }) : "";
      list.push({ key: "paid", label: t("histPaid", { via: viaSuffix }), dateIso: invoice.paidAt });
    }
    if (invoice.status === "cancelled") {
      list.push({ key: "cancelled", label: t("histCancelled") });
    }
    return list.sort((a, b) => (a.dateIso ?? "9999").localeCompare(b.dateIso ?? "9999"));
  }, [invoice, log, t]);

  const hasItems = currentItems.length > 0;
  const itemSums = useMemo(() => {
    let net = 0;
    let vat = 0;
    for (const it of currentItems) {
      net += it.netCents;
      vat += it.vatCents;
    }
    return { net, vat, gross: net + vat };
  }, [currentItems]);

  const isDraft = invoice.status === "draft";
  const canMarkPaid = invoice.status === "open";
  const canCancel = invoice.status === "open" || isDraft;

  const printHref = `/finanzen/rechnungen/${invoice.id}/druck`;

  const positionColumns: Column<InvoiceItem>[] = [
    {
      id: "desc",
      header: t("posColDesc"),
      cell: (row) => <span className="text-[13.5px] text-ink">{row.description}</span>,
      footer: <span className="font-bold text-ink-soft">{t("posSumGross")}</span>,
    },
    {
      id: "qty",
      header: t("posColQty"),
      mono: true,
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatQty(row.quantity, locale)}</span>,
    },
    {
      id: "unit",
      header: t("posColUnit"),
      mono: true,
      align: "right",
      cell: (row) => formatEUR(row.unitPriceCents, locale),
    },
    {
      id: "vat",
      header: t("posColVat"),
      mono: true,
      align: "right",
      cell: (row) => `${formatQty(row.vatRate, locale)} %`,
    },
    {
      id: "gross",
      header: t("posColGross"),
      mono: true,
      align: "right",
      cell: (row) => formatEUR(row.grossCents, locale),
      footer: formatEUR(invoice.amountCents, locale),
    },
  ];

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
      showToast(settleError(caught, t), { tone: "danger" });
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

  const doIssue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await data.issueInvoice(invoice.id);
      onChanged(updated);
      showToast(t("issueToast", { number: invoice.number }), { tone: "success" });
      setMode("view");
    } catch (caught) {
      const msg =
        caught instanceof ApiError && caught.status === 409
          ? t("issueNotDraft")
          : isForbidden(caught)
            ? t("forbidden")
            : errorMessage(caught);
      showToast(msg, { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const openPrint = () => window.open(printHref, "_blank", "noopener");

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
    ) : mode === "issue" ? (
      <>
        <Button variant="ghost" onClick={() => setMode("view")} disabled={busy}>
          {t("issueBack")}
        </Button>
        <Button icon="check" onClick={doIssue} disabled={busy}>
          {t("issueConfirm")}
        </Button>
      </>
    ) : mode === "editItems" ? (
      <Button onClick={() => setMode("view")} disabled={busy}>
        {t("cCancel")}
      </Button>
    ) : canMarkPaid || canCancel || isDraft ? (
      <>
        {canCancel && (
          <Button variant="ghost" onClick={() => setMode("cancel")}>
            {t("actionCancel")}
          </Button>
        )}
        {isDraft && (
          <Button icon="check" onClick={() => setMode("issue")}>
            {t("actionIssue")}
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
    <Sheet open onClose={onClose} eyebrow={t("detEyebrow")} title={invoice.title} footer={footer}>
      {/* Betrag + Status + Nummer (mono) */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-5">
        <span className="font-mono text-[24px] font-bold tabular-nums text-ink">
          {formatEUR(invoice.amountCents, locale)}
        </span>
        <StatusPill tone={STATUS_TONE[invoice.status]}>{t(STATUS_KEY[invoice.status])}</StatusPill>
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

      {mode === "issue" && (
        <div className="mb-5 grid gap-2 rounded-lg border border-info/40 bg-info-soft/40 p-4">
          <p className="text-[14px] font-bold text-ink">{t("actionIssue")}</p>
          <p className="text-[13px] text-ink-soft">{t("issueHint")}</p>
        </div>
      )}

      {mode === "editItems" && (
        <InvoiceItemsEditor
          clubId={clubId}
          invoiceId={invoice.id}
          items={currentItems}
          defaultVatRate={settings.status === "ready" ? settings.data.defaultVatRate : 0}
          onItemsChanged={setItems}
          onInvoiceChanged={onChanged}
        />
      )}

      {mode === "view" && (
        <div className="grid gap-6">
          {/* Sekundäre Aktionen: Drucken + (Entwurf) Positionen bearbeiten */}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon="download" onClick={openPrint}>
              {t("actionPrint")}
            </Button>
            {isDraft && (
              <Button variant="ghost" size="sm" icon="edit" onClick={() => setMode("editItems")}>
                {t("posEditTitle")}
              </Button>
            )}
          </div>

          {isDraft && (
            <div className="rounded-lg border border-line bg-sunken/60 px-4 py-2.5">
              <span className="text-[13px] font-semibold text-ink-soft">{t("draftBanner")}</span>
            </div>
          )}

          {/* Empfänger */}
          <section className="grid gap-2">
            <span className="eyebrow">{t("detRecipient")}</span>
            <span className="flex items-center gap-3">
              {member ? (
                <>
                  <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-[14px] font-bold text-ink">{fullName(member)}</span>
                    <span className="truncate text-caption text-ink-faint">{member.email ?? "—"}</span>
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
            {invoice.status === "partially_paid" && (
              <>
                <Meta label={t("detPaidAmount")} value={formatEUR(invoice.paidCents ?? 0, locale)} />
                <Meta
                  label={t("detOpenAmount")}
                  value={formatEUR(invoice.openCents ?? invoice.amountCents, locale)}
                />
              </>
            )}
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
            {loadedItems.status === "loading" && !items ? (
              <span className="text-caption text-ink-faint">{t("posLoading")}</span>
            ) : hasItems ? (
              <>
                <div className="-mx-1 overflow-x-auto px-1">
                  <DataTable
                    columns={positionColumns}
                    rows={currentItems}
                    rowKey={(row) => row.id}
                    caption={t("posTitle")}
                  />
                </div>
                <dl className="grid gap-1 rounded-lg border border-line bg-sunken/40 p-3 text-[13px]">
                  <SummaryLine label={t("posSumNet")} value={formatEUR(itemSums.net, locale)} />
                  <SummaryLine label={t("posSumVat")} value={formatEUR(itemSums.vat, locale)} />
                  <SummaryLine label={t("posSumGross")} value={formatEUR(itemSums.gross, locale)} strong />
                </dl>
              </>
            ) : (
              <p className="text-[13px] text-ink-soft">{t("posNoItems")}</p>
            )}
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
                  <span aria-hidden="true" className="mt-[6px] h-2 w-2 flex-none rounded-full bg-brand" />
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

/* ------------------------------------------------------------------ */

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-bold text-ink" : "text-ink-soft"}>{label}</dt>
      <dd className={`font-mono tabular-nums ${strong ? "font-bold text-ink" : "text-ink-soft"}`}>
        {value}
      </dd>
    </div>
  );
}

/** Menge/Prozent hübsch (1 statt 1,000; 1,5 bleibt 1,5) — locale-Dezimaltrenner. */
function formatQty(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
}

function settleError(caught: unknown, t: (key: "settleNotOpen" | "forbidden") => string): string {
  if (caught instanceof ApiError && caught.status === 409) return t("settleNotOpen");
  if (isForbidden(caught)) return t("forbidden");
  return errorMessage(caught);
}
