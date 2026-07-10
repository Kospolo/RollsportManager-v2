"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { fullName, memberById } from "@/lib/data";
import type { DunningLogAction, DunningLogEntry, InvoiceDetail, Member } from "@/lib/types";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/shell/icons";
import { mahnungenDict, type MahnungenKey } from "../i18n";

/**
 * Mahnprotokoll (Historie) — unveränderliche Eskalations-Chronik (GoBD).
 * Newest first (die Facade sortiert bereits). Jede Zeile trägt Aktion (Chip),
 * Rechnung + Mitglied, Stufen-Übergang, Notiz, Zeitpunkt und ausführende
 * Person. Reines Lesen: append-only, keine Bearbeitung/Löschung.
 */

/** Aktion → Chip-Ton + Icon + i18n-Label-Key (Wort UND Farbe, DESIGN §3.6). */
const ACTION_META: Record<
  DunningLogAction,
  { tone: BadgeTone; icon: IconName; key: MahnungenKey }
> = {
  reminder: { tone: "info", icon: "bell", key: "actionReminder" },
  dunning: { tone: "warn", icon: "mail", key: "actionDunning" },
  handover: { tone: "danger", icon: "shield", key: "actionHandover" },
};

export function MahnHistoryCard({
  log,
  invoices,
  members,
}: {
  log: DunningLogEntry[];
  invoices: InvoiceDetail[];
  members: Member[];
}) {
  const t = useT(mahnungenDict);
  const { locale } = useLocale();

  const invoiceById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  return (
    <Card>
      <CardHeader
        eyebrow={t("historyEyebrow")}
        title={t("historyTitle")}
        action={
          log.length > 0 ? (
            <span className="text-[13.5px] text-ink-soft tabular-nums">
              {t("historyCount", { n: log.length })}
            </span>
          ) : undefined
        }
      />

      {log.length === 0 ? (
        <div className="grid justify-items-start gap-1 rounded-lg border border-dashed border-line bg-canvas px-4 py-6">
          <b className="text-[14px] font-bold text-ink">{t("historyEmptyTitle")}</b>
          <p className="text-[13.5px] text-ink-faint">{t("historyEmptyBody")}</p>
        </div>
      ) : (
        <>
          <ol className="grid list-none gap-3">
            {log.map((entry) => {
              const invoice = invoiceById.get(entry.invoiceId);
              const member = invoice ? memberById(members, invoice.memberId) : undefined;
              const actor = entry.actorMemberId
                ? memberById(members, entry.actorMemberId)
                : undefined;
              const meta = ACTION_META[entry.action];
              const stage =
                entry.fromStage != null
                  ? t("historyStage", { from: entry.fromStage, to: entry.toStage ?? 0 })
                  : t("historyStageTo", { to: entry.toStage ?? 0 });

              return (
                <li
                  key={entry.id}
                  className="grid gap-2 rounded-lg border border-line bg-canvas p-4"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={meta.tone} icon={meta.icon}>
                      {t(meta.key)}
                    </Badge>
                    <span className="font-mono text-[12.5px] font-bold tabular-nums text-ink-soft">
                      {stage}
                    </span>
                    <span className="ml-auto text-caption text-ink-faint tabular-nums">
                      {formatDateTime(entry.createdAt, locale)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-bold text-ink">
                      {member ? fullName(member) : "—"}
                    </span>
                    {invoice && (
                      <span className="font-mono text-[11.5px] tabular-nums text-ink-faint">
                        {invoice.number}
                      </span>
                    )}
                    <span className="text-caption text-ink-faint">
                      {t("historyBy", { name: actor ? fullName(actor) : t("historySystem") })}
                    </span>
                  </div>

                  {entry.note && (
                    <p className="border-l-2 border-line-strong pl-3 text-[13px] italic text-ink-soft">
                      {entry.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          <CardFooter>
            <span className="flex items-center gap-1.5">
              <Icon name="lock" className="ic h-[14px] w-[14px] flex-none" />
              {t("historyImmutable")}
            </span>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
