"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { Icon } from "./icons";
import { isActive } from "./nav";
import { useVisibleNavItems } from "./useNav";

/** Mobile Bottom-Navigation (< lg): ersetzt die Sidebar, 44-px-Ziele. */
export function BottomNav() {
  const t = useT(shellDict);
  const pathname = usePathname();
  const navItems = useVisibleNavItems();

  return (
    <nav
      aria-label={t("navLabel")}
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden"
      style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
    >
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md no-underline transition-colors duration-150 ${
              active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            <Icon name={item.icon} className="ic h-[19px] w-[19px]" />
            <span className="text-[10px] font-bold leading-none">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
