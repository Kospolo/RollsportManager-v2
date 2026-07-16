"use client";

import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { data, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { joinRequestsDict } from "./i18n-beitritte";

/**
 * Beitrittsantraege — die Freigabe-Liste des Vorstands.
 *
 * ### Was hier passiert, ist der ganze Sinn des Vereinscodes ###
 * Wer den Code kennt, steht in dieser Liste — und sonst NIRGENDS: eine
 * Mitgliedschaft mit status='pending' liefert ein leeres Rollen-Array
 * (app.member_role_keys, 0025) und faellt damit durch jede Policy. Diese Karte
 * ist die Tuer, und der Klick auf „Freigeben" ist der Schluessel.
 *
 * Die Freigabe wirkt SOFORT, ohne dass die freigegebene Person sich neu
 * anmelden muss: die Datenbank loest Rollen bei jeder Anfrage neu auf, statt
 * sie aus dem Token zu lesen.
 *
 * Ablehnen wird NICHT automatisch bestaetigt und ist bewusst kein Loeschen im
 * Wortsinn: der Antrag wird soft-geloescht, die Person darf erneut fragen.
 */
export function JoinRequestsCard({
  canManage,
  onChanged,
}: {
  canManage: boolean;
  /**
   * Laedt den Roster der Elternseite neu. Ohne das bliebe die freigegebene
   * Person in der Tabelle darunter auf "Ausstehend" stehen, obwohl sie laengst
   * aktiv ist — die Karte laedt sonst nur ihre EIGENE Liste neu.
   */
  onChanged: () => void;
}) {
  const t = useT(joinRequestsDict);
  const { locale } = useLocale();
  const requests = useData((repo) => repo.getPendingJoinRequests());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  // Ohne das Recht keine Liste: sie zu zeigen und die Knoepfe zu sperren waere
  // eine Auskunft ueber Leute, die es nichts angeht.
  if (!canManage) return null;
  if (requests.status === "loading") return <Skeleton className="h-28" />;
  if (requests.status === "error") return null;
  if (requests.data.length === 0) return null;

  async function act(memberId: string, kind: "approve" | "reject") {
    setBusy(memberId);
    setError(null);
    try {
      if (kind === "approve") await data.approveJoinRequest(memberId);
      else await data.rejectJoinRequest(memberId);
      setConfirmReject(null);
      requests.reload();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="grid gap-0 border-brand/40">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")}
            <Badge tone="warn">{requests.data.length}</Badge>
          </span>
        }
      />
      <p className="px-5 pb-3 -mt-2 text-[13px] text-ink-soft">{t("sub")}</p>

      {error ? (
        <p role="alert" className="px-5 pb-2 text-[13px] font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-0 border-t border-line">
        {requests.data.map((r) => (
          <li
            key={r.memberId}
            className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
          >
            <Avatar personId={r.memberId} firstName={r.firstName} lastName={r.lastName} size="m" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-display text-[15px] font-bold text-ink">
                {r.firstName} {r.lastName}
              </span>
              <span className="text-[13px] text-ink-soft">
                {t("requestedAt", { date: formatDateShort(r.requestedAt, locale) })}
              </span>
            </div>

            {confirmReject === r.memberId ? (
              // Ablehnen wird nie still ausgefuehrt — erst fragen, dann handeln.
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink-soft">{t("rejectSure")}</span>
                <Button
                  variant="danger"
                  disabled={busy === r.memberId}
                  onClick={() => act(r.memberId, "reject")}
                >
                  {t("rejectConfirm")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReject(null)}>
                  {t("cancel")}
                </Button>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={busy === r.memberId}
                  onClick={() => setConfirmReject(r.memberId)}
                >
                  {t("reject")}
                </Button>
                <Button disabled={busy === r.memberId} onClick={() => act(r.memberId, "approve")}>
                  <Icon name="check" className="ic h-4 w-4" />
                  {busy === r.memberId ? t("approving") : t("approve")}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="px-5 py-3 text-[12px] leading-relaxed text-ink-faint">{t("footnote")}</p>
    </Card>
  );
}
