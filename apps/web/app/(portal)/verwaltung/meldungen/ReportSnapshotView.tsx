"use client";

import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { ChatReportSnapshot, ChatReportSnapshotMessage, Id } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { meldungenDict } from "./i18n";

/**
 * Rendert den serverseitig aufgenommenen Snapshot einer Meldung: die
 * gemeldete Nachricht plus ein paar Kontextnachrichten, chronologisch. Die
 * gemeldete Nachricht ist mit „Gemeldet" markiert. Genutzt von der Detail-
 * Ansicht UND der Druckansicht — deshalb ohne eigenen Rahmen.
 *
 * `plain` schaltet die App-Farben ab (feste Papierfarben) für den Ausdruck.
 */
export function ReportSnapshotView({
  snapshot,
  reportedMessageId,
  nameOf,
  plain = false,
}: {
  snapshot: ChatReportSnapshot;
  reportedMessageId?: Id;
  nameOf: (id: Id) => string;
  plain?: boolean;
}) {
  const t = useT(meldungenDict);
  const { locale } = useLocale();

  // Der Kontext enthält die gemeldete Nachricht in der Regel bereits; fehlt er,
  // zeigen wir wenigstens die gemeldete Nachricht selbst.
  const rows: ChatReportSnapshotMessage[] =
    snapshot.context.length > 0
      ? snapshot.context
      : snapshot.message
        ? [snapshot.message]
        : [];

  const targetId = reportedMessageId ?? snapshot.message?.id;

  return (
    <ol className={plain ? "rsm-snap" : "grid gap-2"}>
      {rows.map((m) => {
        const isTarget = m.id === targetId;
        return (
          <li
            key={m.id}
            className={
              plain
                ? `rsm-snap-row${isTarget ? " rsm-snap-target" : ""}`
                : `rounded-lg border p-2.5 ${
                    isTarget ? "border-danger/40 bg-danger-soft/40" : "border-line bg-sunken"
                  }`
            }
          >
            <div className={plain ? "rsm-snap-head" : "flex items-center justify-between gap-2"}>
              <b
                className={
                  plain ? "rsm-snap-name" : "font-display text-[12.5px] font-bold text-ink"
                }
              >
                {nameOf(m.senderMemberId)}
              </b>
              <span className={plain ? "rsm-snap-time" : "flex items-center gap-2"}>
                {isTarget && !plain && <Badge tone="danger">{t("reportedMessageBadge")}</Badge>}
                {isTarget && plain && <span className="rsm-snap-flag">{t("reportedMessageBadge")}</span>}
                <time
                  dateTime={m.createdAt}
                  className={plain ? undefined : "whitespace-nowrap text-[11px] text-ink-faint"}
                >
                  {formatDateTime(m.createdAt, locale)}
                </time>
              </span>
            </div>
            {m.body ? (
              <p
                className={
                  plain
                    ? "rsm-snap-body"
                    : "mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-[20px] text-ink"
                }
              >
                {m.body}
              </p>
            ) : (
              <p className={plain ? "rsm-snap-empty" : "mt-1 text-[13px] italic text-ink-faint"}>
                {t("noBody")}
              </p>
            )}
            {m.imageUrl && (
              <p className={plain ? "rsm-snap-img" : "mt-1 text-[12px] font-semibold text-ink-soft"}>
                {t("imageAttached")}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
