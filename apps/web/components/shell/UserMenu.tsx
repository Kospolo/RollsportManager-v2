"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { personaByKey, ROLE_LABELS, useAuth } from "@/lib/auth";
import { dataSource } from "@/lib/data";
import { currentUser } from "@/lib/mock";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "./icons";

/**
 * Avatar-Menü der Topbar.
 * mock-Modus: Demo-Persona „Sandra Vogel — Trainerin" (wie bisher).
 * api-Modus: echte Persona aus dem Dev-Login (rsm.dev.auth); „Abmelden"
 * löscht die Session und führt zurück auf /login.
 */
export function UserMenu() {
  const t = useT(shellDict);
  const { locale } = useLocale();
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Anzeigedaten: echte Persona im api-Modus, sonst Demo-Nutzerin.
  const apiSession = dataSource === "api" ? session : null;
  const persona = apiSession ? personaByKey(apiSession.persona) : undefined;
  const displayName = apiSession ? apiSession.profile.display_name : t("userName");
  const roleLabel = apiSession
    ? (persona?.role[locale] ??
      (apiSession.profile.club_role
        ? ROLE_LABELS[apiSession.profile.club_role][locale]
        : t("userRole")))
    : t("userRole");
  // Plattform-Persona hat keine Mitgliedszeile → profil-sub als Avatar-Seed.
  const avatarId = apiSession
    ? (apiSession.profile.member_id ?? apiSession.profile.sub)
    : currentUser.id;
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = apiSession ? nameParts.slice(0, -1).join(" ") || displayName : currentUser.firstName;
  const lastName = apiSession ? (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "") : currentUser.lastName;

  function handleSignOut() {
    setOpen(false);
    if (dataSource === "api") signOut();
    router.push("/login");
  }

  function navigateTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  const items: { icon: IconName; label: string; onSelect: () => void }[] = [
    { icon: "user", label: t("profile"), onSelect: () => navigateTo("/profil") },
    { icon: "settings", label: t("settings"), onSelect: () => navigateTo("/einstellungen") },
    { icon: "signout", label: t("signOut"), onSelect: handleSignOut },
  ];

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("userMenuLabel")}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors duration-150 hover:bg-sunken"
      >
        <Avatar personId={avatarId} firstName={firstName} lastName={lastName} size="m" />
        <span className="hidden min-w-0 text-left xl:block">
          <b className="block truncate text-[13px] font-bold leading-tight text-ink">
            {displayName}
          </b>
          <span className="block text-[11px] leading-tight text-ink-faint">{roleLabel}</span>
        </span>
        <Icon name="chevronDown" className="ic h-4 w-4 text-ink-faint" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("userMenuLabel")}
          className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-52 rounded-lg border border-line bg-surface p-1.5 shadow-pop"
        >
          <div className="border-b border-line px-3 pb-2 pt-1.5">
            <b className="block text-[13.5px] font-bold text-ink">{displayName}</b>
            <span className="block text-caption text-ink-faint">{roleLabel}</span>
          </div>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={item.onSelect}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-body font-semibold text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Icon name={item.icon} className="ic h-[18px] w-[18px]" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
