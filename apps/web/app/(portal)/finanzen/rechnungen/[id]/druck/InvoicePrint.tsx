"use client";

import Link from "next/link";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateShort, formatEUR } from "@/lib/format";
import { errorMessage, fullName, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { InvoiceItem } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { invoicesDict } from "../../i18n";

/**
 * Druckoptimierte Rechnungsansicht. Isoliert sich beim Drucken vom Portal-Rahmen
 * über eine reine @media-print-Regel (alles unsichtbar, nur der Beleg sichtbar) —
 * die App-Shell wird dafür NICHT verändert. Farben im Beleg sind bewusst fest
 * (weißer Grund, dunkle Schrift), damit der Ausdruck unabhängig vom Theme stimmt.
 */
export function InvoicePrint({ id }: { id: string }) {
  const t = useT(invoicesDict);
  const { locale } = useLocale();

  const loaded = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    const invoice = await repo.getInvoice(id);
    const [items, settings, member] = await Promise.all([
      repo.listInvoiceItems(invoice.clubId, invoice.id),
      repo.getInvoiceSettings(invoice.clubId),
      repo.getMemberById(invoice.memberId),
    ]);
    return { currentUser, invoice, items, settings, member };
  }, [id]);

  if (loaded.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loaded.status === "error") {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <EmptyState icon="zap" title={t("printNotFound")} body={errorMessage(loaded.error)} />
      </div>
    );
  }

  const { currentUser, invoice, items, settings, member } = loaded.data;

  if (!permissions(currentUser).canManageFinance) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <EmptyState icon="lock" title={t("forbidden")} body={t("forbiddenBody")} />
      </div>
    );
  }

  const hasItems = items.length > 0;
  const net = items.reduce((s, it) => s + it.netCents, 0);
  const vat = items.reduce((s, it) => s + it.vatCents, 0);

  return (
    <>
      {/* Druck-Isolation: nur der Beleg wird gedruckt, nicht die App-Shell. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Werkzeugleiste — nur am Bildschirm */}
      <div className="rsm-print-hide mx-auto mb-4 flex w-full max-w-3xl items-center justify-between gap-3 px-6 pt-6">
        <Link
          href="/finanzen/rechnungen"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-soft no-underline hover:text-ink"
        >
          <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
          {t("printBack")}
        </Link>
        <Button icon="download" onClick={() => window.print()}>
          {t("printBtn")}
        </Button>
      </div>

      {/* Der Beleg */}
      <div id="rsm-invoice-print" className="rsm-invoice-doc">
        <header className="rsm-doc-head">
          <div className="rsm-sender">
            {settings.senderBlock ? (
              <pre className="rsm-sender-block">{settings.senderBlock}</pre>
            ) : (
              <span className="rsm-sender-fallback">{t("printNoSettingsHint")}</span>
            )}
          </div>
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="rsm-logo" />
          ) : null}
        </header>

        <section className="rsm-parties">
          <div className="rsm-recipient">
            <span className="rsm-label">{t("printBillTo")}</span>
            <span className="rsm-recipient-name">{member ? fullName(member) : t("unknownMember")}</span>
            {member?.email && <span className="rsm-recipient-line">{member.email}</span>}
          </div>
          <dl className="rsm-meta">
            <MetaRow label={t("printNumberLabel")} value={invoice.number} mono />
            <MetaRow label={t("printDateLabel")} value={formatDateShort(invoice.issuedAt, locale)} />
            <MetaRow label={t("printDueLabel")} value={formatDateShort(invoice.dueAt, locale)} />
          </dl>
        </section>

        <h1 className="rsm-subject">{invoice.title}</h1>

        <table className="rsm-table">
          <thead>
            <tr>
              <th className="rsm-col-pos">{t("printColPos")}</th>
              <th className="rsm-col-desc">{t("printColDesc")}</th>
              {hasItems && <th className="rsm-num">{t("printColQty")}</th>}
              {hasItems && <th className="rsm-num">{t("printColUnit")}</th>}
              {hasItems && <th className="rsm-num">{t("printColVat")}</th>}
              <th className="rsm-num">{t("printColGross")}</th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              items.map((it, idx) => (
                <PrintItemRow key={it.id} index={idx + 1} item={it} locale={locale} />
              ))
            ) : (
              <tr>
                <td className="rsm-col-pos">1</td>
                <td className="rsm-col-desc">{invoice.title}</td>
                <td className="rsm-num">{formatEUR(invoice.amountCents, locale)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="rsm-totals">
          {hasItems && (
            <>
              <TotalRow label={t("printSumNet")} value={formatEUR(net, locale)} />
              <TotalRow label={t("printSumVat")} value={formatEUR(vat, locale)} />
            </>
          )}
          <TotalRow label={t("printSumGross")} value={formatEUR(invoice.amountCents, locale)} strong />
        </div>

        {/* Steuer- + Bankangaben */}
        {(settings.taxNumber || settings.vatId || settings.iban) && (
          <section className="rsm-pay">
            {(settings.taxNumber || settings.vatId) && (
              <div className="rsm-taxes">
                {settings.taxNumber && (
                  <span>
                    {t("printTaxNumber")}: {settings.taxNumber}
                  </span>
                )}
                {settings.vatId && (
                  <span>
                    {t("printVatId")}: {settings.vatId}
                  </span>
                )}
              </div>
            )}
            {settings.iban && (
              <div className="rsm-bank">
                <span className="rsm-label">{t("printBankTitle")}</span>
                {settings.bankName && (
                  <span>
                    {t("printBankName")}: {settings.bankName}
                  </span>
                )}
                <span>
                  {t("printIban")}: {settings.iban}
                </span>
                {settings.bic && (
                  <span>
                    {t("printBic")}: {settings.bic}
                  </span>
                )}
                {settings.accountHolder && (
                  <span>
                    {t("printAccountHolder")}: {settings.accountHolder}
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        <p className="rsm-thanks">{t("printThanks")}</p>

        {(settings.footerText || settings.boardMembers) && (
          <footer className="rsm-doc-foot">
            {settings.boardMembers && <div className="rsm-board">{settings.boardMembers}</div>}
            {settings.footerText && <pre className="rsm-footer-text">{settings.footerText}</pre>}
          </footer>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function PrintItemRow({ index, item, locale }: { index: number; item: InvoiceItem; locale: Locale }) {
  const qty = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(item.quantity);
  const rate = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.vatRate);
  return (
    <tr>
      <td className="rsm-col-pos">{index}</td>
      <td className="rsm-col-desc">{item.description}</td>
      <td className="rsm-num">{qty}</td>
      <td className="rsm-num">{formatEUR(item.unitPriceCents, locale)}</td>
      <td className="rsm-num">{rate} %</td>
      <td className="rsm-num">{formatEUR(item.grossCents, locale)}</td>
    </tr>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rsm-meta-row">
      <dt>{label}</dt>
      <dd className={mono ? "rsm-mono" : undefined}>{value}</dd>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rsm-total-row${strong ? " rsm-total-strong" : ""}`}>
      <span>{label}</span>
      <span className="rsm-mono">{value}</span>
    </div>
  );
}

// Beleg-eigenes CSS: feste Papierfarben + Druck-Isolation. Bewusst als globaler
// <style>-Block (kein styled-jsx-Scoping), damit die @media-print-Regel den
// gesamten Rahmen unsichtbar schalten kann, ohne die App-Shell zu verändern.
const PRINT_CSS = `
.rsm-invoice-doc {
  --ink: #1a1a1a; --muted: #555; --line: #d8d8d8;
  color: var(--ink);
  background: #fff;
  max-width: 190mm;
  margin: 0 auto 3rem;
  padding: 14mm 16mm;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
}
.rsm-invoice-doc pre { font: inherit; white-space: pre-wrap; margin: 0; }
.rsm-doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
.rsm-sender-block { font-size: 12px; color: var(--ink); }
.rsm-sender-fallback { font-size: 11px; color: #b23; }
.rsm-logo { max-height: 64px; max-width: 200px; object-fit: contain; }
.rsm-parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
.rsm-label { display: block; text-transform: uppercase; letter-spacing: .05em; font-size: 9.5px; color: var(--muted); margin-bottom: 3px; }
.rsm-recipient-name { display: block; font-weight: 700; font-size: 13px; }
.rsm-recipient-line { display: block; color: var(--muted); }
.rsm-meta { min-width: 180px; }
.rsm-meta-row { display: flex; justify-content: space-between; gap: 16px; }
.rsm-meta-row dt { color: var(--muted); }
.rsm-meta-row dd { margin: 0; font-weight: 600; }
.rsm-mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.rsm-subject { font-size: 15px; font-weight: 700; margin: 8px 0 14px; }
.rsm-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
.rsm-table th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); border-bottom: 1.5px solid var(--line); padding: 0 6px 6px; }
.rsm-table td { padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.rsm-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rsm-col-pos { width: 34px; color: var(--muted); }
.rsm-col-desc { width: auto; }
.rsm-totals { margin-left: auto; width: 240px; }
.rsm-total-row { display: flex; justify-content: space-between; gap: 16px; padding: 3px 6px; }
.rsm-total-strong { border-top: 1.5px solid var(--line); margin-top: 4px; padding-top: 7px; font-weight: 700; font-size: 13px; }
.rsm-pay { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--line); }
.rsm-taxes, .rsm-bank { display: grid; gap: 2px; color: var(--ink); }
.rsm-thanks { margin-top: 18px; color: var(--muted); }
.rsm-doc-foot { margin-top: 22px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 10.5px; color: var(--muted); display: grid; gap: 6px; }
.rsm-footer-text { font-size: 10.5px; }
@media print {
  body * { visibility: hidden !important; }
  #rsm-invoice-print, #rsm-invoice-print * { visibility: visible !important; }
  #rsm-invoice-print { position: absolute; inset: 0; margin: 0; border: 0; border-radius: 0; padding: 0; max-width: none; }
  .rsm-print-hide { display: none !important; }
  @page { size: A4; margin: 16mm; }
}
`;
