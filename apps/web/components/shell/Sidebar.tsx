"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { personaByKey, ROLE_LABELS, useAuth } from "@/lib/auth";
import { dataSource } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { club, currentUser, upcomingEvents } from "@/lib/mock";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "./icons";
import { isActive } from "./nav";
import { useVisibleNavItems } from "./useNav";

/**
 * Desktop-Sidebar: Wortmarke, Vereins-Badge, Navigation mit aktivem
 * Zustand (brand-soft/brand-ink), User-Card unten. Auf Mobile ersetzt
 * die BottomNav diese Sidebar.
 */
export function Sidebar() {
  const t = useT(shellDict);
  const { locale } = useLocale();
  const { session } = useAuth();
  const pathname = usePathname();
  const eventBadge = upcomingEvents(7).length;
  const navItems = useVisibleNavItems();

  // Vereinslogo (0060): aus der Facade (api: echter Verein, mock: Demo-Verein).
  // Ist ein Logo gesetzt, zeigt das Badge das Bild statt der Initialen; sonst
  // der schoene Normalfall (Initialen, kein kaputtes Bild).
  const clubData = useData((repo) => repo.getClub());
  const clubLogoUrl = clubData.data?.logoUrl ?? null;
  const clubShort = clubData.data?.shortName ?? club.shortName;

  // Anzeigedaten der User-Card: echte Persona im api-Modus, sonst Demo-Nutzerin
  // (gleiche Ableitung wie im Topbar-UserMenu, damit beide konsistent sind).
  const apiSession = dataSource === "api" ? session : null;
  const persona = apiSession ? personaByKey(apiSession.persona) : undefined;
  const displayName = apiSession ? apiSession.profile.display_name : t("userName");
  const roleLabel = apiSession
    ? (persona?.role[locale] ??
      (apiSession.profile.club_role
        ? ROLE_LABELS[apiSession.profile.club_role][locale]
        : t("userRole")))
    : t("userRole");
  const avatarId = apiSession
    ? (apiSession.profile.member_id ?? apiSession.profile.sub)
    : currentUser.id;
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = apiSession
    ? nameParts.slice(0, -1).join(" ") || displayName
    : currentUser.firstName;
  const lastName = apiSession
    ? (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "")
    : currentUser.lastName;

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-0.5 overflow-y-auto border-r border-line bg-surface px-3.5 pb-4 pt-5 lg:flex">
      {/* Wortmarke */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span
          className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-gradient-to-br from-brand to-brand-strong font-display text-[13px] font-extrabold text-brand-contrast"
          aria-hidden="true"
        >
          R
        </span>
        <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">
          {t("appName")}
        </span>
      </div>

      {/* Vereins-Badge */}
      <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5">
        {clubLogoUrl ? (
          <img
            src={clubLogoUrl}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 flex-none rounded-[13px] object-cover"
          />
        ) : (
          <span
            className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-gradient-to-br from-brand to-brand-strong font-display text-[14px] font-extrabold text-brand-contrast"
            aria-hidden="true"
          >
            {clubShort}
          </span>
        )}
        <span className="min-w-0">
          <b className="block truncate font-display text-[14px] font-extrabold leading-tight tracking-tight text-ink">
            {t("clubName")}
          </b>
          <span className="block truncate text-[11.5px] text-ink-faint">{t("clubMeta")}</span>
        </span>
      </div>

      {/* Navigation */}
      <nav aria-label={t("navLabel")} className="grid gap-0.5">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-body font-semibold no-underline transition-colors duration-150 ${
                active
                  ? "bg-brand-soft font-bold text-brand-ink"
                  : "text-ink-soft hover:bg-sunken hover:text-ink"
              }`}
            >
              <Icon name={item.icon} />
              {t(item.key)}
              {item.key === "navEvents" && eventBadge > 0 && (
                <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-brand px-1.5 text-[11.5px] font-extrabold text-brand-contrast">
                  {eventBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" aria-hidden="true" />

      {/* User-Card */}
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5">
        <Avatar personId={avatarId} firstName={firstName} lastName={lastName} size="m" />
        <span className="min-w-0">
          <b className="block truncate text-[13.5px] font-bold leading-tight text-ink">
            {displayName}
          </b>
          <span className="block truncate text-[11.5px] text-ink-faint">{roleLabel}</span>
        </span>
      </div>
    </aside>
  );
}
