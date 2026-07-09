"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { currentUser } from "@/lib/mock";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "./icons";

/** Avatar-Menü der Topbar: „Sandra Vogel — Trainerin" (Aktionen noch Stubs). */
export function UserMenu() {
  const t = useT(shellDict);
  const [open, setOpen] = useState(false);

  const items: { icon: IconName; label: string }[] = [
    { icon: "user", label: t("profile") },
    { icon: "settings", label: t("settings") },
    { icon: "signout", label: t("signOut") },
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
        <Avatar
          personId={currentUser.id}
          firstName={currentUser.firstName}
          lastName={currentUser.lastName}
          size="m"
        />
        <span className="hidden min-w-0 text-left xl:block">
          <b className="block truncate text-[13px] font-bold leading-tight text-ink">
            {t("userName")}
          </b>
          <span className="block text-[11px] leading-tight text-ink-faint">{t("userRole")}</span>
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
            <b className="block text-[13.5px] font-bold text-ink">{t("userName")}</b>
            <span className="block text-caption text-ink-faint">{t("userRole")}</span>
          </div>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
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
