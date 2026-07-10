"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { permissions, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IconTile, type IconTileTone } from "@/components/ui/IconTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon, type IconName } from "@/components/shell/icons";
import { verwaltungDict, type VerwaltungKey } from "./i18n";

/**
 * Verwaltungs-Hub: Kachel-Raster im „Mehr"-Stil der Original-App (Referenz 3.1).
 * Jede Kachel erscheint nur, wenn die Rolle sie darf — Sichtbarkeit über
 * permissions() (Referenz 1.3). Der echte Schutz bleibt serverseitig; hier
 * geht es allein um eine ehrliche Menüführung.
 *
 * Ziel-Routen liegen unter /verwaltung/* und werden von den jeweiligen
 * Fach-Teams gebaut (Mitglieder, Rollen, Teams, Einstellungen); die Plattform-
 * Kachel führt in die getrennte Super-Admin-Konsole (/super).
 */

/** Ziel-Routen der Kacheln (Koordinationspunkt mit den Fach-Teams). */
const HREF = {
  members: "/verwaltung/mitglieder",
  roles: "/verwaltung/rollen",
  teams: "/verwaltung/teams",
  settings: "/verwaltung/verein",
  platform: "/super",
} as const;

interface HubTile {
  href: string;
  icon: IconName;
  tone: IconTileTone;
  titleKey: VerwaltungKey;
  descKey: VerwaltungKey;
  /** Optionaler Badge (z. B. „Super-Admin") */
  badgeKey?: VerwaltungKey;
}

export function VerwaltungHub() {
  const t = useT(verwaltungDict);
  const me = useData((repo) => repo.getCurrentUser());
  const perms = permissions(me.data ?? null);

  const canManageClub = perms.role === "owner" || perms.role === "admin";

  const tiles: HubTile[] = [];
  if (perms.canManageMembers) {
    tiles.push({
      href: HREF.members,
      icon: "members",
      tone: "brand",
      titleKey: "tileMembersTitle",
      descKey: "tileMembersDesc",
    });
  }
  if (perms.isClubAdmin) {
    tiles.push({
      href: HREF.roles,
      icon: "lock",
      tone: "info",
      titleKey: "tileRolesTitle",
      descKey: "tileRolesDesc",
    });
    tiles.push({
      href: HREF.teams,
      icon: "teams",
      tone: "success",
      titleKey: "tileTeamsTitle",
      descKey: "tileTeamsDesc",
    });
  }
  if (canManageClub) {
    tiles.push({
      href: HREF.settings,
      icon: "settings",
      tone: "neutral",
      titleKey: "tileSettingsTitle",
      descKey: "tileSettingsDesc",
    });
  }
  if (perms.isPlatformAdmin) {
    tiles.push({
      href: HREF.platform,
      icon: "globe",
      tone: "warn",
      titleKey: "tilePlatformTitle",
      descKey: "tilePlatformDesc",
      badgeKey: "platformBadge",
    });
  }

  let body: React.ReactNode;
  if (me.status === "loading") {
    body = (
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
    );
  } else if (me.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(me.error)}
        action={<Button onClick={me.reload}>{t("retry")}</Button>}
      />
    );
  } else if (tiles.length === 0) {
    body = (
      <EmptyState
        icon="lock"
        title={t("noAccessTitle")}
        body={t("noAccessBody")}
        ctaHref="/dashboard"
        ctaLabel={t("noAccessCta")}
      />
    );
  } else {
    body = (
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => {
          const title = t(tile.titleKey);
          return (
            <Link
              key={tile.href}
              href={tile.href}
              aria-label={t("openTile", { title })}
              className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card no-underline transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
            >
              <IconTile icon={tile.icon} tone={tile.tone} size="m" />
              <span className="grid min-w-0 gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                    {title}
                  </b>
                  {tile.badgeKey && <Badge tone="warn">{t(tile.badgeKey)}</Badge>}
                </span>
                <span className="text-[13px] leading-snug text-ink-soft">{t(tile.descKey)}</span>
              </span>
              <Icon
                name="chevronRight"
                className="ic ml-auto h-4 w-4 flex-none text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
              />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />
      {body}
    </div>
  );
}
