"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Member } from "@/lib/types";
import { fullName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/shell/icons";
import { QrCode } from "@/lib/qr";
import { memberQrPayload } from "@/lib/member-qr";
import { checkinDict } from "../i18n";

/**
 * „Mein QR-Code": der echte, scanbare Check-in-Code des eingeloggten Mitglieds
 * (lib/qr, self-contained) zum Vorzeigen an der Station — dazu die Mitglieds-ID
 * im Klartext als Fallback für die manuelle Eingabe. Der QR muss dunkel-auf-hell
 * bleiben; die Komponente rendert daher ihren eigenen weißen Grund. Für die
 * Großansicht gibt es die eigene Seite /mein-qr.
 */
export function MyQrCard({ member }: { member: Member }) {
  const t = useT(checkinDict);

  const payload = useMemo(() => memberQrPayload(member), [member]);
  const name = fullName(member);

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("qrTitle")} sub={t("qrSub")} />

      <div className="grid justify-items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center shadow-card">
        <QrCode
          value={payload}
          size={192}
          title={t("qrCodeLabel", { name })}
          className="rounded-lg border border-line shadow-card"
        />

        <div className="grid gap-1">
          <span className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
            {name}
          </span>
          <span className="text-caption text-ink-soft">
            {t("qrIdLabel")}:{" "}
            <span className="font-mono font-semibold tracking-[0.04em] text-ink-soft">
              {member.id}
            </span>
          </span>
        </div>

        <p className="max-w-xs text-caption leading-[18px] text-ink-faint">{t("qrHint")}</p>

        <Link
          href="/mein-qr"
          className="inline-flex items-center gap-1.5 text-caption font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          <Icon name="search" className="ic h-4 w-4" />
          {t("qrFullscreen")}
        </Link>
      </div>
    </section>
  );
}
