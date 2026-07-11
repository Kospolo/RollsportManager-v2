"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutineShare } from "@/lib/types";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { kuerenDict } from "../../i18n";

/**
 * Kür teilen (nur Trainer:innen — serverseitig is_club_trainer, hier reine
 * Sichtbarkeit). Erzeugt über die Facade (createRoutineShare) einen öffentlichen
 * Token-Link `/wettkampf/kuer/{token}`, den man kopieren, per WhatsApp/E-Mail
 * teilen, öffnen und wieder widerrufen kann (wie v1 kuer-share.html, aber ohne
 * externe QR-Bibliothek). Der Server liefert keinen Listen-Endpoint; die Facade
 * hält die in dieser Session erstellten Links (listRoutineShares).
 *
 * Die öffentliche Zielseite zeigt NUR unkritische Daten (Titel, Musik, Marker,
 * Wertungen) — keine Namen/Kontakt/Finanzen; das gehört zur öffentlichen Route.
 */

type Expiry = "never" | "1day" | "7days" | "30days";

const EXPIRY_DAYS: Record<Expiry, number | null> = {
  never: null,
  "1day": 1,
  "7days": 7,
  "30days": 30,
};

const EXPIRY_KEY: Record<Expiry, "expiryNever" | "expiry1day" | "expiry7days" | "expiry30days"> = {
  never: "expiryNever",
  "1day": "expiry1day",
  "7days": "expiry7days",
  "30days": "expiry30days",
};

/** Ablaufdatum als ISO8601 aus der Auswahl (undefined = läuft nie ab). */
function expiresAtIso(expiry: Expiry): string | undefined {
  const days = EXPIRY_DAYS[expiry];
  if (days == null) return undefined;
  const at = new Date();
  at.setDate(at.getDate() + days);
  return at.toISOString();
}

/** Relativen Facade-Pfad zur vollen Teilen-URL zusammensetzen (Copy/QR/WhatsApp). */
function fullShareUrl(share: RoutineShare): string {
  if (typeof window === "undefined") return share.url;
  return `${window.location.origin}${share.url}`;
}

export function ShareRoutineDialog({
  routineId,
  routineTitle,
  open,
  onClose,
}: {
  routineId: string;
  routineTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [shares, setShares] = useState<RoutineShare[]>([]);
  const [expiry, setExpiry] = useState<Expiry>("never");
  const [creating, setCreating] = useState(false);

  /* Beim Öffnen die in dieser Session erstellten Links laden. */
  useEffect(() => {
    if (!open) return;
    let active = true;
    data
      .listRoutineShares(routineId)
      .then((list) => {
        if (active) setShares(list);
      })
      .catch(() => {
        if (active) showToast(t("shareLoadError"), { tone: "danger" });
      });
    return () => {
      active = false;
    };
  }, [open, routineId, showToast, t]);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const share = await data.createRoutineShare(routineId, expiresAtIso(expiry));
      setShares((current) => [...current.filter((s) => s.token !== share.token), share]);
      showToast(t("shareCreated"), { tone: "success" });
    } catch (error) {
      showToast(isForbidden(error) ? t("shareNoPermission") : errorMessage(error), {
        tone: "danger",
      });
    } finally {
      setCreating(false);
    }
  }, [routineId, expiry, showToast, t]);

  const copy = useCallback(
    async (share: RoutineShare) => {
      try {
        await navigator.clipboard.writeText(fullShareUrl(share));
        showToast(t("shareCopied"), { tone: "success" });
      } catch {
        showToast(t("shareCopyFailed"), { tone: "danger" });
      }
    },
    [showToast, t],
  );

  const revoke = useCallback(
    async (token: string) => {
      try {
        await data.revokeRoutineShare(routineId, token);
        setShares((current) => current.filter((s) => s.token !== token));
        showToast(t("shareRevoked"), { tone: "success" });
      } catch (error) {
        showToast(isForbidden(error) ? t("shareNoPermission") : t("shareRevokeFailed"), {
          tone: "danger",
        });
      }
    },
    [routineId, showToast, t],
  );

  const shareWhatsApp = (share: RoutineShare) => {
    const text = t("shareWhatsAppText", { url: fullShareUrl(share) });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareEmail = (share: RoutineShare) => {
    const subject = encodeURIComponent(t("shareEmailSubject", { title: routineTitle }));
    const body = encodeURIComponent(t("shareEmailBody", { url: fullShareUrl(share) }));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openLink = (share: RoutineShare) => {
    window.open(fullShareUrl(share), "_blank", "noopener,noreferrer");
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("shareEyebrow")} title={t("shareTitle")}>
      <div className="grid gap-5">
        <p className="text-body text-ink-soft">{t("shareIntro")}</p>

        {/* Gültigkeit + Link erstellen */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-caption font-semibold text-ink-soft">{t("shareExpiryLabel")}</span>
            <select
              value={expiry}
              onChange={(event) => setExpiry(event.target.value as Expiry)}
              className="min-h-11 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink"
            >
              {(Object.keys(EXPIRY_DAYS) as Expiry[]).map((key) => (
                <option key={key} value={key}>
                  {t(EXPIRY_KEY[key])}
                </option>
              ))}
            </select>
          </label>
          <Button icon="link" onClick={create} disabled={creating}>
            {creating ? t("shareCreating") : t("shareCreate")}
          </Button>
        </div>

        {/* Erstellte Links */}
        {shares.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
            <p className="font-display text-h3 tracking-[-0.01em] text-ink">{t("shareEmptyTitle")}</p>
            <p className="mt-1 text-body text-ink-soft">{t("shareEmptyBody")}</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {shares.map((share) => (
              <ShareRow
                key={share.token}
                share={share}
                url={fullShareUrl(share)}
                expiresLabel={
                  share.expiresAt
                    ? t("shareExpiresOn", { date: formatDateShort(share.expiresAt, locale) })
                    : t("shareNeverExpires")
                }
                labels={{
                  linkLabel: t("shareLinkLabel"),
                  copy: t("shareCopy"),
                  whatsApp: t("shareWhatsApp"),
                  email: t("shareEmail"),
                  openLink: t("shareOpen"),
                  revoke: t("shareRevoke"),
                }}
                onCopy={() => copy(share)}
                onWhatsApp={() => shareWhatsApp(share)}
                onEmail={() => shareEmail(share)}
                onOpen={() => openLink(share)}
                onRevoke={() => revoke(share.token)}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Eine Link-Zeile: URL-Feld + Aktionen (Kopieren/WhatsApp/E-Mail/Öffnen/Widerrufen). */
function ShareRow({
  url,
  expiresLabel,
  labels,
  onCopy,
  onWhatsApp,
  onEmail,
  onOpen,
  onRevoke,
}: {
  share: RoutineShare;
  url: string;
  expiresLabel: string;
  labels: {
    linkLabel: string;
    copy: string;
    whatsApp: string;
    email: string;
    openLink: string;
    revoke: string;
  };
  onCopy: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onOpen: () => void;
  onRevoke: () => void;
}) {
  return (
    <li className="grid gap-3 rounded-lg border border-line bg-sunken p-3.5">
      <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2">
        <Icon name="link" className="ic h-4 w-4 flex-none text-ink-faint" />
        <input
          readOnly
          aria-label={labels.linkLabel}
          value={url}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 truncate bg-transparent font-mono text-[13px] text-ink outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon="copy" onClick={onCopy}>
          {labels.copy}
        </Button>
        <Button size="sm" variant="ghost" onClick={onWhatsApp}>
          {labels.whatsApp}
        </Button>
        <Button size="sm" variant="ghost" icon="mail" onClick={onEmail}>
          {labels.email}
        </Button>
        <Button size="sm" variant="ghost" icon="globe" onClick={onOpen}>
          {labels.openLink}
        </Button>
        <Button size="sm" variant="danger" icon="trash" className="ml-auto" onClick={onRevoke}>
          {labels.revoke}
        </Button>
      </div>
      <p className="text-caption text-ink-faint">{expiresLabel}</p>
    </li>
  );
}
