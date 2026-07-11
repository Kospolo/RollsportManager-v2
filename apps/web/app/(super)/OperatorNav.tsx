"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT, type Dict } from "@/lib/i18n";
import { Icon } from "@/components/shell/icons";
import { isActive } from "@/components/shell/nav";
import { OPERATOR_NAV } from "./nav";

/**
 * Sekundäre Navigation der Betreiber-Ebene (unter der OperatorTopbar). Führt
 * durch die Plattform-Sektionen; aktiver Zustand über usePathname + isActive
 * (gleiche Logik wie die Portal-Sidebar). Die Einträge stammen aus der
 * gemeinsamen Quelle OPERATOR_NAV (./nav.ts) — Teams ergänzen dort ihre
 * Sektion und hier den zugehörigen Label-Key.
 */

/** Label-Keys der Betreiber-Nav — von anderen Sektionen erweiterbar. */
export type OperatorNavKey =
  | "navOverview"
  | "navLicenses"
  | "navPayments"
  | "navSystem"
  | "navSettings";

const operatorNavDict = {
  de: {
    navLabel: "Betreiber-Navigation",
    navOverview: "Übersicht",
    navLicenses: "Lizenzen",
    navPayments: "Zahlungen",
    navSystem: "System",
    navSettings: "Einstellungen",
  },
  en: {
    navLabel: "Operator navigation",
    navOverview: "Overview",
    navLicenses: "Licences",
    navPayments: "Payments",
    navSystem: "System",
    navSettings: "Settings",
  },
} satisfies Dict<OperatorNavKey | "navLabel">;

export function OperatorNav() {
  const t = useT(operatorNavDict);
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("navLabel")}
      className="border-b border-line bg-surface/70 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 lg:px-8">
        {OPERATOR_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13.5px] font-bold no-underline transition-colors duration-150 ${
                active
                  ? "border-brand text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              <Icon name={item.icon} className="ic h-4 w-4" />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
