"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { data, errorMessage } from "@/lib/data";
import { chatReportStatusLabels, type ChatReport, type Id, type Member } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { meldungenDict } from "./i18n";
import { REPORT_STATUS_ORDER, REPORT_STATUS_TONE } from "./derive";
import { ReportSnapshotView } from "./ReportSnapshotView";
import { SendMessageDialog } from "./SendMessageDialog";

/**
 * Detail einer Meldung: der Vorstand öffnet sie, ändert den Status, druckt sie
 * (eigene Route) und kann dem Melder ODER der gemeldeten Person eine
 * Direktnachricht schreiben (bestehender DM-Weg). Kontaktdaten kommen aus der
 * Mitgliederliste — für den Vorstand serverseitig unredigiert (can_manage_members).
 */
export function ReportDetail({
  report,
  memberById,
  nameOf,
  onClose,
  onChanged,
}: {
  report: ChatReport;
  memberById: (id?: Id) => Member | undefined;
  nameOf: (id?: Id) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT(meldungenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [recipient, setRecipient] = useState<{ id: Id; name: string } | null>(null);

  const reporter = memberById(report.reporterMemberId);
  const reported = memberById(report.reportedMemberId);

  const changeStatus = async (status: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await data.updateChatReport(report.id, { status: status as ChatReport["status"] });
      showToast(t("statusUpdatedToast"), { tone: "success" });
      onChanged();
    } catch (caught) {
      showToast(errorMessage(caught) || t("statusUpdateError"), { tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        eyebrow={t("detailEyebrow")}
        title={t("cardTitle")}
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Link
              href={`/verwaltung/meldungen/${report.id}/druck`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink-soft no-underline transition-colors duration-150 hover:bg-sunken"
            >
              <Icon name="download" className="ic h-4 w-4" />
              {t("print")}
            </Link>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="mail"
                onClick={() =>
                  setRecipient({ id: report.reporterMemberId, name: nameOf(report.reporterMemberId) })
                }
              >
                {t("messageReporter")}
              </Button>
              {report.reportedMemberId && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="mail"
                  onClick={() =>
                    setRecipient({
                      id: report.reportedMemberId as Id,
                      name: nameOf(report.reportedMemberId),
                    })
                  }
                >
                  {t("messageReported")}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="grid gap-5">
          {/* Status setzen */}
          <Select
            label={t("statusLabel")}
            value={report.status}
            disabled={saving}
            onChange={(event) => changeStatus(event.target.value)}
          >
            {REPORT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {chatReportStatusLabels[s][locale]}
              </option>
            ))}
          </Select>

          {/* Grund */}
          <Field label={t("reasonLabel")}>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[21px] text-ink">
              {report.reason}
            </p>
          </Field>

          {/* Wer / wann / IP */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PersonBlock
              label={t("reporterLabel")}
              name={nameOf(report.reporterMemberId)}
              member={reporter}
              noContact={t("contactLabel")}
              noContactBody={t("noContact")}
            />
            <PersonBlock
              label={t("reportedLabel")}
              name={report.reportedMemberId ? nameOf(report.reportedMemberId) : t("unknownMember")}
              member={reported}
              noContact={t("contactLabel")}
              noContactBody={t("noContact")}
            />
          </div>

          <div className="grid gap-2 rounded-lg border border-line bg-sunken p-3 text-[13px]">
            <MetaRow label={t("reportedAtLabel")} value={formatDateTime(report.createdAt, locale)} />
            {report.snapshot.capturedAt && (
              <MetaRow
                label={t("capturedAtLabel")}
                value={formatDateTime(report.snapshot.capturedAt, locale)}
              />
            )}
            <MetaRow label={t("ipLabel")} value={report.reporterIp ?? t("ipUnknown")} mono />
            {report.handledAt && (
              <MetaRow
                label={t("statusLabel")}
                value={
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={REPORT_STATUS_TONE[report.status]}>
                      {chatReportStatusLabels[report.status][locale]}
                    </Badge>
                    <span className="text-ink-soft">
                      {t("handledLabel", {
                        name: nameOf(report.handledByMemberId) || t("unknownMember"),
                        date: formatDateTime(report.handledAt, locale),
                      })}
                    </span>
                  </span>
                }
              />
            )}
          </div>

          {/* Snapshot */}
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <b className="font-display text-[14px] font-bold tracking-[-0.01em] text-ink">
                {t("snapshotHeading")}
              </b>
            </div>
            <p className="text-[12.5px] text-ink-soft">{t("snapshotNote")}</p>
            <ReportSnapshotView
              snapshot={report.snapshot}
              reportedMessageId={report.messageId}
              nameOf={(id) => nameOf(id)}
            />
          </div>
        </div>
      </Sheet>

      <SendMessageDialog recipient={recipient} onClose={() => setRecipient(null)} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-ink-soft">{label}</span>
      <span className={mono ? "font-mono text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}

function PersonBlock({
  label,
  name,
  member,
  noContact,
  noContactBody,
}: {
  label: string;
  name: string;
  member: Member | undefined;
  noContact: string;
  noContactBody: string;
}) {
  const lines = [member?.email, member?.phone, member?.postalAddress].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <div className="grid gap-1 rounded-lg border border-line bg-surface p-3">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</span>
      <b className="font-display text-[14px] font-bold tracking-[-0.01em] text-ink">{name}</b>
      <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
        {noContact}
      </span>
      {lines.length > 0 ? (
        <div className="grid gap-0.5 text-[13px] text-ink-soft">
          {lines.map((line) => (
            <span key={line} className="break-words">
              {line}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[13px] italic text-ink-faint">{noContactBody}</span>
      )}
    </div>
  );
}
