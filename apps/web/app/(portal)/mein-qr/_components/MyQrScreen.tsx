"use client";

import Link from "next/link";
import { errorMessage, fullName, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { QrCode } from "@/lib/qr";
import { memberQrPayload } from "@/lib/member-qr";
import { meinQrDict } from "../i18n";

/**
 * „Mein QR-Code" in Großansicht (/mein-qr): der echte, scanbare Check-in-Code
 * des eingeloggten Mitglieds (lib/qr, self-contained) zum Vorzeigen an der
 * Scan-Station, plus die Mitglieds-ID im Klartext als manueller Fallback. Der
 * QR bleibt dunkel-auf-hell (eigener weißer Grund), damit ihn jeder Scanner
 * liest. Daten kommen über die Facade (getCurrentUser); Rechte serverseitig.
 */
export function MyQrScreen() {
  const t = useT(meinQrDict);
  const state = useData((repo) => repo.getCurrentUser());

  const header = <SectionHeader level={1} eyebrow={t("pageEyebrow")} title={t("pageTitle")} sub={t("pageSub")} />;

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid justify-items-center gap-4 rounded-xl border border-line bg-surface p-6 shadow-card">
        <Skeleton className="h-64 w-64 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (!state.data.clubId) {
    body = <EmptyState icon="user" title={t("noMemberTitle")} body={t("noMemberBody")} />;
  } else {
    body = <QrPanel member={state.data} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-lg content-start gap-6">
      {header}
      {body}
      <Link
        href="/checkin"
        className="inline-flex items-center gap-1.5 justify-self-start text-caption font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
      >
        <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
        {t("backToCheckin")}
      </Link>
    </div>
  );
}

function QrPanel({ member }: { member: Member }) {
  const t = useT(meinQrDict);
  const name = fullName(member);

  return (
    <section className="grid justify-items-center gap-5 rounded-xl border border-line bg-surface p-6 text-center shadow-card sm:p-8">
      <QrCode
        value={memberQrPayload(member)}
        size={280}
        title={t("codeLabel", { name })}
        className="w-full max-w-[280px] rounded-xl border border-line shadow-card"
      />

      <div className="grid gap-1">
        <span className="font-display text-h3 tracking-[-0.01em] text-ink">{name}</span>
        <span className="text-caption text-ink-soft">
          {t("idLabel")}:{" "}
          <span className="font-mono font-semibold tracking-[0.04em] text-ink-soft">{member.id}</span>
        </span>
      </div>

      <p className="max-w-xs text-caption leading-[18px] text-ink-faint">{t("hint")}</p>
    </section>
  );
}
