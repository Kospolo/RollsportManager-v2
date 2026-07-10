"use client";

import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatEUR, relativeDays } from "@/lib/format";
import { fullName } from "@/lib/mock";
import type { Guardianship, Invoice, Member } from "@/lib/types";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar, type ProgressTone } from "@/components/ui/ProgressBar";
import { Sparkline } from "@/components/ui/Sparkline";
import { mitgliederDict, type MitgliederKey } from "../i18n";
import {
  attendanceStats,
  childrenOf,
  guardiansOf,
  invoicesOf,
  openSumCentsOf,
  type FamilyLink,
} from "../derive";

/**
 * Karten des Mitglieder-Profils: Familie (Guardianships verlinkt),
 * Beitrags-Historie (Mono-Beträge, Summenzeile) und Anwesenheits-Quote
 * (ProgressBar + Sparkline). Alles aus lib/mock abgeleitet.
 */

/* ---------- Familie ---------- */

const RELATION_KEY: Record<Guardianship["relation"], MitgliederKey> = {
  parent: "famRelParent",
  grandparent: "famRelGrandparent",
  other: "famRelOther",
};

function FamilyRow({
  link,
  meta,
}: {
  link: FamilyLink;
  meta: React.ReactNode;
}) {
  const person = link.member;
  return (
    <li>
      <Link
        href={`/mitglieder/${person.id}`}
        className="group -mx-2 flex min-h-11 items-center gap-2.5 rounded-md px-2 py-1.5 no-underline transition-colors duration-150 hover:bg-sunken"
      >
        <Avatar personId={person.id} firstName={person.firstName} lastName={person.lastName} size="m" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink group-hover:underline">
          {fullName(person)}
        </span>
        {meta}
      </Link>
    </li>
  );
}

export function FamilyCard({ memberId }: { memberId: string }) {
  const t = useT(mitgliederDict);

  const guardians = guardiansOf(memberId);
  const children = childrenOf(memberId);
  const hasLinks = guardians.length > 0 || children.length > 0;

  return (
    <Card>
      <CardHeader eyebrow={t("famEyebrow")} title={t("famTitle")} />
      {!hasLinks ? (
        <div className="grid gap-1">
          <p className="text-body text-ink-soft">{t("famEmpty")}</p>
          <p className="text-caption text-ink-faint">{t("famEmptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {guardians.length > 0 && (
            <section className="grid gap-1">
              <h4 className="eyebrow">{t("famGuardians")}</h4>
              <ul className="grid list-none">
                {guardians.map((link) => (
                  <FamilyRow
                    key={link.member.id}
                    link={link}
                    meta={<Badge tone="neutral">{t(RELATION_KEY[link.relation])}</Badge>}
                  />
                ))}
              </ul>
            </section>
          )}
          {children.length > 0 && (
            <section className="grid gap-1">
              <h4 className="eyebrow">{t("famChildren")}</h4>
              <ul className="grid list-none">
                {children.map((link) => (
                  <FamilyRow
                    key={link.member.id}
                    link={link}
                    meta={
                      link.member.birthDate ? (
                        <span className="text-caption text-ink-faint">
                          {t("bornYear", { year: new Date(link.member.birthDate).getFullYear() })}
                        </span>
                      ) : null
                    }
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------- Beitrags-Historie ---------- */

export function DuesCard({ member }: { member: Member }) {
  const t = useT(mitgliederDict);
  const { locale } = useLocale();

  const rows = invoicesOf(member.id);
  const openCents = openSumCentsOf(member.id);
  const guardians = guardiansOf(member.id);

  const columns: Column<Invoice>[] = [
    {
      id: "invoice",
      header: t("colInvoice"),
      footer: t("duesCount", { n: rows.length }),
      cell: (invoice) => (
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[14px] font-semibold text-ink">{invoice.title}</span>
          <span className="font-mono text-[11.5px] text-ink-faint">{invoice.number}</span>
        </span>
      ),
    },
    {
      id: "due",
      header: t("colDue"),
      cell: (invoice) => (
        <span className="grid gap-0.5">
          <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
            {formatDateShort(invoice.dueAt, locale)}
          </span>
          {invoice.status === "open" && (
            <span className="whitespace-nowrap text-[12px] text-ink-faint">
              {relativeDays(invoice.dueAt, locale)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (invoice) => {
        if (invoice.status === "paid") {
          return (
            <span className="grid justify-items-start gap-0.5">
              <Badge tone="success" icon="check">
                {t("duesPaid")}
              </Badge>
              {invoice.paidAt && (
                <span className="whitespace-nowrap text-[12px] text-ink-faint">
                  {t("duesPaidOn", { date: formatDateShort(invoice.paidAt, locale) })}
                </span>
              )}
            </span>
          );
        }
        if (invoice.status === "cancelled") return <Badge tone="neutral">{t("duesCancelled")}</Badge>;
        return <DunningBadge level={invoice.dunningLevel} />;
      },
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      footer: t("duesOpenSum", { sum: formatEUR(openCents, locale) }),
      cell: (invoice) => formatEUR(invoice.amountCents, locale),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("duesEyebrow")} title={t("duesTitle")} />
      {rows.length === 0 ? (
        <p className="text-body text-ink-soft">
          {guardians.length > 0 ? (
            <>
              {t("duesViaGuardian", { name: fullName(guardians[0].member) })}{" "}
              <Link
                href={`/mitglieder/${guardians[0].member.id}`}
                className="font-bold text-brand no-underline hover:underline"
              >
                {t("duesViaGuardianLink")}
              </Link>
            </>
          ) : (
            t("duesNone")
          )}
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(invoice) => invoice.id}
          caption={t("duesCaption", { name: fullName(member) })}
        />
      )}
    </Card>
  );
}

/* ---------- Anwesenheit ---------- */

const NARROW_NBSP = " ";

function rateTone(ratePercent: number): ProgressTone {
  if (ratePercent >= 80) return "success";
  if (ratePercent >= 60) return "warn";
  return "danger";
}

export function AttendanceCard({ member }: { member: Member }) {
  const t = useT(mitgliederDict);

  const stats = attendanceStats(member);

  return (
    <Card>
      <CardHeader eyebrow={t("attEyebrow")} title={t("attTitle")} />
      {!stats ? (
        <p className="text-body text-ink-soft">{t("attNoTeam")}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid gap-2">
              <span className="font-display text-[27px] font-extrabold leading-8 tracking-tight text-ink tabular-nums">
                {stats.ratePercent}
                {NARROW_NBSP}%
              </span>
              <ProgressBar
                value={stats.present}
                max={stats.total}
                tone={rateTone(stats.ratePercent)}
                label={t("attQuoteLabel", { present: stats.present, total: stats.total })}
              />
              <span className="text-[13px] font-semibold text-ink-soft">
                {t("attOf", { present: stats.present, total: stats.total })}
              </span>
            </div>
            <div className="grid justify-items-start gap-1 sm:justify-items-end">
              <Sparkline
                values={stats.series}
                width={150}
                height={44}
                label={t("attSparkLabel", {
                  values: stats.series.map((value) => `${value}${NARROW_NBSP}%`).join(" → "),
                })}
              />
              <span className="text-caption text-ink-faint">
                {t("attTrend", { n: stats.total })}
              </span>
            </div>
          </div>
          <CardFooter>
            <span>{t("attDemo")}</span>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
