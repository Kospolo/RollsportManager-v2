"use client";

import { useState } from "react";
import { ApiError, data, errorMessage, isForbidden } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Donation } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { spendenDict } from "../i18n";

/**
 * Zuwendungsbescheinigung anzeigen, drucken und ausstellen. Der druckfertige
 * Text kommt über die Facade (data.getDonationReceipt) — die Print-Ansicht wird
 * lokal auf den Bescheinigungs-Container beschränkt (kein Eingriff in globale
 * Styles). „Als ausgestellt markieren" ruft data.markDonationIssued; danach ist
 * die Spende eingefroren (GoBD) — die Aktion wird NIE automatisch bestätigt.
 * Ein 409 (bereits ausgestellt) ist veralteter Zustand → ruhiger Toast + Reload.
 */
export function ReceiptModal({
  donation,
  onClose,
  onIssued,
}: {
  donation: Donation;
  onClose: () => void;
  onIssued: () => void;
}) {
  const t = useT(spendenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const receipt = useData((repo) => repo.getDonationReceipt(donation.id), [donation.id]);

  // Ausstellungs-Status lokal führen: nach dem Ausstellen sofort umschalten,
  // ohne die (vor dem Ausstellen geladene) Bescheinigung neu holen zu müssen.
  const [issued, setIssued] = useState<boolean>(Boolean(donation.issuedAt));
  const [submitting, setSubmitting] = useState(false);

  const markIssued = async () => {
    if (submitting || issued) return;
    setSubmitting(true);
    try {
      await data.markDonationIssued(donation.id);
      setIssued(true);
      showToast(t("issuedToast", { number: donation.receiptNumber }), { tone: "success" });
      onIssued();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setIssued(true);
        showToast(t("alreadyIssued"), { tone: "danger" });
        onIssued();
      } else {
        showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ready = receipt.status === "ready";

  return (
    <Modal
      open
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      eyebrow={t("receiptEyebrow")}
      title={t("receiptTitle", { number: donation.receiptNumber })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("receiptClose")}
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!ready}>
            {t("receiptPrint")}
          </Button>
          {ready && !issued && (
            <Button icon="check" onClick={() => void markIssued()} disabled={submitting}>
              {t("receiptIssue")}
            </Button>
          )}
        </>
      }
    >
      {/* Print-Stil: druckt NUR die Bescheinigung, flacht Farben auf Schwarz/Weiß.
          Wirkt ausschließlich im @media print — keine Bildschirm-Nebeneffekte. */}
      <style>{PRINT_CSS}</style>

      {receipt.status === "loading" && (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
      )}

      {receipt.status === "error" && (
        <p className="text-body text-danger">
          {errorMessage(receipt.error) || t("receiptLoadError")}
        </p>
      )}

      {receipt.status === "ready" && (
        <div id="rsm-donation-print" className="grid gap-4 text-ink">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <span className="eyebrow">{t("receiptIssuer")}</span>
              <b className="font-display text-h3 tracking-[-0.01em] text-ink">
                {receipt.data.clubName}
              </b>
              <span className="text-caption text-ink-faint">{t("receiptEyebrow")}</span>
            </div>
            <div className="grid justify-items-end gap-1">
              <span className="font-mono text-mono-table font-bold tabular-nums text-ink">
                {receipt.data.receiptNumber}
              </span>
              <span className="rsm-screen-only">
                {issued ? (
                  <Badge tone="success" icon="check">
                    {t("receiptStatusIssued")}
                  </Badge>
                ) : (
                  <Badge tone="warn">{t("receiptStatusDraft")}</Badge>
                )}
              </span>
            </div>
          </header>

          {!issued && (
            <p className="rsm-screen-only rounded-md border border-warn/40 bg-warn-soft/50 px-4 py-3 text-caption font-semibold text-warn">
              {t("receiptDraftNotice")}
            </p>
          )}

          <dl className="grid gap-3 rounded-md border border-line bg-sunken px-4 py-4 sm:grid-cols-2">
            <Field label={t("receiptDonor")}>
              <span className="font-semibold text-ink">{receipt.data.donorName}</span>
              {receipt.data.donorAddress && (
                <span className="mt-0.5 block text-caption text-ink-soft">
                  {receipt.data.donorAddress}
                </span>
              )}
            </Field>
            <Field label={t("receiptAmount")}>
              <span className="font-mono text-[15px] font-bold tabular-nums text-ink">
                {receipt.data.amountEur} EUR
              </span>
            </Field>
            <Field label={t("receiptDate")}>
              <span className="text-ink">{formatDateShort(receipt.data.donationDate, locale)}</span>
            </Field>
            {receipt.data.purpose && (
              <Field label={t("receiptPurpose")}>
                <span className="text-ink">{receipt.data.purpose}</span>
              </Field>
            )}
          </dl>

          <p className="rsm-print-box whitespace-pre-line rounded-md border border-line px-4 py-4 text-[13.5px] leading-relaxed text-ink">
            {receipt.data.text}
          </p>

          <div className="mt-2 grid grid-cols-2 gap-6 pt-2">
            <Signature label={t("receiptSignatureCity")} />
            <Signature label={t("receiptSignatureLabel")} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Beschriftetes Wertfeld der Bescheinigung (Definition-List-Zelle). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Unterschrifts-/Datumslinie für die gedruckte Bescheinigung. */
function Signature({ label }: { label: string }) {
  return (
    <div className="grid gap-1">
      <span className="mt-6 border-t border-ink-faint/60" aria-hidden="true" />
      <span className="text-caption text-ink-faint">{label}</span>
    </div>
  );
}

/**
 * Nur im Druck aktiv: alles ausblenden außer der Bescheinigung, Farben auf
 * Schwarz/Weiß flachen (Dark Mode druckt nicht dunkel), Bildschirm-Chrome
 * (Status-Badge, Entwurfs-Hinweis) verstecken.
 */
const PRINT_CSS = `@media print {
  @page { margin: 16mm; }
  body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #rsm-donation-print, #rsm-donation-print * {
    visibility: visible !important;
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
  }
  #rsm-donation-print {
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
    width: auto !important;
  }
  #rsm-donation-print .rsm-print-box { border-color: #000 !important; }
  #rsm-donation-print .rsm-screen-only { display: none !important; }
}`;
