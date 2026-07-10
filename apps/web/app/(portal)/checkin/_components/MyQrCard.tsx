"use client";

import { useMemo } from "react";
import type { Member } from "@/lib/types";
import { fullName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { checkinDict } from "../i18n";
import { buildQrPath, memberQrPayload, QR_VIEWBOX } from "../logic";

/**
 * „Mein QR-Code": ein deterministisch aus der Mitglieds-Identität erzeugtes
 * QR-ähnliches Inline-SVG zum Vorzeigen beim Training, plus die Mitglieds-ID im
 * Klartext. Reiner Anzeige-Code — es wird nichts gescannt oder übertragen (der
 * echte Check-in läuft serverseitig über die Facade).
 */
export function MyQrCard({ member }: { member: Member }) {
  const t = useT(checkinDict);

  const payload = useMemo(() => memberQrPayload(member), [member]);
  const path = useMemo(() => buildQrPath(payload), [payload]);
  const name = fullName(member);

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("qrTitle")} sub={t("qrSub")} />

      <div className="grid justify-items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center shadow-card">
        <div className="rounded-lg border border-line bg-canvas p-4 text-ink shadow-card">
          <svg
            viewBox={`0 0 ${QR_VIEWBOX} ${QR_VIEWBOX}`}
            role="img"
            aria-label={t("qrCodeLabel", { name })}
            shapeRendering="crispEdges"
            className="block h-48 w-48"
          >
            <path d={path} fill="currentColor" />
          </svg>
        </div>

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
      </div>
    </section>
  );
}
