"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/shell/icons";
import { MehrIcon, type MehrIconName } from "../../mehr/MehrIcon";
import { financeDict, type FinanceKey } from "../i18n";

/**
 * Finanz-Hub: Navigationsleiste zu den Finanz-Unterbereichen (Kassenbuch,
 * Rechnungen, Mahnungen, Auswertung, Beitragskategorien, Beiträge, SEPA).
 * Sitzt oben im Finanzen-Screen; die bestehende Übersicht (KPIs, offene
 * Posten) bleibt darunter erhalten.
 *
 * Sichtbar NUR mit can_manage_finance (treasurer/moderator/admin/owner) —
 * die Rechte-Ableitung passiert im Parent (FinanceClient). Der echte Schutz
 * bleibt serverseitig (RLS + API-DB-Check); hier geht es allein um eine
 * ehrliche Menüführung. Ohne Recht rendert die Leiste nichts (null).
 */

type Tone = "brand" | "info" | "warn" | "success";

const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  success: "bg-success-soft text-success",
};

/** Icon-Quelle: geteiltes Shell-Icon oder lokales „Mehr"-Glyph. */
type TileIcon = { shell: IconName } | { mehr: MehrIconName };

interface HubTile {
  href: string;
  icon: TileIcon;
  tone: Tone;
  titleKey: FinanceKey;
  descKey: FinanceKey;
}

/** Ziel-Routen — Koordinationspunkt mit den Fach-Teams (Unterbereiche). */
const TILES: HubTile[] = [
  {
    href: "/finanzen/kassenbuch",
    icon: { shell: "bank" },
    tone: "brand",
    titleKey: "hubLedgerTitle",
    descKey: "hubLedgerDesc",
  },
  {
    href: "/finanzen/rechnungen",
    icon: { mehr: "document" },
    tone: "info",
    titleKey: "hubInvoicesTitle",
    descKey: "hubInvoicesDesc",
  },
  {
    href: "/finanzen/mahnungen",
    icon: { shell: "bell" },
    tone: "warn",
    titleKey: "hubDunningTitle",
    descKey: "hubDunningDesc",
  },
  {
    href: "/auswertung",
    icon: { mehr: "chart" },
    tone: "success",
    titleKey: "hubReportsTitle",
    descKey: "hubReportsDesc",
  },
  {
    href: "/finanzen/beitragskategorien",
    icon: { shell: "settings" },
    tone: "brand",
    titleKey: "hubCategoriesTitle",
    descKey: "hubCategoriesDesc",
  },
  {
    href: "/finanzen/beitraege",
    icon: { shell: "members" },
    tone: "info",
    titleKey: "hubFeesTitle",
    descKey: "hubFeesDesc",
  },
  {
    href: "/finanzen/sepa",
    icon: { shell: "shield" },
    tone: "success",
    titleKey: "hubSepaTitle",
    descKey: "hubSepaDesc",
  },
];

function renderIcon(icon: TileIcon): ReactNode {
  return "shell" in icon ? (
    <Icon name={icon.shell} className="ic h-5 w-5" />
  ) : (
    <MehrIcon name={icon.mehr} className="ic h-5 w-5" />
  );
}

/** Tinted Icon-Kachel im „m"-Format der IconTile (38 px, radius-md). */
function TileGlyph({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-md ${TONE_CLASS[tone]}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export function FinanceHubNav({ canManageFinance }: { canManageFinance: boolean }) {
  const t = useT(financeDict);
  if (!canManageFinance) return null;

  return (
    <nav
      aria-label={t("hubNavLabel")}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {TILES.map((tile) => {
        const title = t(tile.titleKey);
        return (
          <Link
            key={tile.href}
            href={tile.href}
            aria-label={t("hubOpen", { title })}
            className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card no-underline transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
          >
            <TileGlyph tone={tile.tone}>{renderIcon(tile.icon)}</TileGlyph>
            <span className="grid min-w-0 gap-0.5">
              <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                {title}
              </b>
              <span className="text-[13px] leading-snug text-ink-soft">{t(tile.descKey)}</span>
            </span>
            <Icon
              name="chevronRight"
              className="ic ml-auto h-4 w-4 flex-none text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
            />
          </Link>
        );
      })}
    </nav>
  );
}
