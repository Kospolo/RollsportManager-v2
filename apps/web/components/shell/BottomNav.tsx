"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { Icon } from "./icons";
import { isActive } from "./nav";
import { useNavBadges, useVisibleNavItems } from "./useNav";

/** Mobile Bottom-Navigation (< lg): ersetzt die Sidebar, 44-px-Ziele. */
export function BottomNav() {
  const t = useT(shellDict);
  const pathname = usePathname();
  const badges = useNavBadges();
  const navItems = useVisibleNavItems();

  return (
    <nav
      aria-label={t("navLabel")}
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface px-1 pt-1 lg:hidden"
      style={{
        gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = badges[item.key] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md no-underline transition-colors duration-150 ${
              active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            <span className="relative">
              <Icon name={item.icon} className="ic h-[19px] w-[19px]" />
              {badge > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-2.5 -top-1.5 grid h-[16px] min-w-[16px] place-items-center rounded-full border-2 border-surface bg-brand px-1 text-[9px] font-extrabold leading-none text-brand-contrast"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-bold leading-none">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
